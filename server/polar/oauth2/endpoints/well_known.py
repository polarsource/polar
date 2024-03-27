from typing import Any

from polar.config import settings
from polar.kit.routing import APIRouter

router = APIRouter(prefix="/.well-known", tags=["well_known"])


@router.get("/jwks.json", name="well_known.jwks")
async def well_known_jwks() -> dict[str, Any]:
    return settings.JWKS.as_dict(is_private=False)
