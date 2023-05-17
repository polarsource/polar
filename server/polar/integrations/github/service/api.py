from typing import Optional, Type, TypeVar
from githubkit import GitHub, Response
from githubkit.typing import QueryParamTypes

from githubkit.utils import UNSET, exclude_unset
from githubkit.rest.models import BasicError

T = TypeVar("T")

class GitHubApi:
    # Support for custom headers
    # TODO: https://github.com/yanyongyu/githubkit/issues/29
    async def async_request_with_headers(
        self,
        client: GitHub,
        url: str,
        response_model: Type[T],
        params: Optional[QueryParamTypes] = None,
        etag: str | None = None
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
