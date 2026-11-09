from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Request
from tagflow import tag, text

from polar.exceptions import PolarError
from polar.observability.http_metrics import exclude_app_from_metrics

from .auth.endpoints import router as auth_router
from .benefits.endpoints import router as benefits_router
from .customers.endpoints import router as customers_router
from .dependencies import get_admin, get_legacy_admin
from .email_logs.endpoints import router as email_logs_router
from .exception_handlers import backoffice_polar_exception_handler
from .external_events.endpoints import router as external_events_router
from .feedbacks.endpoints import router as feedbacks_router
from .impersonation.endpoints import router as impersonation_router
from .layout import layout
from .merchant_migrations.endpoints import router as merchant_migrations_router
from .middlewares import SecurityHeadersMiddleware, TagflowMiddleware
from .orders.endpoints import router as orders_router
from .organizations_v2.endpoints import router as organizations_v2_router
from .payout_accounts.endpoints import router as payout_accounts_router
from .payouts.endpoints import router as payouts_router
from .products.endpoints import router as products_router
from .responses import TagResponse
from .subscriptions.endpoints import router as subscriptions_router
from .support_cases.endpoints import router as support_cases_router
from .tasks.endpoints import router as tasks_router
from .users.endpoints import router as users_router
from .versioned_static import VersionedStaticFiles
from .webhooks.endpoints import router as webhooks_router

app = FastAPI(
    default_response_class=TagResponse,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# Exclude backoffice from HTTP metrics (not sent to Grafana Cloud)
exclude_app_from_metrics(app)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TagflowMiddleware)

app.add_exception_handler(PolarError, backoffice_polar_exception_handler)


app.mount(
    "/static",
    VersionedStaticFiles(directory=Path(__file__).parent / "static"),
    name="static",
)
app.include_router(auth_router)
protected_router = APIRouter(dependencies=[Depends(get_admin)])
protected_router.include_router(users_router, prefix="/users")
protected_router.include_router(
    organizations_v2_router
)  # Primary organizations interface
protected_router.include_router(customers_router, prefix="/customers")
protected_router.include_router(benefits_router, prefix="/benefits")
protected_router.include_router(products_router, prefix="/products")
protected_router.include_router(
    merchant_migrations_router, prefix="/merchant-migrations"
)
protected_router.include_router(email_logs_router, prefix="/email-logs")
protected_router.include_router(external_events_router, prefix="/external-events")
protected_router.include_router(tasks_router, prefix="/tasks")
protected_router.include_router(subscriptions_router, prefix="/subscriptions")
protected_router.include_router(orders_router, prefix="/orders")
protected_router.include_router(payouts_router, prefix="/payouts")
protected_router.include_router(payout_accounts_router, prefix="/payout-accounts")
app.include_router(
    impersonation_router,
    prefix="/impersonation",
    dependencies=[Depends(get_legacy_admin)],
)
protected_router.include_router(webhooks_router, prefix="/webhooks")
protected_router.include_router(feedbacks_router, prefix="/feedbacks")
protected_router.include_router(support_cases_router, prefix="/support-cases")


@protected_router.get("/", name="index")
async def index(request: Request) -> None:
    with layout(request, [], "index"):
        with tag.h1():
            text("Backoffice Dashboard")


app.include_router(protected_router)

__all__ = ["app"]
