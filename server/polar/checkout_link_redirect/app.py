from fastapi import FastAPI

from polar.observability.http_metrics import exclude_app_from_metrics

from .endpoints import router

app = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

exclude_app_from_metrics(app)
app.include_router(router)
