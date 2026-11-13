import json
import os
import time
import uuid
from collections.abc import Generator
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from polar.config import settings
from polar.integrations.tinybird import service as tinybird_service
from polar.integrations.tinybird.client import TinybirdClient
from polar.integrations.tinybird.schemas import TinybirdEvent
from polar.metrics import queries_tinybird
from scripts.tinybird_test_workspace import (
    create_workspace,
    delete_workspace,
    deploy_schema,
    get_tokens,
    wait_for_ingestion,
)

TOKEN_ENV_VAR = "POLAR_TEST_TINYBIRD_TOKEN"
REQUIRED_ENV_VAR = "POLAR_TEST_TINYBIRD_REQUIRED"
TOKEN_FILE_ENV_VAR = "POLAR_TEST_TINYBIRD_TOKEN_FILE"


class SynchronousIngestTinybirdClient(TinybirdClient):
    """The Events API holds each write for about 4s to batch rows; an append doesn't."""

    async def ingest(
        self, datasource: str, events: list[TinybirdEvent], *, wait: bool = True
    ) -> None:
        if not events:
            return
        response = await self._write_client.post(
            "/v0/datasources",
            params={"name": datasource, "mode": "append", "format": "ndjson"},
            files={"ndjson": "\n".join(json.dumps(event) for event in events)},
        )
        response.raise_for_status()


def tinybird_available() -> bool:
    return (
        bool(os.environ.get(TOKEN_ENV_VAR))
        or os.environ.get(REQUIRED_ENV_VAR) == "true"
        or get_tokens() is not None
    )


@pytest.fixture(scope="session")
def tinybird_workspace() -> Generator[str]:
    """Yield a Tinybird workspace token, creating a throwaway workspace if needed."""
    shared_token = os.environ.get(TOKEN_ENV_VAR)
    if shared_token:
        yield shared_token
        return

    token_file_path = os.environ.get(TOKEN_FILE_ENV_VAR)
    if token_file_path:
        token_file = Path(token_file_path)
        error_file = token_file.with_suffix(".error")
        for _ in range(1200):
            if token_file.exists():
                yield token_file.read_text().strip()
                return
            if error_file.exists():
                raise RuntimeError(
                    f"Tinybird workspace preparation failed: {error_file.read_text()}"
                )
            time.sleep(0.1)
        raise RuntimeError("Timed out waiting for Tinybird workspace preparation")

    host = settings.TINYBIRD_API_URL
    tokens = get_tokens(host)
    if not tokens:
        if os.environ.get(REQUIRED_ENV_VAR) == "true":
            raise RuntimeError("Tinybird is required but is not running")
        pytest.skip("Tinybird not running")

    workspace_id, workspace_token = create_workspace(host, tokens)
    deploy_schema(host, workspace_token)
    wait_for_ingestion(host, workspace_token)

    yield workspace_token

    delete_workspace(host, workspace_id, tokens["user_token"])


@pytest.fixture(scope="session")
def tinybird_clickhouse_token(tinybird_workspace: str) -> str:
    """Create a WORKSPACE:READ_ALL token for ClickHouse interface access."""
    host = settings.TINYBIRD_API_URL
    token_name = f"clickhouse_read_{uuid.uuid4().hex[:8]}"
    response = httpx.post(
        f"{host}/v0/tokens",
        params={"name": token_name, "scope": "WORKSPACE:READ_ALL"},
        headers={"Authorization": f"Bearer {tinybird_workspace}"},
    )
    response.raise_for_status()
    return response.json()["token"]


@pytest.fixture
def tinybird_client(
    tinybird_workspace: str,
    tinybird_clickhouse_token: str,
) -> Generator[TinybirdClient]:
    client = SynchronousIngestTinybirdClient(
        api_url=settings.TINYBIRD_API_URL,
        clickhouse_url=settings.TINYBIRD_CLICKHOUSE_URL,
        api_token=tinybird_workspace,
        read_token=tinybird_workspace,
        clickhouse_username=settings.TINYBIRD_CLICKHOUSE_USERNAME,
        clickhouse_token=tinybird_clickhouse_token,
    )
    with (
        patch.object(tinybird_service, "client", client),
        patch.object(queries_tinybird, "tinybird_client", client),
    ):
        yield client


__all__ = [
    "tinybird_available",
    "tinybird_clickhouse_token",
    "tinybird_client",
    "tinybird_workspace",
]
