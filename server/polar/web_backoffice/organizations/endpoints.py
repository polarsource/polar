import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated, Any

import structlog

from babel.numbers import format_currency
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import classes, tag, text

from polar.enums import AccountType
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Account, Organization
from polar.organization import sorting
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_session
from polar.user.repository import UserRepository

from ..components import accordion, button, datatable, description_list, input, modal
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast
from .forms import (
    AccountStatusFormAdapter,
    ApproveAccountForm,
    UnderReviewAccountForm,
    UpdateOrganizationForm,
)

log = structlog.get_logger()

router = APIRouter()


@contextlib.contextmanager
def organization_status_badge(organization: Organization) -> Generator[None]:
    with tag.div(classes="badge"):
        if organization.status == Organization.Status.ACTIVE:
            classes("badge-success")
        elif (
            organization.status == Organization.Status.UNDER_REVIEW
            or organization.status == Organization.Status.DENIED
        ):
            classes("badge-warning")
        else:
            classes("badge-neutral")
        text(organization.status.get_display_name())
    yield


@contextlib.contextmanager
def account_badge(account: Account | None) -> Generator[None]:
    with tag.div(classes="badge"):
        if account is None:
            classes("badge-neutral")
            text("No account")
        else:
            if account.status == Account.Status.ACTIVE:
                classes("badge-success")
            elif (
                account.status == Account.Status.UNDER_REVIEW
                or account.status == Account.Status.DENIED
            ):
                classes("badge-warning")
            else:
                classes("badge-neutral")
            text(account.status.get_display_name())
    yield


class StatusColumn(
    datatable.DatatableAttrColumn[Organization, OrganizationSortProperty]
):
    def render(self, request: Request, item: Organization) -> Generator[None] | None:
        with organization_status_badge(item):
            pass
        return None


class AccountTypeDescriptionListAttrItem(
    description_list.DescriptionListAttrItem[Account]
):
    def render(self, request: Request, item: Account) -> Generator[None] | None:
        account_type = item.account_type
        if account_type == AccountType.stripe:
            with tag.a(
                href=f"https://dashboard.stripe.com/connect/accounts/{item.stripe_id}",
                classes="link flex flex-row gap-1",
                target="_blank",
                rel="noopener noreferrer",
            ):
                text(account_type.get_display_name())
                with tag.div(classes="icon-external-link"):
                    pass
        else:
            text(account_type.get_display_name())
        return None


@router.get("/", name="organizations:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    organization_status: Annotated[
        Account.Status | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = OrganizationRepository.from_session(session)
    statement = (
        repository.get_base_statement()
        .join(Account, Organization.account_id == Account.id, isouter=True)
        .options(
            contains_eager(Organization.account),
        )
    )
    if query:
        try:
            statement = statement.where(Organization.id == uuid.UUID(query))
        except ValueError:
            statement = statement.where(
                or_(
                    Organization.name.ilike(f"%{query}%"),
                    Organization.slug.ilike(f"%{query}%"),
                )
            )
    if organization_status:
        statement = statement.where(Organization.status == organization_status)

    statement = repository.apply_sorting(statement, sorting)
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Organizations", str(request.url_for("organizations:list"))),
        ],
        "organizations:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Organizations")
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search("query", query):
                    pass
                with input.select(
                    [
                        ("All Organization Statuses", ""),
                        *[
                            (status.get_display_name(), status.value)
                            for status in Account.Status
                        ],
                    ],
                    organization_status.value if organization_status else "",
                    name="organization_status",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")
            with datatable.Datatable[Organization, OrganizationSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="organizations:get", clipboard=True
                ),
                datatable.DatatableDateTimeColumn(
                    "created_at",
                    "Created At",
                    sorting=OrganizationSortProperty.created_at,
                ),
                StatusColumn("status", "Status"),
                datatable.DatatableAttrColumn(
                    "name",
                    "Name",
                    sorting=OrganizationSortProperty.organization_name,
                ),
                datatable.DatatableAttrColumn(
                    "slug",
                    "Slug",
                    sorting=OrganizationSortProperty.slug,
                    clipboard=True,
                ),
            ).render(request, items, sorting=sorting):
                pass
            with datatable.pagination(request, pagination, count):
                pass


@router.api_route("/{id}/update", name="organizations:update", methods=["GET", "POST"])
async def update(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    org_repo = OrganizationRepository.from_session(session)
    organization = await org_repo.get_by_id(id)
    if not organization:
        raise HTTPException(status_code=404)

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = UpdateOrganizationForm.model_validate(data)
            organization = await org_repo.update(
                organization, update_dict=form.model_dump(exclude_none=True)
            )
            return HXRedirectResponse(
                request, str(request.url_for("organizations:get", id=id)), 303
            )

        except ValidationError as e:
            validation_error = e

    with modal("Update Organization", open=True):
        with UpdateOrganizationForm.render(
            {"name": organization.name, "slug": organization.slug},
            method="POST",
            action=str(request.url_for("organizations:update", id=id)),
            classes="flex flex-col gap-4",
            validation_error=validation_error,
        ):
            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Update")


@router.api_route("/{id}/delete", name="organizations:delete", methods=["GET", "POST"])
async def delete(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    org_repo = OrganizationRepository.from_session(session)
    organization = await org_repo.get_by_id(id)
    if not organization:
        raise HTTPException(status_code=404)

    if request.method == "POST":
        await organization_service.delete(session, organization)
        await add_toast(
            request,
            f"Organization with ID {organization.id} has been deleted",
            "success",
        )

        return

    with modal(f"Delete Organization {organization.id}", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text("Are you sure you want to delete this Organization? ")

            with tag.p():
                text("Deleting this Organization DOES NOT:")
            with tag.ul(classes="list-disc list-inside"):
                with tag.li():
                    text("Delete or anonymize Users related Organization")
                with tag.li():
                    text("Delete or anonymize Account of the Organization")
                with tag.li():
                    text(
                        "Delete or anonymize Customers, Products, Discounts, Benefits, Checkouts of the Organization"
                    )
                with tag.li():
                    text("Revoke Benefits granted")
                with tag.li():
                    text("Remove API tokens (organization or personal)")

            with tag.p():
                text("The User can be deleted separately")

            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with tag.form(method="dialog"):
                    with button(
                        type="button",
                        variant="primary",
                        hx_post=str(request.url),
                        hx_target="#modal",
                    ):
                        text("Delete")


@router.api_route("/{id}", name="organizations:get", methods=["GET", "POST"])
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = OrganizationRepository.from_session(session)
    organization = await repository.get_by_id(
        id, options=(joinedload(Organization.account),), include_blocked=True
    )

    if organization is None:
        raise HTTPException(status_code=404)

    user_repository = UserRepository.from_session(session)
    users = await user_repository.get_all_by_organization(organization.id)

    account = organization.account
    validation_error: ValidationError | None = None
    if request.method == "POST":
        # This part handles the "Approve" action
        # It's a POST to the current page URL, not the status update URL
        log.info(
            "Processing organization review action from web backoffice",
            organization_id=organization.id,
            organization_name=organization.name,
            current_status=organization.status.value,
            request_method=request.method,
        )
        
        data = await request.form()
        try:
            account_status = AccountStatusFormAdapter.validate_python(data)
            
            log.info(
                "Organization review action validated",
                organization_id=organization.id,
                organization_name=organization.name,
                action=account_status.action,
                next_review_threshold=getattr(account_status, 'next_review_threshold', None),
            )
            
            if account_status.action == "approve":
                log.info(
                    "Web backoffice: Approving organization review",
                    organization_id=organization.id,
                    organization_name=organization.name,
                    next_review_threshold=account_status.next_review_threshold,
                )
                await organization_service.confirm_organization_reviewed(
                    session, organization, account_status.next_review_threshold
                )
                log.info(
                    "Web backoffice: Organization review approved successfully",
                    organization_id=organization.id,
                    organization_name=organization.name,
                )
            elif account_status.action == "deny":
                log.warning(
                    "Web backoffice: Denying organization",
                    organization_id=organization.id,
                    organization_name=organization.name,
                )
                await organization_service.deny_organization(session, organization)
                log.info(
                    "Web backoffice: Organization denied successfully",
                    organization_id=organization.id,
                    organization_name=organization.name,
                )
            elif account_status.action == "under_review":
                log.info(
                    "Web backoffice: Setting organization under review",
                    organization_id=organization.id,
                    organization_name=organization.name,
                )
                await organization_service.set_organization_under_review(
                    session, organization
                )
                log.info(
                    "Web backoffice: Organization set under review successfully",
                    organization_id=organization.id,
                    organization_name=organization.name,
                )
            return HXRedirectResponse(request, request.url, 303)
        except ValidationError as e:
            log.error(
                "Web backoffice: Validation error in organization review action",
                organization_id=organization.id,
                organization_name=organization.name,
                error=str(e),
            )
            validation_error = e

    with layout(
        request,
        [
            (organization.name, str(request.url)),
            ("Organizations", str(request.url_for("organizations:list"))),
        ],
        "organizations:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text(organization.name)
                with button(
                    hx_get=str(
                        request.url_for("organizations:update", id=organization.id)
                    ),
                    hx_target="#modal",
                ):
                    text("Edit")
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with description_list.DescriptionList[Organization](
                    description_list.DescriptionListAttrItem(
                        "id", "ID", clipboard=True
                    ),
                    description_list.DescriptionListAttrItem(
                        "slug", "Slug", clipboard=True
                    ),
                    description_list.DescriptionListDateTimeItem(
                        "created_at", "Created At"
                    ),
                    description_list.DescriptionListDateTimeItem(
                        "created_at", "Created At"
                    ),
                    description_list.DescriptionListLinkItem(
                        "website", "Website", external=True
                    ),
                    description_list.DescriptionListAttrItem(
                        "email", "Support email", clipboard=True
                    ),
                ).render(request, organization):
                    pass
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Users")
                        with tag.ul():
                            for user in users:
                                with tag.li():
                                    with tag.a(
                                        href=str(
                                            request.url_for("users:get", id=user.id)
                                        ),
                                        classes="link",
                                    ):
                                        text(user.email)
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Account")
                            with organization_status_badge(organization):
                                pass
                        if account:
                            with description_list.DescriptionList[Account](
                                description_list.DescriptionListAttrItem(
                                    "id", "ID", clipboard=True
                                ),
                                AccountTypeDescriptionListAttrItem(
                                    "account_type", "Account Type"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "country", "Country"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "currency", "Currency"
                                ),
                                description_list.DescriptionListCurrencyItem(
                                    "next_review_threshold", "Next Review Threshold"
                                ),
                            ).render(request, account):
                                pass
                            with tag.div(classes="card-actions"):
                                if organization.status == Organization.Status.UNDER_REVIEW:
                                    with ApproveAccountForm.render(
                                        account,
                                        method="POST",
                                        action=str(request.url),
                                        classes="flex flex-col gap-4",
                                        validation_error=validation_error,
                                    ):
                                        with button(
                                            name="action",
                                            type="submit",
                                            variant="primary",
                                            value="approve",
                                        ):
                                            text("Approve")
                                        with button(
                                            name="action",
                                            type="submit",
                                            variant="error",
                                            value="deny",
                                        ):
                                            text("Deny")
                                else:
                                    with UnderReviewAccountForm.render(
                                        account,
                                        method="POST",
                                        action=str(request.url),
                                        classes="flex flex-col gap-4",
                                        validation_error=validation_error,
                                    ):
                                        with button(
                                            name="action",
                                            type="submit",
                                            variant="primary",
                                            value="under_review",
                                        ):
                                            text("Set to Under Review")

                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Details")

                        a = "organization-details-accordion"
                        with accordion.item(a, "About"):
                            with tag.p(classes="whitespace-pre-line"):
                                text(organization.details.get("about", "—"))
                        with accordion.item(a, "Product Description"):
                            with tag.p(classes="whitespace-pre-line"):
                                text(
                                    organization.details.get("product_description", "—")
                                )
                        with accordion.item(a, "Intended Use"):
                            with tag.p(classes="whitespace-pre-line"):
                                text(organization.details.get("intended_use", "—"))
                        with accordion.item(a, "Acquisition"):
                            with tag.ul(classes="list-disc list-inside"):
                                for acquisition in organization.details.get(
                                    "customer_acquisition", []
                                ):
                                    with tag.li():
                                        text(acquisition)
                        with accordion.item(a, "Expected annual revenue"):
                            expected_revenue = organization.details.get(
                                "future_annual_revenue"
                            )
                            if expected_revenue:
                                text(
                                    format_currency(
                                        expected_revenue, "USD", locale="en_US"
                                    )
                                )
                            else:
                                text("—")
                        if organization.details.get("switching"):
                            with accordion.item(a, "Switching from"):
                                text(
                                    f"{organization.details['switching_from']} ({format_currency(organization.details['previous_annual_revenue'], 'USD', locale='en_US')})"
                                )
