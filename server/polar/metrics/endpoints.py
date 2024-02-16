import gzip
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    generate_latest,
)
from starlette.requests import Request
from starlette.responses import Response

from polar.config import settings

security = HTTPBasic()

basic_authed = Annotated[str, "verified"]

router = APIRouter(tags=["metrics"], include_in_schema=False)


def verification(creds: HTTPBasicCredentials = Depends(security)) -> None:
    username = creds.username
    password = creds.password

    if username == "metrics" and password == settings.PROMETHEUS_EXPORTER_HTTP_PASSWORD:
        return None

    raise HTTPException(
        status_code=401,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Basic"},
    )


@router.get("/metrics")
def prometheus_metrics(
    request: Request,
    should_gzip: bool = False,
    include_in_schema: bool = False,
    basic: None = Depends(verification),
) -> Response:
    if should_gzip and "gzip" in request.headers.get("Accept-Encoding", ""):
        resp = Response(content=gzip.compress(generate_latest()))
        resp.headers["Content-Type"] = CONTENT_TYPE_LATEST
        resp.headers["Content-Encoding"] = "gzip"
    else:
        resp = Response(content=generate_latest())
        resp.headers["Content-Type"] = CONTENT_TYPE_LATEST

    return resp
