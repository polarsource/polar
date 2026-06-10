from fastapi import APIRouter, Request
from tagflow import tag, text

from ..layout import layout

router = APIRouter()


@router.get("/", name="support_cases:list")
async def list_cases(request: Request) -> None:
    with layout(
        request,
        [("Cases", str(request.url_for("support_cases:list")))],
        "support_cases:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Cases")
            with tag.div(classes="text-center py-12 text-base-content/50"):
                text("No cases yet.")
