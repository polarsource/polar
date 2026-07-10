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

# Committed snapshot of the public Acceptable Use Policy, served when the live
# document can't be fetched (Drive outage, misconfigured/absent service account,
# empty export) and nothing is cached yet. Keeps reviews running on a known-good,
# conservative policy instead of failing. Public policy only — never the internal
# working document (this is a public repo).
_FALLBACK_PATH = Path(__file__).parent / "acceptable-use-policy.fallback.mdx"

# When a refresh fails but a stale value exists, serve the stale value and only
# retry this often, so a sustained Drive outage doesn't make every review
# re-attempt the fetch (each paying a token refresh + HTTP timeout under the
# lock).
_FAILURE_RETRY_SECONDS = 60

_cache: tuple[float, str] | None = None
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
        # `from None`: the JSONDecodeError carries the raw JSON (a private key)
        # in `.doc`, which must not reach error tracking.
        raise AUPPolicyError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.") from None

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
    content = response.text
    if not content.strip():
        raise AUPPolicyError("Drive export returned an empty document.")
    return content


async def fetch_policy_content() -> str:
    """Return the Acceptable Use Policy, fetched from Google Drive and cached.

    The document is a live internal working document, returned verbatim. The
    review agent is told as much and reasons around any authoring notes,
    comments, or open questions it contains — we deliberately don't try to
    clean the source, since any structural assumption about it is fragile.

    The content is cached in-process for
    ``ORGANIZATION_REVIEW_AUP_CACHE_TTL_SECONDS``. If a refresh fails, the last
    good value is served when available, otherwise the committed public-policy
    fallback — so a Drive outage, an unset service account, or an empty export
    never blocks reviews. Either degraded path backs off before retrying.
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
            # Degrade gracefully: last-good value if we have one, else the
            # committed public-policy fallback.
            degraded = cached[1] if cached is not None else _load_fallback_policy()
            log.warning(
                "organization_review.policy.refresh_failed",
                error=str(e),
                served=("stale_cache" if cached is not None else "fallback"),
            )
            # Back off: age the timestamp so the next retry is
            # ~_FAILURE_RETRY_SECONDS away instead of on the very next call.
            retry_at = now - ttl + _FAILURE_RETRY_SECONDS
            _cache = (min(now, retry_at), degraded)
            return degraded

        _cache = (time.monotonic(), content)
        return content
