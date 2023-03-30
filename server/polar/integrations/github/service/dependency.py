from __future__ import annotations
import asyncio
from typing import Any, List, Set, Union
from uuid import UUID
from githubkit import Response
from pydantic import parse_obj_as

import structlog
import re
from polar.exceptions import IntegrityError
from polar.integrations.github.client import get_app_installation_client
import polar.integrations.github.client as github
from polar.integrations.github import service
from polar.integrations.github.schemas import GithubIssueDependency
from polar.kit import utils
from polar.issue.schemas import IssueCreate
from polar.models.issue_dependency import IssueDependency
from polar.organization.schemas import OrganizationCreate
from polar.enums import Platforms

from polar.models import Organization, Repository
from polar.models.issue import Issue
from polar.models.issue_reference import (
    ExternalGitHubCommitReference,
    ExternalGitHubPullRequestReference,
    IssueReference,
    ReferenceType,
)
from polar.postgres import AsyncSession, sql
from polar.repository.schemas import RepositoryCreate
from polar.worker import enqueue_job
from fastapi.encoders import jsonable_encoder


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

        client = get_app_installation_client(org.installation_id)

        log.info(
            "github.sync_issue_dependencies",
            id=repo.id,
            name=repo.name,
            issue=issue.number,
        )

        if issue.body:
            for dependency in self.parse_dependencies(issue.body):
                print("DEP", dependency)

                if (
                    dependency.owner is None
                    or dependency.owner == org.name
                    or dependency.repo is None
                ):
                    # this is a reference to an issue in the same org, we don't need to
                    # sync it
                    continue

                repo_response = await client.rest.repos.async_get(
                    dependency.owner, dependency.repo
                )
                github_repo = repo_response.parsed_data

                owner = github_repo.owner

                is_personal = owner.type.lower() == "user"
                org_schema = OrganizationCreate(
                    platform=Platforms.github,
                    name=owner.login,
                    external_id=owner.id,
                    avatar_url=owner.avatar_url,
                    is_personal=is_personal,
                )
                organization = await service.github_organization.upsert(
                    session, org_schema
                )

                repo_schema = RepositoryCreate(
                    platform=Platforms.github,
                    external_id=github_repo.id,
                    organization_id=organization.id,
                    name=github_repo.name,
                    is_private=github_repo.private,
                )
                repository = await service.github_repository.upsert(
                    session, repo_schema
                )

                issue_response = await client.rest.issues.async_get(
                    dependency.owner, dependency.repo, dependency.number
                )
                github_issue = issue_response.parsed_data

                issue_schema = IssueCreate.from_github(
                    github_issue,
                    organization_id=organization.id,
                    repository_id=repository.id,
                )
                dependency_issue = await service.github_issue.upsert(
                    session, issue_schema
                )

                issue_dependency = IssueDependency(
                    dependent_issue_id=issue.id, dependency_issue_id=dependency_issue.id
                )
                session.add(issue_dependency)

            await session.commit()


github_dependency = GitHubIssueDependenciesService()
