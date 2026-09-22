import json
import time
from collections.abc import Iterator, Sequence
from typing import Annotated, Any
from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import Depends

from polar.config import settings
from polar.exceptions import PolarError
from polar.integrations.tinybird.client import TinybirdRequestError


class VoidInfrastructureUnavailable(PolarError):
    def __init__(self) -> None:
        super().__init__("Void event storage is not configured", 503)


def get_token(*, local: bool = False) -> str:
    if settings.VOID_TINYBIRD_API_TOKEN:
        return settings.VOID_TINYBIRD_API_TOKEN
    if (
        local
        and (settings.is_development() or settings.is_testing())
        and urlparse(settings.VOID_TINYBIRD_API_URL).hostname
        in {"localhost", "127.0.0.1", "::1"}
    ):
        response = httpx.get(f"{settings.VOID_TINYBIRD_API_URL}/tokens", timeout=10)
        response.raise_for_status()
        return str(response.json()["admin_token"])
    raise VoidInfrastructureUnavailable()


class TinybirdApi:
    def __init__(self, *, base_url: str, token: str) -> None:
        self.client = httpx.Client(
            base_url=base_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=httpx.Timeout(50, connect=10),
        )

    def close(self) -> None:
        self.client.close()

    def query(self, pipe: str, params: dict[str, Any]) -> dict[str, Any]:
        if not pipe.startswith("void_"):
            raise ValueError("Expected a Void Tinybird pipe")
        response = self.client.post(f"/v0/pipes/{pipe}.json", data=params)
        if not response.is_success:
            raise TinybirdRequestError.from_response(response, endpoint=pipe)
        return response.json()

    def ingest_batch(self, datasource: str, rows: Sequence[dict[str, Any]]) -> None:
        if datasource != "void_events":
            raise ValueError("Expected the Void event datasource")
        response = self.client.post(
            "/v0/events",
            params={"name": datasource, "wait": "true"},
            content="\n".join(json.dumps(row, allow_nan=False) for row in rows),
            headers={"Content-Type": "application/x-ndjson"},
        )
        if not response.is_success:
            raise TinybirdRequestError.from_response(response, endpoint=datasource)
        result = response.json()
        if result.get("quarantined_rows", 0) or result.get("successful_rows") != len(
            rows
        ):
            raise RuntimeError("Void event storage did not accept the entire batch")

    def delete_organization_events(self, organization_id: UUID) -> None:
        response = self.client.post(
            "/v0/datasources/void_events/delete",
            data={"delete_condition": f"organization_id = toUUID('{organization_id}')"},
        )
        if not response.is_success:
            raise TinybirdRequestError.from_response(response, endpoint="void_events")
        job_id = response.json().get("job_id")
        if job_id is None:
            return
        deadline = time.monotonic() + 300
        while time.monotonic() < deadline:
            response = self.client.get(f"/v0/jobs/{job_id}")
            if not response.is_success:
                raise TinybirdRequestError.from_response(response, endpoint="jobs")
            job = response.json()
            if job.get("status") == "done":
                return
            if job.get("status") == "error":
                raise RuntimeError(f"Void event cleanup failed: {job.get('error')}")
            time.sleep(0.25)
        raise TimeoutError("Timed out waiting for Void event cleanup")


def create_client(*, local: bool = False) -> TinybirdApi:
    return TinybirdApi(
        base_url=settings.VOID_TINYBIRD_API_URL,
        token=get_token(local=local),
    )


def get_client() -> Iterator[TinybirdApi]:
    client = create_client()
    try:
        yield client
    finally:
        client.close()


TinybirdClient = Annotated[TinybirdApi, Depends(get_client)]
