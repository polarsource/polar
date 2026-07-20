from typing import Any
from urllib.parse import urlparse

import httpx

from polar.config import settings
from polar.exceptions import PolarRequestValidationError
from polar.kit.http import SSRFBlockedError, resolve_and_validate_ip
from polar.models.organization_sso_connection import OIDCAuthMethod

DISCOVERY_PATH = "/.well-known/openid-configuration"
REQUIRED_METADATA = (
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
    "id_token_signing_alg_values_supported",
)
TIMEOUT = 5.0


def discovery_endpoint(issuer: str) -> str:
    return f"{issuer.rstrip('/')}{DISCOVERY_PATH}"


def _issuer_error(msg: str, issuer: str) -> PolarRequestValidationError:
    return PolarRequestValidationError(
        [
            {
                "type": "invalid_oidc_issuer",
                "msg": msg,
                "loc": ("body", "configuration", "issuer"),
                "input": issuer,
            }
        ]
    )


async def _fetch_discovery_document(url: str, issuer: str) -> dict[str, Any]:
    hostname = urlparse(url).hostname
    assert hostname is not None, "issuer is validated as an https URL with a host"
    try:
        await resolve_and_validate_ip(hostname)
    except SSRFBlockedError as e:
        raise _issuer_error(f"Could not reach {url}.", issuer) from e

    try:
        async with httpx.AsyncClient(
            follow_redirects=False,
            timeout=TIMEOUT,
            headers={"User-Agent": settings.POLAR_USER_AGENT},
        ) as client:
            response = await client.get(url)
    except httpx.HTTPError as e:
        raise _issuer_error(f"Could not reach {url}.", issuer) from e

    if response.status_code != 200:
        raise _issuer_error(
            f"{url} returned HTTP {response.status_code}. "
            "Make sure this is the issuer URL of your identity provider.",
            issuer,
        )

    try:
        document = response.json()
    except ValueError as e:
        raise _issuer_error(
            f"{url} did not return a valid JSON document.", issuer
        ) from e

    if not isinstance(document, dict):
        raise _issuer_error(f"{url} did not return a valid JSON document.", issuer)

    return document


async def validate_oidc_configuration(issuer: str, auth_method: OIDCAuthMethod) -> None:
    """Probe the provider's discovery document and reject a configuration that
    can't be used to sign in, so the failure surfaces here and not at login."""
    url = discovery_endpoint(issuer)
    document = await _fetch_discovery_document(url, issuer)

    declared_issuer = document.get("issuer")
    if not isinstance(declared_issuer, str) or declared_issuer.rstrip(
        "/"
    ) != issuer.rstrip("/"):
        raise _issuer_error(
            f"The discovery document declares issuer `{declared_issuer}`.", issuer
        )

    missing = [key for key in REQUIRED_METADATA if not document.get(key)]
    if missing:
        raise _issuer_error(
            f"The discovery document is missing required fields: {', '.join(missing)}.",
            issuer,
        )

    if auth_method == OIDCAuthMethod.private_key_jwt:
        supported = document.get("token_endpoint_auth_methods_supported") or []
        if OIDCAuthMethod.private_key_jwt not in supported:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "unsupported_oidc_auth_method",
                        "msg": (
                            "This provider does not support the private_key_jwt "
                            "authentication method."
                        ),
                        "loc": ("body", "configuration", "auth_method"),
                        "input": auth_method,
                    }
                ]
            )
