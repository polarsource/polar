import contextlib
import uuid
from collections.abc import Generator
from datetime import UTC, datetime
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload
from tagflow import classes, tag, text

from polar.enums import PayoutAccountType
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Organization, PayoutAccount
from polar.organization.repository import OrganizationRepository
from polar.payout_account.repository import PayoutAccountRepository
from polar.payout_account.service import payout_account as payout_account_service
from polar.postgres import AsyncSession, get_db_read_session, get_db_session

from ..components import button, datatable, description_list, input
from ..layout import layout
from ..organizations_v2.views.modals import DeletePayoutAccountModal
from ..responses import HXRedirectResponse
from ..toast import add_toast
from .forms import DeletePayoutAccountForm

logger = structlog.get_logger()

router = APIRouter()


@contextlib.contextmanager
def payout_account_type_badge(type: PayoutAccountType) -> Generator[None]:
    with tag.div(classes="badge"):
        if type == PayoutAccountType.stripe:
            classes("badge-primary")
        else:
            classes("badge-secondary")
        text(type.get_display_name())
    yield


class PayoutAccountTypeColumn(datatable.DatatableAttrColumn[PayoutAccount, Any]):
    def render(self, request: Request, item: PayoutAccount) -> Generator[None] | None:
        with payout_account_type_badge(item.type):
            pass
        return None


@router.get("/", name="payout_accounts:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    query: Annotated[str | None, BeforeValidator(empty_str_to_none), Query()] = None,
    type: Annotated[
        PayoutAccountType | None,
        BeforeValidator(empty_str_to_none),
        Query(),
    ] = None,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = PayoutAccountRepository.from_session(session)
    statement = repository.get_base_statement(include_deleted=True)

    if query is not None:
        try:
            query_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(
                    PayoutAccount.id == query_uuid,
                    PayoutAccount.id.in_(
                        select(Organization.payout_account_id).where(
                            Organization.id == query_uuid
                        )
                    ),
                )
            )
        except ValueError:
            ilike_term = f"%{query}%"
            statement = statement.where(
                or_(
                    PayoutAccount.email.ilike(ilike_term),
                    PayoutAccount.stripe_id.ilike(ilike_term),
                )
            )

    if type is not None:
        statement = statement.where(PayoutAccount.type == type)

    statement = statement.order_by(PayoutAccount.created_at.desc())

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [("Payout Accounts", str(request.url_for("payout_accounts:list")))],
        "payout_accounts:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Payout Accounts")

            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    "query",
                    query,
                    placeholder="Search by email, Stripe ID, organization ID, or ID...",
                ):
                    pass
                with input.select(
                    [
                        ("All Types", ""),
                        *[(t.get_display_name(), t.value) for t in PayoutAccountType],
                    ],
                    type.value if type else "",
                    name="type",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            with datatable.Datatable[PayoutAccount, Any](
                datatable.DatatableAttrColumn(
                    "id",
                    "ID",
                    href_route_name="payout_accounts:get",
                    clipboard=True,
                ),
                PayoutAccountTypeColumn("type", "Type"),
                datatable.DatatableAttrColumn("stripe_id", "Stripe ID", clipboard=True),
                datatable.DatatableAttrColumn("email", "Email", clipboard=True),
                datatable.DatatableAttrColumn("country", "Country"),
                datatable.DatatableAttrColumn("currency", "Currency"),
                datatable.DatatableDateTimeColumn("created_at", "Created At"),
                datatable.DatatableDateTimeColumn("deleted_at", "Deleted At"),
            ).render(request, items):
                pass

            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="payout_accounts:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = PayoutAccountRepository.from_session(session)
    payout_account = await repository.get_by_id(
        id, options=(joinedload(PayoutAccount.admin),), include_deleted=True
    )

    if payout_account is None:
        raise HTTPException(status_code=404)

    organization_repository = OrganizationRepository.from_session(session)
    linked_organizations = await organization_repository.get_all_by_payout_account(
        payout_account.id
    )

    with layout(
        request,
        [
            (
                f"Payout Account {payout_account.id}",
                str(request.url),
            ),
            ("Payout Accounts", str(request.url_for("payout_accounts:list"))),
        ],
        "payout_accounts:get",
    ):
        with tag.div(classes="flex flex-col gap-8"):
            with tag.div(classes="flex items-center gap-4"):
                with tag.h1(classes="text-4xl"):
                    text(f"Payout Account {payout_account.id}")
                if payout_account.deleted_at:
                    with tag.div(classes="badge badge-error"):
                        text("Deleted")

            # Payout account details
            with tag.div(classes="card card-border w-full shadow-sm"):
                with tag.div(classes="card-body"):
                    with tag.div(classes="flex justify-between items-center"):
                        with tag.h2(classes="card-title"):
                            text("Payout Account Details")
                        if (
                            payout_account.deleted_at is None
                            and payout_account.type == PayoutAccountType.stripe
                            and payout_account.stripe_id
                        ):
                            with button(
                                variant="error",
                                size="sm",
                                hx_get=str(
                                    request.url_for(
                                        "payout_accounts:delete",
                                        id=payout_account.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Delete Payout Account")

                    with description_list.DescriptionList[PayoutAccount](
                        description_list.DescriptionListAttrItem(
                            "id", "ID", clipboard=True
                        ),
                        description_list.DescriptionListAttrItem("type", "Type"),
                        description_list.DescriptionListAttrItem(
                            "stripe_id", "Stripe ID", clipboard=True
                        ),
                        description_list.DescriptionListAttrItem(
                            "email", "Email", clipboard=True
                        ),
                        description_list.DescriptionListAttrItem("country", "Country"),
                        description_list.DescriptionListAttrItem(
                            "currency", "Currency"
                        ),
                        description_list.DescriptionListAttrItem(
                            "business_type", "Business Type"
                        ),
                        description_list.DescriptionListAttrItem(
                            "is_details_submitted", "Details Submitted"
                        ),
                        description_list.DescriptionListAttrItem(
                            "is_charges_enabled", "Charges Enabled"
                        ),
                        description_list.DescriptionListAttrItem(
                            "is_payouts_enabled", "Payouts Enabled"
                        ),
                        description_list.DescriptionListDateTimeItem(
                            "created_at", "Created At"
                        ),
                        description_list.DescriptionListDateTimeItem(
                            "deleted_at", "Deleted At"
                        ),
                    ).render(request, payout_account):
                        pass

                    if (
                        payout_account.type == PayoutAccountType.stripe
                        and payout_account.stripe_id
                    ):
                        with tag.div(classes="mt-4"):
                            with tag.a(
                                href=f"https://dashboard.stripe.com/connect/accounts/{payout_account.stripe_id}",
                                target="_blank",
                                rel="noopener noreferrer",
                                classes="btn btn-secondary btn-sm",
                            ):
                                text("Open in Stripe →")

            # Admin (user) details
            with tag.div(classes="card card-border w-full shadow-sm"):
                with tag.div(classes="card-body"):
                    with tag.h2(classes="card-title"):
                        text("Admin")
                    with description_list.DescriptionList[PayoutAccount](
                        description_list.DescriptionListLinkItem[PayoutAccount](
                            "admin.id",
                            "ID",
                            href_getter=lambda r, i: str(
                                r.url_for("users:get", id=i.admin_id)
                            ),
                            clipboard=True,
                        ),
                        description_list.DescriptionListAttrItem(
                            "admin.email", "Email", clipboard=True
                        ),
                    ).render(request, payout_account):
                        pass

            # Linked organizations
            with tag.div(classes="flex flex-col gap-4"):
                with tag.h2(classes="text-2xl"):
                    text(f"Linked Organizations ({len(linked_organizations)})")
                with datatable.Datatable[Organization, Any](
                    datatable.DatatableAttrColumn(
                        "id",
                        "ID",
                        external_href=lambda r, i: str(
                            r.url_for("organizations:detail", organization_id=i.id)
                        ),
                        clipboard=True,
                    ),
                    datatable.DatatableAttrColumn("name", "Name"),
                    datatable.DatatableAttrColumn("slug", "Slug", clipboard=True),
                    datatable.DatatableAttrColumn("status", "Status"),
                    datatable.DatatableDateTimeColumn("created_at", "Created At"),
                    datatable.DatatableDateTimeColumn("deleted_at", "Deleted At"),
                    empty_message="No organizations are linked to this payout account.",
                ).render(request, linked_organizations):
                    pass


@router.api_route(
    "/{id}/delete",
    name="payout_accounts:delete",
    methods=["GET", "POST"],
    response_model=None,
)
async def delete(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Show modal to confirm and process payout account deletion."""
    repository = PayoutAccountRepository.from_session(session)
    payout_account = await repository.get_by_id(id)

    if payout_account is None:
        raise HTTPException(status_code=404, detail="Payout account not found")

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = DeletePayoutAccountForm.model_validate_form(data)

            account_type = payout_account.type
            stripe_id = payout_account.stripe_id

            await payout_account_service.delete(session, payout_account)

            timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
            note = (
                f"[{timestamp}] Payout account deleted.\nType: {account_type.value}\n"
            )
            if account_type == PayoutAccountType.stripe and stripe_id:
                note += f"Stripe ID: {stripe_id}\n"
            note += f"Reason: {form.reason.strip()}"

            logger.info(
                "Payout account deleted from backoffice",
                payout_account_id=str(payout_account.id),
                account_type=account_type.value,
                note=note,
            )

            await add_toast(request, "Payout account deleted", variant="success")

            return HXRedirectResponse(
                request,
                str(request.url_for("payout_accounts:get", id=payout_account.id)),
                303,
            )

        except ValidationError as e:
            validation_error = e

    form_action = str(request.url_for("payout_accounts:delete", id=payout_account.id))
    modal_view = DeletePayoutAccountModal(payout_account, form_action, validation_error)
    with modal_view.render():
        pass

    return None
