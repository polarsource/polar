from fastapi import APIRouter

from .dashboards import router as dashboards_router
from .endpoints import router as endpoints_router

router = APIRouter()
# Order matters: more-specific routes (`/dashboard`) must register
# before catch-all `/{id}` patterns in endpoints_router so FastAPI
# picks them first instead of trying to validate "dashboard" as a
# UUID4 and 422-ing.
router.include_router(dashboards_router)
router.include_router(endpoints_router)

__all__ = ["router"]
