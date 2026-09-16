import asyncio
from typing import Any

from fastapi import Depends, Request

from polar.config import settings
from polar.kit.signer import get_published_signers
from polar.routing import APIRouter

from ..authorization_server import AuthorizationServer
from ..dependencies import get_authorization_server
from ..metadata import get_server_metadata

router = APIRouter(prefix="/.well-known", tags=["well_known"], include_in_schema=False)


@router.get("/jwks.json", name="well_known.jwks")
async def well_known_jwks() -> dict[str, Any]:
    signers = get_published_signers()
    keys = await asyncio.to_thread(lambda: [signer.public_jwk() for signer in signers])
    kids = {signer.kid for signer in signers}
    # The configured set still verifies id_tokens signed before the key moved.
    configured = settings.JWKS.as_dict(is_private=False)["keys"]
    return {"keys": [*keys, *(key for key in configured if key["kid"] not in kids)]}


@router.get("/oauth-authorization-server", name="well_known.oauth_authorization_server")
@router.get("/openid-configuration", name="well_known.openid_configuration")
async def well_known_openid_configuration(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> dict[str, Any]:
    def _url_for(name: str) -> str:
        return str(request.url_for(name))

    metadata = get_server_metadata(authorization_server, _url_for)
    return metadata.model_dump(exclude_unset=True)
