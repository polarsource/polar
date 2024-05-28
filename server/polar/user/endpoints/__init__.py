from polar.kit.routing import APIRouter

from .order import router as order_router
from .user import router as user_router

router = APIRouter(prefix="/users", tags=["users"])

router.include_router(user_router)
router.include_router(order_router)
