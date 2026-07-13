import asyncio
import functools
import json
import time
from pathlib import Path

import httpx
import structlog
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from polar.config import settings

log = structlog.get_logger(__name__)

_DRIVE_EXPORT_URL = "https://www.googleapis.com/drive/v3/files/{file_id}/export"
_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Public AUP, served when the live doc is unavailable. Public only: the internal
# working doc must never be committed to this public repo.
_FALLBACK_PATH = Path(__file__).parent / "acceptable-use-policy.fallback.mdx"

# Retry cadence while serving a degraded (stale or fallback) value.
_FAILURE_RETRY_SECONDS = 60

# (timestamp, content, source="live"|"fallback"); source keeps a persistent
# fallback visible in logs instead of looking like stale cache.
_cache: tuple[float, str, str] | None = None
_cache_lock = asyncio.Lock()


class AUPPolicyError(Exception):
    """Raised when the Acceptable Use Policy cannot be fetched."""


@functools.cache
def _load_fallback_policy() -> str:
    return _FALLBACK_PATH.read_text(encoding="utf-8")


async def _get_access_token() -> str:
    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise AUPPolicyError("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.")

    try:
        info = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    except json.JSONDecodeError:
        # `from None`: JSONDecodeError.doc holds the raw key; keep it out of logs.
        raise AUPPolicyError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.") from None

    try:
        credentials = service_account.Credentials.from_service_account_info(
            info, scopes=_SCOPES
        )
        # google-auth refresh is sync (uses `requests`).
        await asyncio.to_thread(credentials.refresh, GoogleAuthRequest())
    except Exception:
        # `from None`: google-auth errors may carry key-adjacent detail.
        raise AUPPolicyError(
            "Failed to authenticate the Google service account."
        ) from None
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
    content = response.text
    if not content.strip():
        raise AUPPolicyError("Drive export returned an empty document.")
    return content


async def fetch_policy_content() -> str:
    """Return the Acceptable Use Policy, fetched live from Google Drive and cached.

    Returned verbatim: the doc is a live working document and the agent reasons
    around its authoring notes rather than us guessing at its structure.

    Cached in-process for ``ORGANIZATION_REVIEW_AUP_CACHE_TTL_SECONDS``. On
    failure it degrades to the last live value, or the committed fallback, so a
    Drive outage, unset service account, or empty export never blocks reviews.
    """
    global _cache
    ttl = settings.ORGANIZATION_REVIEW_AUP_CACHE_TTL_SECONDS
    now = time.monotonic()

    cached = _cache
    if cached is not None and now - cached[0] < ttl:
        return cached[1]

    async with _cache_lock:
        now = time.monotonic()
        cached = _cache
        if cached is not None and now - cached[0] < ttl:
            return cached[1]

        try:
            content = await _download_policy()
        except Exception as e:
            if cached is not None and cached[2] == "live":
                degraded, source = cached[1], "live"
            else:
                degraded, source = _load_fallback_policy(), "fallback"
            log.warning(
                "organization_review.policy.refresh_failed",
                error=str(e),
                served=("stale_cache" if source == "live" else "fallback"),
            )
            # Age the timestamp so the value reads fresh for _FAILURE_RETRY_SECONDS,
            # then we retry instead of refetching on every call.
            _cache = (now - ttl + _FAILURE_RETRY_SECONDS, degraded, source)
            return degraded

        _cache = (time.monotonic(), content, "live")
        return content
