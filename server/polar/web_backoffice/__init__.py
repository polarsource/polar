from pathlib import Path

from fastapi import Depends, FastAPI, Request
from starlette.staticfiles import StaticFiles
from tagflow import TagResponse, tag, text

from .decorators import layout
from .dependencies import get_admin
from .middlewares import TagflowMiddleware
from .organizations.endpoints import router as organizations_router

app = FastAPI(default_response_class=TagResponse, dependencies=[Depends(get_admin)])
app.add_middleware(TagflowMiddleware)

app.mount(
    "/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static"
)
app.include_router(organizations_router, prefix="/organizations")


@app.get("/", name="index")
@layout(["Dashboard"], "index")
async def index(request: Request) -> None:
    with tag.h1():
        text("Dashboard")


__all__ = ["app"]
