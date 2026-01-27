from polar.routing import APIRouter

from .endpoints import redirect

router = APIRouter()
router.get("/{client_secret}")(redirect)
