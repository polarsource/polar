from polar.kit.routing import APIRouter

from .user import router as user_router

router = APIRouter(prefix="/users", tags=["users"])

router.include_router(user_router)
