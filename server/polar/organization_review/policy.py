import asyncio
import json
import time

import httpx
import structlog

from polar.config import settings

log = structlog.get_logger(__name__)

_DRIVE_EXPORT_URL = "https://www.googleapis.com/drive/v3/files/{file_id}/export"
_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

_cache: tuple[float, str] | None = None
_cache_lock = asyncio.Lock()


class AUPPolicyError(Exception):
    """Raised when the Acceptable Use Policy cannot be fetched."""


async def _get_access_token() -> str:
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2 import service_account

    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise AUPPolicyError("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.")

    try:
        info = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    except json.JSONDecodeError as e:
        raise AUPPolicyError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.") from e

    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=_SCOPES
    )
    # Credential refresh is synchronous (uses `requests`), so run it off the
    # event loop.
    await asyncio.to_thread(credentials.refresh, GoogleAuthRequest())
    token = credentials.token
    if not token:
        raise AUPPolicyError("Failed to obtain a Google access token.")
    return token


async def _download_policy() -> str:
    token = await _get_access_token()
    url = _DRIVE_EXPORT_URL.format(file_id=settings.ORGANIZATION_REVIEW_AUP_DOCUMENT_ID)
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            url,
            params={"mimeType": "text/markdown"},
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.status_code != 200:
        raise AUPPolicyError(
            f"Drive export failed ({response.status_code}): {response.text[:200]}"
        )
    return response.text


async def fetch_policy_content() -> str:
    """Return the Acceptable Use Policy, fetched from Google Drive and cached.

    The document is a live internal working document, returned verbatim. The
    review agent is told as much and reasons around any authoring notes,
    comments, or open questions it contains — we deliberately don't try to
    clean the source, since any structural assumption about it is fragile.

    The content is cached in-process for
    ``ORGANIZATION_REVIEW_AUP_CACHE_TTL_SECONDS``. If a refresh fails but a
    previously fetched value is available, the stale value is served so a
    transient Drive/Google outage doesn't block reviews.
    """
    global _cache
    ttl = settings.ORGANIZATION_REVIEW_AUP_CACHE_TTL_SECONDS

    cached = _cache
    if cached is not None and time.monotonic() - cached[0] < ttl:
        return cached[1]

    async with _cache_lock:
        cached = _cache
        if cached is not None and time.monotonic() - cached[0] < ttl:
            return cached[1]

        try:
            content = await _download_policy()
        except Exception as e:
            if cached is not None:
                log.warning(
                    "organization_review.policy.refresh_failed",
                    error=str(e),
                )
                return cached[1]
            raise

        _cache = (time.monotonic(), content)
        return content
