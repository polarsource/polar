from enum import StrEnum
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Query, Request
from markupflow import Fragment

from polar.models import Pledge
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session

from ..components import datatable, input
from ..layout import layout

router = APIRouter()


class PledgeSortProperty(StrEnum): ...


class TransferColumn(datatable.DatatableAttrColumn[Pledge, PledgeSortProperty]):
    def render(self, request: Request, item: Pledge) -> Fragment:
        fragment = Fragment()
        with fragment.button(
            class_="btn btn-sm btn-primary",
            hx_post=str(request.url_for("pledges:transfer", pledge_id=item.id)),
            hx_confirm="Are you sure you want to transfer this pledge to the organization?",
            hx_swap="outerHTML",
            hx_target="closest tr",
        ):
            fragment.text("Transfer")
        return fragment


@router.get("/", name="pledges:list")
async def list(
    request: Request,
    issue_reference: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> Fragment:
    with layout(
        request,
        [
            ("Pledges", str(request.url_for("pledges:list"))),
        ],
        "pledges:list",
    ) as page:
        with page.div(class_="flex flex-col gap-4"):
            with page.h1(class_="text-4xl"):
                page.text("Pledges")

            # Search form
            with page.form(
                method="POST",
                action=str(request.url_for("pledges:search")),
                hx_post=str(request.url_for("pledges:search")),
                hx_target="#search-results",
                hx_swap="innerHTML",
                class_="flex flex-col gap-4",
            ):
                with page.div(class_="flex flex-row gap-2 items-end"):
                    with page.div(class_="form-control flex-1"):
                        with page.label(class_="label"):
                            with page.span(class_="label-text"):
                                page.text("Issue Reference")
                        with page.form(method="GET"):
                            with input.search(
                                "issue_reference",
                                issue_reference,
                            ):
                                pass

            # Results container
            with page.div(id="search-results"):
                pass
        return page


@router.post("/search", name="pledges:search")
async def search(
    request: Request,
    issue_reference: Annotated[str, Form()],
    session: AsyncSession = Depends(get_db_session),
) -> Fragment:
    fragment = Fragment()
    # Get pledges for the issue reference
    pledges = await pledge_service.get_by_issue_reference(session, issue_reference)

    # Render results
    if not pledges:
        with fragment.div(class_="alert"):
            with fragment.span(class_="icon-info-circle"):
                pass
            fragment.text(f"No pledges found for issue reference: {issue_reference}")
        return fragment

    with fragment.div(class_="flex flex-col gap-4"):
        with fragment.h2(class_="text-2xl"):
            fragment.text(f"Pledges for {issue_reference}")

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
    return fragment


@router.post("/{pledge_id}/transfer", name="pledges:transfer")
async def transfer(
    request: Request,
    pledge_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> Fragment:
    fragment = Fragment()
    try:
        # Perform the admin transfer
        await pledge_service.admin_transfer(session, pledge_id)

        # Return success message row
        with fragment.tr(class_="bg-green-50"):
            with fragment.td(colspan="9", class_="text-center text-green-700"):
                fragment.text("✓ Pledge transferred successfully")
    except Exception as e:
        # Return error message row
        with fragment.tr(class_="bg-red-50"):
            with fragment.td(colspan="9", class_="text-center text-red-700"):
                fragment.text(f"✗ Transfer failed: {str(e)}")
    return fragment
