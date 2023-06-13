from __future__ import annotations

import structlog
import re
from polar.exceptions import IntegrityError
from githubkit.exception import RequestFailed
from polar.integrations.github.client import (
    get_app_installation_client,
    GitHub,
    AppInstallationAuthStrategy,
)
from polar.integrations.github import service
from polar.integrations.github.schemas import GithubIssueDependency
from polar.integrations.github.service.organization import github_organization
from polar.issue.schemas import IssueCreate
from polar.models.issue_dependency import IssueDependency
from polar.organization.schemas import OrganizationCreate
from polar.enums import Platforms

from polar.models import Organization, Repository, Issue
from polar.postgres import AsyncSession, sql
from polar.repository.schemas import RepositoryCreate


log = structlog.get_logger()


class GitHubIssueDependenciesService:
    issue_re = re.compile(
        r"(?P<owner>[a-z0-9][a-z0-9-]*)?(?:/(?P<repo>[a-z0-9_\.-]+))?#(?P<number>\d+)|(?:https?://(?:www\.)?github\.com/)?(?P<owner2>[a-z0-9][a-z0-9-]*)?(?:/(?P<repo2>[a-z0-9_\.-]+))?(?:#|/issues/)(?P<number2>\d+)",
        re.IGNORECASE,
    )

    def parse_dependencies(self, body: str) -> list[GithubIssueDependency]:
        """
        given a body of text, parse out the dependencies (i.e. issues in other repos
        that this body references)
        """
        dependencies = [
            GithubIssueDependency(
                raw=m.group(0),
                owner=m.group("owner") or m.group("owner2"),
                repo=m.group("repo") or m.group("repo2"),
                number=int(m.group("number") or m.group("number2")),
            )
            for m in self.issue_re.finditer(body)
        ]

        # Deduplicate the dependencies
        seen_dependencies = set()
        ret = []
        for dependency in dependencies:
            if dependency.canonical in seen_dependencies:
                continue
            seen_dependencies.add(dependency.canonical)
            ret.append(dependency)

        return ret

    async def sync_issue_dependencies(
        self, session: AsyncSession, org: Organization, repo: Repository, issue: Issue
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

        client = get_app_installation_client(org.installation_id)
        log.info(
            "github.sync_issue_dependencies",
            id=repo.id,
            name=repo.name,
            issue=issue.number,
        )

        for dependency in self.parse_dependencies(issue.body):
            if (
                dependency.owner is None
                or dependency.owner == org.name
                or dependency.repo is None
            ):
                # this is a reference to an issue in the same org, we don't need to
                # sync it
                continue

            try:
                _, _, dependency_issue = \
                    await github_organization.sync_external_org_with_repo_and_issue(
                        session,
                        client=client,
                        org_name=dependency.owner,
                        repo_name=dependency.repo,
                        issue_number=dependency.number
                    )
            except RequestFailed as e:
                # 404s are nothing to worry about, this could be a broken link
                if e.response.status_code == 404:
                    continue
                # re-raise other status codes
                raise e

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
