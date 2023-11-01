from collections.abc import Sequence
from typing import Any, Literal

import structlog
from githubkit import GitHub, Paginator

from polar.enums import Platforms
from polar.models import Organization, PullRequest, Repository
from polar.postgres import AsyncSession
from polar.pull_request.hooks import PullRequestHook, pull_request_upserted
from polar.pull_request.schemas import FullPullRequestCreate, MinimalPullRequestCreate
from polar.pull_request.service import PullRequestService, full_pull_request

from .. import client as github
from .paginated import ErrorCount, SyncedCount, github_paginated_service

log = structlog.get_logger()


class GithubPullRequestService(PullRequestService):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> PullRequest | None:
        return await self.get_by_platform(session, Platforms.github, external_id)

    async def store_simple(
        self,
        session: AsyncSession,
        *,
        data: github.rest.PullRequestSimple,
        organization: Organization,
        repository: Repository,
    ) -> PullRequest:
        records = await self.store_many_simple(
            session,
            data=[data],
            organization=organization,
            repository=repository,
        )
        return records[0]

    async def store_many_simple(
        self,
        session: AsyncSession,
        *,
        data: Sequence[github.rest.PullRequestSimple],
        organization: Organization,
        repository: Repository,
    ) -> Sequence[PullRequest]:
        def parse(pr: github.rest.PullRequestSimple) -> MinimalPullRequestCreate:
            return MinimalPullRequestCreate.minimal_pull_request_from_github(
                pr, organization, repository
            )

        create_schemas = [parse(pr) for pr in data]
        if not create_schemas:
            log.warning(
                "github.pull_request",
                error="no pull requests to store",
                organization_id=organization.id,
                repository_id=repository.id,
            )
            return []

        res = await self.upsert_many(
            session,
            create_schemas,
            constraints=[PullRequest.external_id],
            mutable_keys=MinimalPullRequestCreate.__mutable_keys__,
        )

        for r in res:
            await pull_request_upserted.call(PullRequestHook(session, r))

        return res

    async def store_full(
        self,
        session: AsyncSession,
        data: github.rest.PullRequest
        | github.webhooks.PullRequestOpenedPropPullRequest,
        organization: Organization,
        repository: Repository,
    ) -> PullRequest:
        records = await self.store_many_full(
            session,
            [data],
            organization=organization,
            repository=repository,
        )
        return records[0]

    async def store_many_full(
        self,
        session: AsyncSession,
        data: Sequence[
            github.rest.PullRequest
            | github.webhooks.PullRequest
            | github.webhooks.PullRequestOpenedPropPullRequest
            | github.webhooks.PullRequestClosedPropPullRequest
            | github.webhooks.PullRequestReopenedPropPullRequest,
        ],
        organization: Organization,
        repository: Repository,
    ) -> Sequence[PullRequest]:
        def parse(
            pr: github.rest.PullRequest
            | github.webhooks.PullRequest
            | github.webhooks.PullRequestOpenedPropPullRequest
            | github.webhooks.PullRequestClosedPropPullRequest
            | github.webhooks.PullRequestReopenedPropPullRequest,
        ) -> FullPullRequestCreate:
            return FullPullRequestCreate.full_pull_request_from_github(
                pr, organization, repository
            )

        create_schemas = [parse(pr) for pr in data]
        if not create_schemas:
            log.warning(
                "github.pull_request",
                error="no pull requests to store",
                organization_id=organization.id,
                repository_id=repository.id,
            )
            return []

        res = await full_pull_request.upsert_many(
            session,
            create_schemas,
            constraints=[PullRequest.external_id],
            mutable_keys=FullPullRequestCreate.__mutable_keys__,
        )

        for r in res:
            await pull_request_upserted.call(PullRequestHook(session, r))

        return res

    async def sync_pull_request(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        number: int,
        client: GitHub[Any],
    ) -> PullRequest | None:
        gh_pull = await client.rest.pulls.async_get(
            owner=organization.name, repo=repository.name, pull_number=number
        )
        if not gh_pull:
            return None

        pull = await self.store_full(
            session, gh_pull.parsed_data, organization, repository
        )

        return pull

    async def sync_pull_requests(
        self,
        session: AsyncSession,
        organization: Organization,
        repository: Repository,
        state: Literal["open", "closed", "all"] = "open",
        sort: Literal["created", "updated", "popularity", "long-running"] = "updated",
        direction: Literal["asc", "desc"] = "desc",
        per_page: int = 30,
        crawl_with_installation_id: int
        | None = None,  # Override which installation to use when crawling
    ) -> tuple[SyncedCount, ErrorCount]:
        installation_id = (
            crawl_with_installation_id
            if crawl_with_installation_id
            else organization.safe_installation_id
        )

        client = github.get_app_installation_client(installation_id)

        paginator: Paginator[github.rest.PullRequestSimple] = client.paginate(
            client.rest.pulls.async_list,  # type: ignore
            owner=organization.name,
            repo=repository.name,
            state=state,
            sort=sort,
            direction=direction,
            per_page=per_page,
        )

        synced, errors = await github_paginated_service.store_paginated_resource(
            session,
            paginator=paginator,
            store_resource_method=github_pull_request.store_simple,
            organization=organization,
            repository=repository,
            resource_type="pull_request",
        )
        return (synced, errors)


github_pull_request = GithubPullRequestService(PullRequest)
