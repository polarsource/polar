from typing import Any

from fastapi import Depends, Request

from polar.config import settings
from polar.kit.routing import APIRouter

from ..authorization_server import AuthorizationServer
from ..dependencies import get_authorization_server
from ..metadata import get_server_metadata

router = APIRouter(prefix="/.well-known", tags=["well_known"])


@router.get("/jwks.json", name="well_known.jwks")
async def well_known_jwks() -> dict[str, Any]:
    return settings.JWKS.as_dict(is_private=False)


@router.get("/openid-configuration", name="well_known.openid_configuration")
async def well_known_openid_configuration(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> dict[str, Any]:
    def _url_for(name: str) -> str:
        return str(request.url_for(name))

    metadata = get_server_metadata(authorization_server, _url_for)
    return metadata.model_dump(exclude_unset=True)
