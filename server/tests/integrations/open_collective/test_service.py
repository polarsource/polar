import json

import httpx
import pytest
import respx

from polar.integrations.open_collective.service import (
    CollectiveNotFoundError,
    OpenCollectiveAPIError,
    open_collective,
)


@pytest.fixture
def open_collective_graphql_mock(respx_mock: respx.MockRouter) -> respx.Route:
    return respx_mock.post("https://api.opencollective.com/graphql/v2/")


@pytest.mark.asyncio
async def test_get_collective_api_error(
    open_collective_graphql_mock: respx.Route,
) -> None:
    open_collective_graphql_mock.mock(return_value=httpx.Response(503))
    with pytest.raises(OpenCollectiveAPIError):
        await open_collective.get_collective("babel")


@pytest.mark.asyncio
async def test_get_collective_collective_not_found(
    open_collective_graphql_mock: respx.Route,
) -> None:
    with open(
        "tests/fixtures/cassettes/open_collective/collective/not_found.json"
    ) as f:
        cassette = json.loads(f.read())
    open_collective_graphql_mock.mock(return_value=httpx.Response(200, json=cassette))
    with pytest.raises(CollectiveNotFoundError):
        await open_collective.get_collective("babel")


@pytest.mark.asyncio
async def test_get_collective(
    open_collective_graphql_mock: respx.Route,
) -> None:
    with open("tests/fixtures/cassettes/open_collective/collective/eligible.json") as f:
        cassette = json.loads(f.read())
    open_collective_graphql_mock.mock(return_value=httpx.Response(200, json=cassette))
    collective = await open_collective.get_collective("babel")

    assert collective.slug == "babel"
    assert collective.host_slug == "opensource"
