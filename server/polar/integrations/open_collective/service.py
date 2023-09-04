import contextlib
import dataclasses
from collections.abc import AsyncGenerator

import httpx

from polar.config import settings
from polar.exceptions import PolarError


@dataclasses.dataclass
class OpenCollectiveCollective:
    slug: str
    host_slug: str
    isActive: bool
    isApproved: bool
    isArchived: bool
    isFrozen: bool

    @property
    def is_eligible(self) -> bool:
        return (
            self.isActive
            and self.isApproved
            and not self.isArchived
            and not self.isFrozen
            and self.host_slug == "opensource"
        )


class OpenCollectiveServiceError(PolarError):
    pass


class OpenCollectiveAPIError(OpenCollectiveServiceError):
    pass


class CollectiveNotFoundError(OpenCollectiveServiceError):
    def __init__(self, slug: str):
        super().__init__(f"No collective found with slug {slug}.")


class OpenCollectiveService:
    def __init__(self, personal_token: str | None = None) -> None:
        self.personal_token = personal_token

    def create_dashboard_link(self, slug: str) -> str:
        return f"https://opencollective.com/{slug}"

    async def get_collective(self, slug: str) -> OpenCollectiveCollective:
        async with self._get_graphql_client() as client:
            query = """
                query GetCollective($slug: String!) {
                    collective(slug: $slug) {
                        slug
                        host {
                            slug
                        }
                        isActive
                        isApproved
                        isArchived
                        isFrozen
                    }
                }
            """

            response = await client.post(
                "/",
                json={
                    "query": query,
                    "operationName": "GetCollective",
                    "variables": {"slug": slug},
                },
            )

            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise OpenCollectiveAPIError(str(e)) from e

            json = response.json()

            if "errors" in json:
                raise CollectiveNotFoundError(slug)

            collective = json["data"]["collective"]
            host = collective.pop("host")
            return OpenCollectiveCollective(**collective, host_slug=host["slug"])

    @contextlib.asynccontextmanager
    async def _get_graphql_client(self) -> AsyncGenerator[httpx.AsyncClient, None]:
        headers = {}
        if self.personal_token is not None:
            headers["Personal-Token"] = self.personal_token
        async with httpx.AsyncClient(
            base_url="https://api.opencollective.com/graphql/v2", headers=headers
        ) as client:
            yield client


open_collective = OpenCollectiveService(settings.OPEN_COLLECTIVE_PERSONAL_TOKEN)
