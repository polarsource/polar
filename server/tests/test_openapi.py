import pathlib

import pytest
from httpx import AsyncClient
from openapi_kit.diff import compare
from openapi_kit.parser import OpenAPIParser

from polar.kit.versioning import APIVersion
from polar.version import V2027_01, VERSIONS


@pytest.mark.asyncio
@pytest.mark.parametrize("version", VERSIONS)
async def test_openapi(version: APIVersion, client: AsyncClient) -> None:
    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "Scope" in schema["components"]["schemas"]

    assert len(schema["webhooks"]) > 0
    assert schema["info"]["version"] == str(version)
    assert "subscription.migrated" in schema["webhooks"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "version", [pytest.param(v, id=str(v)) for v in VERSIONS if v != V2027_01]
)
async def test_current_openapi_frozen(version: APIVersion, client: AsyncClient) -> None:
    OPENAPI_FROZEN_MESSAGE = """
    The current API contract is frozen and must not contain contract changes,
    including backward-compatible additions.

    To fix this:
    - Target NEXT_API_VERSION for intentional API changes using @version(...).
    - Revert accidental contract changes affecting the current version.
    - Do not update openapi.*.json files unless releasing a new API version.

    See handbook/engineering/design-documents/api-versioning.mdx.
    """.strip()

    response = await client.get(f"{version}/openapi.json")
    assert response.status_code == 200

    actual = OpenAPIParser.from_dict(response.json())
    expected_file = pathlib.Path(__file__).parent / f"openapi.{version}.json"
    if not expected_file.exists():
        pytest.fail(
            f"Missing expected OpenAPI file: {expected_file}. Run uv run -m scripts.generate_openapi generate {version} > tests/openapi.{version}.json"
        )
    expected = OpenAPIParser.from_source(expected_file)

    diff = compare(expected, actual)
    assert len(diff.operation_changes) == 0, OPENAPI_FROZEN_MESSAGE
    assert len(diff.schema_changes) == 0, OPENAPI_FROZEN_MESSAGE
