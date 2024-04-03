from __future__ import annotations

import structlog

from polar.exceptions import IntegrityError, ResourceNotFound
from polar.integrations.github.client import (
    get_app_installation_client,
)
from polar.integrations.github.service.issue import github_issue
from polar.locker import Locker
from polar.models import Issue, Organization, Repository
from polar.models.issue_dependency import IssueDependency
from polar.postgres import AsyncSession, sql

from .url import github_url

log = structlog.get_logger()


class GitHubIssueDependenciesService:
    async def sync_issue_dependencies(
        self,
        session: AsyncSession,
        locker: Locker,
        org: Organization,
        repo: Repository,
        issue: Issue,
    ) -> None:
        """
        sync_issue_dependencies will look through the body of the issue and find
        references to issues in other repos. It will then create IssueDependency
        records for each of those issues.
        """
        if not issue.body:
            log.info(
                "github.sync_issue_dependencies.skip_no_body",
                id=repo.id,
                name=repo.name,
                issue=issue.number,
            )
            return

        client = get_app_installation_client(org.safe_installation_id)
        log.info(
            "github.sync_issue_dependencies",
            id=repo.id,
            name=repo.name,
            issue=issue.number,
        )

        for dependency in github_url.parse_urls(issue.body):
            if (
                dependency.owner is None
                or dependency.owner == org.name
                or dependency.repo is None
            ):
                # this is a reference to an issue in the same org, we don't need to
                # sync it
                continue

            lock_key = f"sync_external_{dependency.owner}_{dependency.repo}_{dependency.number}"
            async with locker.lock(lock_key, timeout=10.0, blocking_timeout=10.0):
                try:
                    dependency_issue = (
                        await github_issue.sync_external_org_with_repo_and_issue(
                            session,
                            client=client,
                            org_name=dependency.owner,
                            repo_name=dependency.repo,
                            issue_number=dependency.number,
                        )
                    )
                except ResourceNotFound:
                    continue

            issue_dependency = IssueDependency(
                organization_id=org.id,
                repository_id=repo.id,
                dependent_issue_id=issue.id,
                dependency_issue_id=dependency_issue.id,
            )
            await self.create_dependency(session, issue_dependency)

    async def create_dependency(
        self, session: AsyncSession, ref: IssueDependency
    ) -> None:
        nested = await session.begin_nested()
        try:
            session.add(ref)
            await nested.commit()
            await session.commit()
            log.info(
                "issue.create_dependency.created",
                ref=ref,
            )
            return
        except IntegrityError:
            log.info(
                "issue.create_dependency.already_exists",
                ref=ref,
            )
            await nested.rollback()

        # Update (there are no columns to update, though)
        stmt = (
            sql.Update(IssueDependency)
            .where(
                IssueDependency.dependent_issue_id == ref.dependent_issue_id,
                IssueDependency.dependency_issue_id == ref.dependency_issue_id,
            )
            .values()
        )

        await session.execute(stmt)
        await session.commit()


github_dependency = GitHubIssueDependenciesService()
