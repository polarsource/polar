from enum import StrEnum
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Query, Request
from tagflow import tag, text

from polar.models import Pledge
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session

from ..components import datatable, input
from ..layout import layout

router = APIRouter()


class PledgeSortProperty(StrEnum): ...


class TransferColumn(datatable.DatatableAttrColumn[Pledge, PledgeSortProperty]):
    def render(self, request: Request, item: Pledge) -> None:
        with tag.button(
            classes="btn btn-sm btn-primary",
            hx_post=str(request.url_for("pledges:transfer", pledge_id=item.id)),
            hx_confirm="Are you sure you want to transfer this pledge to the organization?",
            hx_swap="outerHTML",
            hx_target="closest tr",
        ):
            text("Transfer")


@router.get("/", name="pledges:list")
async def list(
    request: Request,
    issue_reference: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    with layout(
        request,
        [
            ("Pledges", str(request.url_for("pledges:list"))),
        ],
        "pledges:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Pledges")

            # Search form
            with tag.form(
                method="POST",
                action=str(request.url_for("pledges:search")),
                hx_post=str(request.url_for("pledges:search")),
                hx_target="#search-results",
                hx_swap="innerHTML",
                classes="flex flex-col gap-4",
            ):
                with tag.div(classes="flex flex-row gap-2 items-end"):
                    with tag.div(classes="form-control flex-1"):
                        with tag.label(classes="label"):
                            with tag.span(classes="label-text"):
                                text("Issue Reference")
                        with tag.form(method="GET"):
                            with input.search(
                                "issue_reference",
                                issue_reference,
                            ):
                                pass

            # Results container
            with tag.div(id="search-results"):
                pass


@router.post("/search", name="pledges:search")
async def search(
    request: Request,
    issue_reference: Annotated[str, Form()],
    session: AsyncSession = Depends(get_db_session),
) -> None:
    # Get pledges for the issue reference
    pledges = await pledge_service.get_by_issue_reference(session, issue_reference)

    # Render results
    if not pledges:
        with tag.div(classes="alert"):
            with tag.span(classes="icon-info-circle"):
                pass
            text(f"No pledges found for issue reference: {issue_reference}")
        return

    with tag.div(classes="flex flex-col gap-4"):
        with tag.h2(classes="text-2xl"):
            text(f"Pledges for {issue_reference}")

        with datatable.Datatable(
            datatable.DatatableAttrColumn(
                "id",
                "ID",
            ),
            datatable.DatatableAttrColumn(
                "issue_reference",
                "Issue Reference",
            ),
            datatable.DatatableAttrColumn(
                "organization_id",
                "Organization",
            ),
            datatable.DatatableAttrColumn(
                "amount",
                "Amount",
            ),
            datatable.DatatableAttrColumn(
                "payment_id",
                "Payment ID",
            ),
            datatable.DatatableAttrColumn("state", "State"),
            datatable.DatatableAttrColumn(
                "created_at",
                "Created At",
            ),
            TransferColumn("Action"),
        ).render(request, pledges):
            pass


@router.post("/{pledge_id}/transfer", name="pledges:transfer")
async def transfer(
    request: Request,
    pledge_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    try:
        # Perform the admin transfer
        await pledge_service.admin_transfer(session, pledge_id)

        # Return success message row
        with tag.tr(classes="bg-green-50"):
            with tag.td(colspan="9", classes="text-center text-green-700"):
                text("✓ Pledge transferred successfully")
    except Exception as e:
        # Return error message row
        with tag.tr(classes="bg-red-50"):
            with tag.td(colspan="9", classes="text-center text-red-700"):
                text(f"✗ Transfer failed: {str(e)}")
