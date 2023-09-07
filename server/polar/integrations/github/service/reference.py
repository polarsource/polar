from __future__ import annotations

from datetime import datetime
from typing import Any, List, Set, Union
from uuid import UUID

import structlog
from fastapi.encoders import jsonable_encoder
from githubkit import GitHub, Response
from githubkit.exception import RequestFailed
from githubkit.utils import exclude_unset
from pydantic import Field, ValidationError, parse_obj_as

import polar.integrations.github.client as github
from polar.exceptions import IntegrityError
from polar.integrations.github.service.api import github_api
from polar.integrations.github.service.issue import github_issue
from polar.integrations.github.service.pull_request import github_pull_request
from polar.issue.hooks import (
    IssueReferenceHook,
    issue_reference_created,
    issue_reference_updated,
)
from polar.kit import utils
from polar.models import Organization, Repository
from polar.models.issue import Issue
from polar.models.issue_reference import (
    ExternalGitHubCommitReference,
    ExternalGitHubPullRequestReference,
    IssueReference,
    ReferenceType,
)
from polar.postgres import AsyncSession, sql
from polar.worker import enqueue_job

log = structlog.get_logger()


class UnknownIssueEvent(github.rest.GitHubRestModel):
    """
    The timeline API is not fully specced out in the github schema.
    This is a catch-all event for events that we're unable to parse.
    """

    event: str = Field(default=...)


TimelineEventType = Union[
    github.rest.LabeledIssueEvent,
    github.rest.UnlabeledIssueEvent,
    github.rest.MilestonedIssueEvent,
    github.rest.DemilestonedIssueEvent,
    github.rest.RenamedIssueEvent,
    github.rest.ReviewRequestedIssueEvent,
    github.rest.ReviewRequestRemovedIssueEvent,
    github.rest.ReviewDismissedIssueEvent,
    github.rest.LockedIssueEvent,
    github.rest.AddedToProjectIssueEvent,
    github.rest.MovedColumnInProjectIssueEvent,
    github.rest.RemovedFromProjectIssueEvent,
    github.rest.ConvertedNoteToIssueIssueEvent,
    github.rest.TimelineCommentEvent,
    github.rest.TimelineCrossReferencedEvent,
    github.rest.TimelineCommittedEvent,
    github.rest.TimelineReviewedEvent,
    github.rest.TimelineLineCommentedEvent,
    github.rest.TimelineCommitCommentedEvent,
    github.rest.TimelineAssignedIssueEvent,
    github.rest.TimelineUnassignedIssueEvent,
    github.rest.StateChangeIssueEvent,
    UnknownIssueEvent,
]


class GitHubIssueReferencesService:
    async def sync_repo_references(
        self,
        session: AsyncSession,
        org: Organization,
        repo: Repository,
        crawl_with_installation_id: int
        | None = None,  # Override which installation to use when crawling
    ) -> None:
        """
        sync_repo_references lists repository events to find issues that have been
        mentioned. When we know which issues that have been mentioned, a job to fetch
        and parse timeline events will be triggered.
        """

        installation_id = (
            crawl_with_installation_id
            if crawl_with_installation_id
            else org.safe_installation_id
        )

        client = github.get_app_installation_client(installation_id)

        if (
            repo.issues_references_synced_at
            and (utils.utc_now() - repo.issues_references_synced_at).seconds < 60
        ):
            # Crawled within the last minute, skip
            log.info(
                "github.sync_repo_references.skip",
                owner=org.name,
                repo=repo.name,
            )
            return

        pre_sync_timestamp = repo.issues_references_synced_at

        # Set sync timestamp
        stmt = (
            sql.Update(Repository)
            .where(Repository.id == repo.id)
            .values(issues_references_synced_at=utils.utc_now())
        )
        await session.execute(stmt)
        await session.commit()

        log.info(
            "github.sync_repo_references",
            id=repo.id,
            name=repo.name,
        )

        triggered_ids: Set[int] = set()

        for page in range(1, 100):  # Maximum 100 pages
            res = await client.rest.issues.async_list_events_for_repo(
                owner=org.name, repo=repo.name, per_page=100, page=page
            )

            events = res.parsed_data

            # Process events that are newer than the newest event we have
            if pre_sync_timestamp:
                events = [e for e in events if e.created_at >= pre_sync_timestamp]

            # No events, stop pagination
            if len(events) == 0:
                break

            log.info(
                "references.repo.page",
                name=repo.name,
                page=page,
                num=len(events),
            )

            for external_issue_id in self.external_issue_ids_to_sync(events):
                if external_issue_id in triggered_ids:
                    continue
                triggered_ids.add(external_issue_id)

                issue = await github_issue.get_by_external_id(
                    session, external_issue_id
                )
                if not issue:
                    log.warn(
                        "github.sync_repo_references.issue-not-found",
                        repo_id=repo.id,
                        external_issue_id=external_issue_id,
                    )
                    continue
                # Trigger issue references sync job
                await enqueue_job(
                    "github.issue.sync.issue_references",
                    issue.id,
                    crawl_with_installation_id=installation_id,
                )

        return None

    def external_issue_ids_to_sync(
        self, events: List[github.rest.IssueEvent]
    ) -> Set[int]:
        res: Set[int] = set()

        for event in events:
            if event.event == "referenced" and event.issue:
                res.add(event.issue.id)

        return res

    async def async_list_events_for_timeline_with_headers(
        self,
        client: GitHub[Any],
        owner: str,
        repo: str,
        issue_number: int,
        per_page: int = 30,
        page: int = 1,
        etag: str | None = None,
    ) -> Response[List[TimelineEventType]]:
        url = f"/repos/{owner}/{repo}/issues/{issue_number}/timeline"

        params = {
            "per_page": per_page,
            "page": page,
        }

        return await github_api.async_request_with_headers(
            client=client,
            url=url,
            params=exclude_unset(params),
            etag=etag,
            response_model=List[TimelineEventType],
        )

    async def sync_issue_references(
        self,
        session: AsyncSession,
        org: Organization,
        repo: Repository,
        issue: Issue,
        crawl_with_installation_id: int
        | None = None,  # Override which installation to use when crawling
    ) -> None:
        """
        sync_issue_references uses the GitHub Timeline API to find CrossReference events
        and creates IssueReferences
        """

        installation_id = (
            crawl_with_installation_id
            if crawl_with_installation_id
            else org.safe_installation_id
        )

        client = github.get_app_installation_client(installation_id)

        log.info("github.sync_issue_references", issue_id=issue.id)

        # TODO: if the first page is a cache miss, we're currently re-crawling all pages
        # A nice improvement would be to figure out if we can stop crawling early.
        for page in range(1, 100):
            first_page = page == 1

            try:
                res = await self.async_list_events_for_timeline_with_headers(
                    client,
                    owner=org.name,
                    repo=repo.name,
                    issue_number=issue.number,
                    page=page,
                    per_page=100,
                    etag=issue.github_timeline_etag if first_page else None,
                )
            except RequestFailed as e:
                if e.response.status_code == 404:
                    issue.github_timeline_fetched_at = datetime.utcnow()
                    await issue.save(session)
                    log.info("github.sync_issue_references.404.marking_as_crawled")
                    return
                else:
                    raise e

            # Cache hit, nothing new
            if first_page and res.status_code == 304:
                log.info(
                    "github.sync_issue_references.etag_cache_hit", issue_id=issue.id
                )
                return

            # Save ETag of the first page
            if first_page and res.status_code == 200:
                log.info(
                    "github.sync_issue_references.etag_cache_miss", issue_id=issue.id
                )

                issue.github_timeline_fetched_at = datetime.utcnow()
                issue.github_timeline_etag = res.headers.get("etag", None)
                await issue.save(session)

            try:
                for event in res.parsed_data:
                    ref = await self.parse_issue_timeline_event(
                        session, org, repo, issue, event, client=client
                    )
                    if ref:
                        # add data missing from github api
                        ref = await self.annotate(session, org, ref, client=client)

                        # persist
                        await self.create_reference(session, ref)
            except ValidationError as e:
                log.error(
                    "github.sync_issue_references.parsing_failed",
                    issue_id=issue.id,
                )
                raise e

            # No more pages
            if len(res.parsed_data) < 100:
                return

    async def parse_issue_timeline_event(
        self,
        session: AsyncSession,
        org: Organization,
        repo: Repository,
        issue: Issue,
        event: TimelineEventType,
        client: GitHub[Any],
    ) -> IssueReference | None:
        if isinstance(event, github.rest.TimelineCrossReferencedEvent):
            return await self.parse_issue_pull_request_reference(
                session,
                org,
                repo,
                event,
                issue,
                client=client,
            )

        # For some reason, this events maps to the StateChangeIssueEvent type
        if event.event == "referenced" and isinstance(
            event, github.rest.StateChangeIssueEvent
        ):
            return await self.parse_issue_commit_reference(event, issue)

        return None

    async def parse_issue_pull_request_reference(
        self,
        session: AsyncSession,
        org: Organization,
        repo: Repository,
        event: github.rest.TimelineCrossReferencedEvent,
        issue: Issue,
        client: GitHub[Any],
    ) -> IssueReference | None:
        if not event.source.issue:
            return None

        # Mention was not from a pull request
        if not isinstance(
            event.source.issue.pull_request,
            github.rest.IssuePropPullRequest,
        ):
            return None

        if not event.source.issue.repository:
            return None

        # If mentioned in a outsider repository, create an external reference
        if event.source.issue.repository.id != repo.external_id:
            return self.parse_external_reference(event, issue)

        # If mentioning Pull Request Exists on Polar
        referenced_by_pr = await github_pull_request.get_by(
            session,
            repository_id=repo.id,
            number=event.source.issue.number,
        )

        if not referenced_by_pr:
            # If referenced by PR in the same repository, but that PR has not been
            # synced. Sync it, and try again
            if event.source.issue.repository.id == repo.external_id:
                # Try to fetch it
                referenced_by_pr = await github_pull_request.sync_pull_request(
                    session,
                    client=client,
                    organization=org,
                    repository=repo,
                    number=event.source.issue.number,
                )

        # If still missing, skip
        if not referenced_by_pr:
            log.error(
                "github.parse_issue_pull_request_reference.pr-not-found",
                external_pr_id=issue.id,
            )
            return None

        # Polar-internal pull request reference
        return IssueReference(
            issue_id=issue.id,
            pull_request_id=referenced_by_pr.id,
            external_id=str(referenced_by_pr.id),
            reference_type=ReferenceType.PULL_REQUEST,
        )

    async def parse_issue_commit_reference(
        self,
        event: github.rest.StateChangeIssueEvent,
        issue: Issue,
    ) -> IssueReference | None:
        if not event.commit_url or not event.commit_id:
            return None

        # Parse org name and repo from url
        # Example: "https://api.github.com/repos/zegl/polarforkotest/commits/471f58636e9b66228141d5e2c76be24f20f1553f"  # noqa: E501

        parts = event.commit_url.split("/")
        if len(parts) < 6:
            return None

        obj = ExternalGitHubCommitReference(
            organization_name=parts[4],
            repository_name=parts[5],
            user_login=event.actor.login,
            user_avatar=event.actor.avatar_url,
            commit_id=event.commit_id,
        )

        ref = IssueReference(
            issue_id=issue.id,
            external_id=event.commit_id,
            reference_type=ReferenceType.EXTERNAL_GITHUB_COMMIT,
            external_source=jsonable_encoder(obj),
        )

        return ref

    def parse_external_reference(
        self,
        event: github.rest.TimelineCrossReferencedEvent,
        issue: Issue,
    ) -> IssueReference | None:
        if not event.source.issue:
            return None
        i = event.source.issue
        if not i.repository:
            return None
        if not i.repository.owner.login:
            return None

        # Mention was not from a pull request
        if not isinstance(
            i.pull_request,
            github.rest.IssuePropPullRequest,
        ):
            return None

        obj = ExternalGitHubPullRequestReference(
            organization_name=i.repository.owner.login,
            repository_name=i.repository.name,
            title=i.title,
            number=i.number,
            user_login=i.repository.owner.login,
            user_avatar=i.repository.owner.avatar_url,
            state=i.state,
            is_draft=True if i.draft else False,
            is_merged=True if i.pull_request.merged_at else False,
        )

        ref = IssueReference(
            issue_id=issue.id,
            external_id=i.pull_request.html_url,
            reference_type=ReferenceType.EXTERNAL_GITHUB_PULL_REQUEST,
            external_source=jsonable_encoder(obj),
        )

        return ref

    async def annotate(
        self,
        session: AsyncSession,
        org: Organization,
        ref: IssueReference,
        client: GitHub[Any],
    ) -> IssueReference:
        if ref.reference_type == ReferenceType.EXTERNAL_GITHUB_COMMIT:
            r = parse_obj_as(ExternalGitHubCommitReference, ref.external_source)

            # use fields from existing db entry if set
            existing = await self.get(
                session, ref.issue_id, ref.reference_type, ref.external_id
            )
            existingRef = (
                parse_obj_as(ExternalGitHubCommitReference, existing.external_source)
                if existing
                else None
            )

            ref.external_source = jsonable_encoder(
                await self.annotate_issue_commit_reference(org, r, existingRef, client)
            )

        return ref

    async def annotate_issue_commit_reference(
        self,
        org: Organization,
        ref: ExternalGitHubCommitReference,
        existingRef: ExternalGitHubCommitReference | None,
        client: GitHub[Any],
    ) -> ExternalGitHubCommitReference:
        """
        annotate_issue_commit_reference attempts to fetch data from the GitHub API
        and fill in the blanks in ref
        """

        # New ref has all fields
        if ref.branch_name and ref.branch_name:
            return ref

        # Populate from existingRef
        if existingRef and existingRef.branch_name and not ref.branch_name:
            ref.branch_name = existingRef.branch_name
        if existingRef and existingRef.message and not ref.message:
            ref.message = existingRef.message

        # If still not there, fetch from GitHub
        if not ref.branch_name or not ref.message:
            # Fetch branches where the commit is currently the HEAD commit
            # GitHub has no API to find branches that _contain_ a commit, so if that's
            # what we want to do long term, we'll probably have to clone the repo and
            # analyze it ourselves.
            try:
                branches = await client.rest.repos.async_list_branches_for_head_commit(
                    owner=ref.organization_name,
                    repo=ref.repository_name,
                    commit_sha=ref.commit_id,
                )

                if branches.status_code == 200:
                    if branches and branches.parsed_data:
                        b = branches.parsed_data
                        if len(b) == 1:
                            ref.branch_name = b[0].name
            except RequestFailed as e:
                # Don't worry about it.
                pass

            # Get commit message
            try:
                commit = await client.rest.repos.async_get_commit(
                    owner=ref.organization_name,
                    repo=ref.repository_name,
                    ref=ref.commit_id,
                )

                if commit.status_code == 200:
                    try:
                        if commit and commit.parsed_data.commit.message:
                            ref.message = commit.parsed_data.commit.message
                    except ValidationError:
                        pass  # don't panic on validation errors

            except RequestFailed as e:
                # Don't worry about it.
                pass

        return ref

    async def get(
        self,
        session: AsyncSession,
        issue_id: UUID,
        reference_type: ReferenceType | str,
        external_id: str,
    ) -> IssueReference | None:
        stmt = sql.select(IssueReference).where(
            IssueReference.issue_id == issue_id,
            IssueReference.reference_type == reference_type,
            IssueReference.external_id == external_id,
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    async def create_reference(
        self, session: AsyncSession, ref: IssueReference
    ) -> None:
        nested = await session.begin_nested()
        try:
            session.add(ref)
            await nested.commit()
            await session.commit()
            log.info(
                "issue.create_reference.created",
                ref=ref,
            )

            await issue_reference_created.call(IssueReferenceHook(session, ref))
            return
        except IntegrityError:
            log.info(
                "issue.create_reference.already_exists",
                ref=ref,
            )
            await nested.rollback()

        # Update external_source
        stmt = (
            sql.Update(IssueReference)
            .where(
                IssueReference.issue_id == ref.issue_id,
                IssueReference.reference_type == ref.reference_type,
                IssueReference.external_id == ref.external_id,
            )
            .values(external_source=ref.external_source)
        )

        await session.execute(stmt)
        await session.commit()

        await issue_reference_updated.call(IssueReferenceHook(session, ref))


github_reference = GitHubIssueReferencesService()
