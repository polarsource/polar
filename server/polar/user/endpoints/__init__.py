from polar.customer_portal.endpoints.downloadables import router as downloadables_router
from polar.customer_portal.endpoints.license_keys import router as license_keys_router
from polar.customer_portal.endpoints.order import router as order_router
from polar.customer_portal.endpoints.subscription import router as subscription_router
from polar.routing import APIRouter

from .user import router as user_router

router = APIRouter(prefix="/users", tags=["users"])

router.include_router(user_router)

# Include customer portal endpoints for backwards compatibility
router.include_router(order_router, deprecated=True, include_in_schema=False)
router.include_router(subscription_router, deprecated=True, include_in_schema=False)
router.include_router(downloadables_router, deprecated=True, include_in_schema=False)
router.include_router(license_keys_router, deprecated=True, include_in_schema=False)
