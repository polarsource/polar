from typing import Any, Optional, Type, TypeVar

from githubkit import GitHub, Response
from githubkit.rest.models import BasicError
from githubkit.typing import QueryParamTypes
from githubkit.utils import UNSET, exclude_unset

from polar.kit.schemas import Schema

T = TypeVar("T")


class RateLimit(Schema):
    limit: int
    remaining: int
    used: int
    reset: int


class GitHubApi:
    async def get_rate_limit(self, client: GitHub[Any]) -> RateLimit:
        r = await client.rest.rate_limit.async_get()
        return RateLimit(
            limit=r.parsed_data.resources.core.limit,
            remaining=r.parsed_data.resources.core.remaining,
            used=r.parsed_data.resources.core.used,
            reset=r.parsed_data.resources.core.reset,
        )

    # Support for custom headers
    # TODO: https://github.com/yanyongyu/githubkit/issues/29
    async def async_request_with_headers(
        self,
        client: GitHub[Any],
        url: str,
        response_model: Type[T],
        params: Optional[QueryParamTypes] = None,
        etag: str | None = None,
    ) -> Response[T]:
        headers = {
            "If-None-Match": etag if etag else UNSET,
            "X-GitHub-Api-Version": "2022-11-28",
        }

        return await client.arequest(
            "GET",
            url,
            params=params,
            headers=exclude_unset(headers),
            response_model=response_model,
            error_models={
                "404": BasicError,
                "410": BasicError,
            },
        )


github_api = GitHubApi()
