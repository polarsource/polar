import pathlib

import pytest
from httpx import AsyncClient
from openapi_kit.diff import compare
from openapi_kit.parser import OpenAPIParser

from polar.kit.versioning import APIVersion
from polar.version import CURRENT_API_VERSION, VERSIONS


@pytest.mark.asyncio
@pytest.mark.parametrize("version", VERSIONS)
async def test_openapi(version: APIVersion, client: AsyncClient) -> None:
    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "Scope" in schema["components"]["schemas"]

    assert len(schema["webhooks"]) > 0
    assert schema["info"]["version"] == str(version)


@pytest.mark.asyncio
async def test_current_openapi_frozen(client: AsyncClient) -> None:
    OPENAPI_FROZEN_MESSAGE = """
    The current API contract is frozen and must not contain contract changes,
    including backward-compatible additions.

    To fix this:
    - Target NEXT_API_VERSION for intentional API changes using @version(...).
    - Revert accidental contract changes affecting the current version.
    - Do not update openapi.current.json unless releasing a new API version.

    See handbook/engineering/design-documents/api-versioning.mdx.
    """.strip()

    response = await client.get(f"{CURRENT_API_VERSION}/openapi.json")
    assert response.status_code == 200

    actual = OpenAPIParser.from_dict(response.json())
    expected = OpenAPIParser.from_source(
        pathlib.Path(__file__).parent / "openapi.current.json"
    )

    diff = compare(expected, actual)
    assert len(diff.operation_changes) == 0, OPENAPI_FROZEN_MESSAGE
    assert len(diff.schema_changes) == 0, OPENAPI_FROZEN_MESSAGE
