from pathlib import Path

from fastapi import Depends, FastAPI, Request
from starlette.staticfiles import StaticFiles
from tagflow import TagResponse, tag, text

from .dependencies import get_admin
from .layout import layout
from .middlewares import SecurityHeadersMiddleware, TagflowMiddleware
from .organizations.endpoints import router as organizations_router

app = FastAPI(
    default_response_class=TagResponse,
    dependencies=[Depends(get_admin)],
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TagflowMiddleware)


app.mount(
    "/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static"
)
app.include_router(organizations_router, prefix="/organizations")


@app.get("/", name="index")
async def index(request: Request) -> None:
    with layout(request, [], "index"):
        with tag.h1():
            text("Dashboard")


__all__ = ["app"]
