from __future__ import annotations
from typing import Set
from uuid import UUID

import structlog
from polar.exceptions import IntegrityError
from polar.integrations.github.client import get_app_installation_client
import polar.integrations.github.client as github
from polar.integrations.github.service.pull_request import github_pull_request
from polar.integrations.github.service.issue import github_issue
from polar.kit import utils

from polar.models import Organization, Repository
from polar.models.issue import Issue
from polar.models.issue_reference import (
    ExternalGitHubPullRequestReference,
    IssueReference,
)
from polar.postgres import AsyncSession, sql
from polar.worker import enqueue_job


log = structlog.get_logger()


class GitHubIssueReferencesService:
    async def sync_repo_references(
        self, session: AsyncSession, org: Organization, repo: Repository
    ) -> None:
        """
        sync_repo_references lists repository events to find issues that have been mentioned.
        When we know which issues that have been mentioned, a job to fetch and parse timeline
        events will be triggered.
        """

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

        # Set sync timestamp
        stmt = (
            sql.Update(Repository)
            .where(Repository.id == repo.id)
            .values(issues_references_synced_at=utils.utc_now())
        )
        await session.execute(stmt)
        await session.commit()

        client = get_app_installation_client(org.installation_id)

        log.info(
            "github.sync_repo_references",
            id=repo.id,
            name=repo.name,
        )

        # TODO: paginate?
        res = await client.rest.issues.async_list_events_for_repo(
            owner=org.name,
            repo=repo.name,
        )

        events = res.parsed_data

        synced_issues: Set[UUID] = set()

        for event in events:
            if event.event == "referenced" and event.issue:
                issue = await github_issue.get_by_external_id(session, event.issue.id)
                if not issue:
                    log.warn(
                        "github.sync_repo_references.issue-not-found",
                        repo_id=repo.id,
                        external_issue_id=event.issue.id,
                    )
                    continue

                # sync has already been triggered for this issue
                if issue.id in synced_issues:
                    continue
                synced_issues.add(issue.id)

                # Trigger issue references sync job
                await enqueue_job("github.issue.sync.issue_references", issue.id)

        return None

    async def sync_issue_references(
        self,
        session: AsyncSession,
        org: Organization,
        repo: Repository,
        issue: Issue,
    ) -> None:
        """
        sync_issue_references uses the GitHub Timeline API to find CrossReference events
        and creates IssueReferences
        """
        client = get_app_installation_client(org.installation_id)

        log.info(
            "github.sync_issue_references",
            id=repo.id,
            name=repo.name,
            issue_number=issue.number,
        )

        async for event in client.paginate(
            client.rest.issues.async_list_events_for_timeline,
            owner=org.name,
            repo=repo.name,
            issue_number=issue.number,
        ):
            if isinstance(event, github.rest.TimelineCrossReferencedEvent):
                await self.parse_issue_pull_request_reference(
                    session, org, repo, event, issue
                )

        return

    async def parse_issue_pull_request_reference(
        self,
        session: AsyncSession,
        org: Organization,
        repo: Repository,
        event: github.rest.TimelineCrossReferencedEvent,
        issue: Issue,
    ) -> None:
        if not event.source.issue:
            return

        # Mention was not from a pull request
        if not isinstance(
            event.source.issue.pull_request,
            github.rest.IssuePropPullRequest,
        ):
            return

        if not event.source.issue.repository:
            return

        # If mentioned in a outsider repository, create weak reference
        if event.source.issue.repository.id != repo.external_id:
            return await self.create_external_reference(
                session, org, repo, event, issue
            )

        # Check if we have this repo
        # referenced_by_repo = await github_repository.get_by_external_id(
        #    session, evt_repo.id
        # )

        # if not referenced_by_repo:
        #    # TODO: Support references from repositories that are not on Polar
        #    log.warn(
        #        "github.parse_issue_pull_request_reference.repo-not-found",
        #        ref_repo_id=evt_repo.id,
        #    )
        #    return

        # If mentioning Pull Request Exists on Polar
        referenced_by_pr = await github_pull_request.get_by(
            session,
            repository_id=repo.id,
            number=i.number,
        )

        if not referenced_by_pr:
            # If referenced by PR in the same repository, but that PR has not been synced
            # Sync it, and try again
            if event.source.issue.repository.id == repo.external_id:
                # Try to fetch it
                referenced_by_pr = await github_pull_request.sync_pull_request(
                    session,
                    organization=org,
                    repository=repo,
                    number=i.number,
                )

        # If still missing, skip
        if not referenced_by_pr:
            log.error(
                "github.parse_issue_pull_request_reference.pr-not-found",
                external_pr_id=i.id,
            )
            return

        # Track mention
        await self.create_reference(
            session,
            issue_id=issue.id,
            pr_id=referenced_by_pr.id,
        )

    async def create_external_reference(
        self,
        session: AsyncSession,
        org: Organization,
        repo: Repository,
        event: github.rest.TimelineCrossReferencedEvent,
        issue: Issue,
    ) -> None:
        if not event.source.issue:
            return
        i = event.source.issue
        if not i.repository:
            return
        if not i.repository.owner.name:
            return

        # Mention was not from a pull request
        if not isinstance(
            i.pull_request,
            github.rest.IssuePropPullRequest,
        ):
            return

        obj = ExternalGitHubPullRequestReference(
            organization_name=i.repository.owner.name,
            repository_name=i.repository.name,
            title=i.title,
            number=i.number,
            user_login=i.repository.owner.login,
            user_avatar=i.repository.owner.avatar_url,
            state=i.state,
            is_draft=True if i.draft else False,
            is_merged=True if i.pull_request.merged_at else False,
        )

        await self.upsert_external_reference(session, issue_id=issue.id, obj=obj)

    async def create_reference(
        self, session: AsyncSession, issue_id: UUID, pr_id: UUID
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = IssueReference(
                issue_id=issue_id,
                pull_request_id=pr_id,
            )
            session.add(relation)
            await nested.commit()
            await session.commit()
            log.info(
                "issue.create_reference.created",
                issue_id=issue_id,
                pull_request_id=pr_id,
            )
            return
        except IntegrityError:
            log.info(
                "issue.create_reference.already_exists",
                issue_id=issue_id,
                pull_request_id=pr_id,
            )
            await nested.rollback()

    async def upsert_external_reference(
        self,
        session: AsyncSession,
        issue_id: UUID,
        obj: ExternalGitHubPullRequestReference,
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = IssueReference(
                issue_id=issue_id,
                # pull_request_id=pr_id,
                reference_type="external_pull_request",
                external_source=obj,
            )
            session.add(relation)
            await nested.commit()
            await session.commit()
            log.info(
                "issue.create_reference.created",
                issue_id=issue_id,
                # pull_request_id=pr_id,
            )
            return
        except IntegrityError:
            log.info(
                "issue.create_reference.already_exists",
                issue_id=issue_id,
                # pull_request_id=pr_id,
            )
            await nested.rollback()

        # TODO: Update!
        # TODO: We need a new primary key / unique index...


github_reference = GitHubIssueReferencesService()
