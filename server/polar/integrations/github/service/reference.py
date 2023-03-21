from __future__ import annotations
from typing import Set
from uuid import UUID

import structlog
from polar.exceptions import IntegrityError
from polar.integrations.github.client import get_app_installation_client
import polar.integrations.github.client as github
from polar.integrations.github.service.repository import github_repository
from polar.integrations.github.service.pull_request import github_pull_request
from polar.integrations.github.service.issue import github_issue

from polar.models import Organization, Repository
from polar.models.issue import Issue
from polar.models.issue_reference import IssueReference
from polar.postgres import AsyncSession
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
                await enqueue_job("github.issue.sync.issue_referenecs", issue.id)

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

        events = await client.rest.issues.async_list_events_for_timeline(
            owner=org.name,
            repo=repo.name,
            issue_number=issue.number,
        )

        for event in events.parsed_data:
            if isinstance(event, github.rest.TimelineCrossReferencedEvent):
                await self.parse_issue_pull_request_reference(session, event, issue)

        return

    async def parse_issue_pull_request_reference(
        self,
        session: AsyncSession,
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

        evt_repo = event.source.issue.repository

        # Check if we have this repo
        referenced_by_repo = await github_repository.get_by_external_id(
            session, evt_repo.id
        )

        if not referenced_by_repo:
            # TODO: Support references from repositories that are not on Polar
            log.warn(
                "github.parse_issue_pull_request_reference.repo-not-found",
                ref_repo_id=evt_repo.id,
            )
            return

        # If mentioning Pull Request Exists on Polar
        referenced_by_pr = await github_pull_request.get_by(
            session,
            repository_id=referenced_by_repo.id,
            number=event.source.issue.number,
        )

        if not referenced_by_pr:
            # TODO: Create if missing
            log.warn(
                "github.parse_issue_pull_request_reference.pr-not-found",
                external_pr_id=event.source.issue.id,
            )
            return

        # Track mention
        await self.create_reference(
            session,
            issue_id=issue.id,
            pr_id=referenced_by_pr.id,
        )

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


github_reference = GitHubIssueReferencesService()
