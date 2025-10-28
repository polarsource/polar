from polar.routing import APIRouter

from .benefit_grant import router as benefit_grant_router
from .customer import router as customer_router
from .customer_meter import router as customer_meter_router
from .customer_seat import router as customer_seat_router
from .customer_session import router as customer_session_router
from .downloadables import router as downloadables_router
from .license_keys import router as license_keys_router
from .oauth_accounts import router as oauth_accounts_router
from .order import router as order_router
from .organization import router as organization_router
from .subscription import router as subscription_router
from .wallet import router as wallet_router

router = APIRouter(prefix="/customer-portal", tags=["customer_portal"])

router.include_router(benefit_grant_router)
router.include_router(customer_router)
router.include_router(customer_meter_router)
router.include_router(customer_seat_router)
router.include_router(customer_session_router)
router.include_router(downloadables_router)
router.include_router(license_keys_router)
router.include_router(oauth_accounts_router)
router.include_router(order_router)
router.include_router(organization_router)
router.include_router(subscription_router)
router.include_router(wallet_router)
