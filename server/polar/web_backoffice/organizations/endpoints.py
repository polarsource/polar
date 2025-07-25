import contextlib
import uuid
from collections.abc import Generator
from datetime import datetime, timedelta
from typing import Annotated, Any

from babel.numbers import format_currency
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import classes, tag, text

from polar.account.service import account as account_service
from polar.enums import AccountType
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import (
    Account,
    Benefit,
    Checkout,
    Organization,
    Product,
    ProductBenefit,
    Transaction,
    User,
    WebhookEndpoint,
)
from polar.organization import sorting
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_session
from polar.transaction.repository import PaymentTransactionRepository
from polar.user.repository import UserRepository
from polar.web_backoffice.components.account_review._acceptable_use import (
    AcceptableUseVerdict,
)
from polar.web_backoffice.components.account_review._payment_verdict import (
    PaymentVerdict,
)
from polar.web_backoffice.components.account_review._setup_verdict import (
    SetupVerdict,
    check_domain_match,
)

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

router = APIRouter()


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


class AccountColumn(
    datatable.DatatableAttrColumn[Organization, OrganizationSortProperty]
):
    def render(self, request: Request, item: Organization) -> Generator[None] | None:
        account = item.account
        with account_badge(account):
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


async def get_payment_statistics(
    session: AsyncSession, organization_id: UUID4
) -> dict[str, Any]:
    """Get payment statistics for the last 30 days."""
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    payment_repo = PaymentTransactionRepository.from_session(session)

    # First get the account_id for the organization
    org_account_result = await session.execute(
        select(Organization.account_id).where(Organization.id == organization_id)
    )
    org_account_row = org_account_result.first()

    if not org_account_row or not org_account_row[0]:
        # TODO: replace this with 0
        return {
            "payment_count": 10,
            "p50_risk": 5,
            "p90_risk": 95,
            "risk_level": "yellow",
        }

    account_id = org_account_row[0]

    # Get payment transactions for the organization in the last 30 days
    statement = payment_repo.get_base_statement().where(
        Transaction.account_id == account_id,
        Transaction.created_at >= thirty_days_ago,
        Transaction.risk_score.isnot(None),  # Only transactions with risk scores
    )

    # Get all risk scores
    risk_scores_result = await session.execute(
        statement.with_only_columns(Transaction.risk_score)
    )
    risk_scores = [row[0] for row in risk_scores_result if row[0] is not None]

    # Get count of payments
    count_result = await session.execute(
        statement.with_only_columns(func.count(Transaction.id))
    )
    payment_count = count_result.scalar() or 0

    # Calculate percentiles
    p50_risk = 0
    p90_risk = 0

    if risk_scores:
        risk_scores.sort()
        n = len(risk_scores)

        # Calculate P50 (median)
        if n % 2 == 0:
            p50_risk = (risk_scores[n // 2 - 1] + risk_scores[n // 2]) / 2
        else:
            p50_risk = risk_scores[n // 2]

        # Calculate P90
        p90_index = int(0.9 * n)
        if p90_index >= n:
            p90_index = n - 1
        p90_risk = risk_scores[p90_index]

    # Determine risk level based on P90
    if p90_risk < 65:
        risk_level = "green"
    elif p90_risk < 75:
        risk_level = "yellow"
    else:
        risk_level = "red"

    return {
        "payment_count": payment_count,
        "p50_risk": p50_risk,
        "p90_risk": p90_risk,
        "risk_level": risk_level,
    }


async def get_setup_verdict(
    organization: Organization, session: AsyncSession
) -> SetupVerdict:
    """Get setup verdict for an organization."""
    # Check domain validation - do checkout success URLs match organization domain?
    domain_match_result = await session.execute(
        select(func.count(Checkout.id))
        .join(Product, Checkout.product_id == Product.id)
        .where(
            Product.organization_id == organization.id,
            Checkout._success_url.is_not(None),
        )
    )
    success_urls_count = domain_match_result.scalar() or 0

    # For those with success URLs, check domain matches
    if success_urls_count > 0:
        domain_match_query = await session.execute(
            select(Checkout._success_url)
            .join(Product, Checkout.product_id == Product.id)
            .where(
                Product.organization_id == organization.id,
                Checkout._success_url.is_not(None),
            )
        )
        success_urls = [row[0] for row in domain_match_query.fetchall() if row[0]]
        # Get organization domain - check if organization has a domain attribute
        org_domain = (
            getattr(organization, "domain", None) or f"{organization.slug}.polar.sh"
        )
        domain_matches = check_domain_match(org_domain, success_urls)
    else:
        domain_matches = False

    # Check benefits configuration
    benefits_result = await session.execute(
        select(func.count(Benefit.id))
        .join(ProductBenefit, Benefit.id == ProductBenefit.benefit_id)
        .join(Product, ProductBenefit.product_id == Product.id)
        .where(Product.organization_id == organization.id)
    )
    benefits_count = benefits_result.scalar() or 0

    # Check webhook endpoints
    webhook_result = await session.execute(
        select(func.count(WebhookEndpoint.id)).where(
            WebhookEndpoint.organization_id == organization.id
        )
    )
    webhook_count = webhook_result.scalar() or 0

    # Calculate setup score (0-3 scale)
    setup_score = sum(
        [
            1 if domain_matches else 0,
            1 if benefits_count > 0 else 0,
            1 if webhook_count > 0 else 0,
        ]
    )

    return SetupVerdict(
        {
            "domain_validation": domain_matches,
            "benefits_configured": benefits_count > 0,
            "webhooks_configured": webhook_count > 0,
            "setup_score": setup_score,
            "benefits_count": benefits_count,
            "webhook_count": webhook_count,
        }
    )


async def get_acceptable_use_verdict(
    session: AsyncSession, organization_id: UUID4
) -> dict[str, Any]:
    """Get acceptable use policy compliance verdict."""
    # TODO: Implement actual compliance check logic
    # For now, return mock data
    return {
        "verdict": "UNCERTAIN",
        "risk_score": 45.5,
        "violated_sections": ["Content Policy", "Payment Processing"],
        "reason": "Organization requires manual review due to unclear business model description and potential high-risk payment patterns.",
    }


router = APIRouter()


@router.get("/", name="organizations:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    account_status: Annotated[
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
    if account_status:
        statement = statement.where(Account.status == account_status)

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
            with tag.div(classes="w-full flex flex-row gap-2"):
                with tag.form(method="GET"):
                    with input.search("query", query):
                        pass
                with tag.form(
                    method="GET",
                    _="""
                    on change from <select/> in me
                        call me.submit()
                    end
                    """,
                ):
                    with input.select(
                        [
                            (status.get_display_name(), status.value)
                            for status in Account.Status
                        ],
                        account_status,
                        name="account_status",
                        placeholder="Account Status",
                    ):
                        pass
            with datatable.Datatable[Organization, OrganizationSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="organizations:get", clipboard=True
                ),
                datatable.DatatableDateTimeColumn(
                    "created_at",
                    "Created At",
                    sorting=OrganizationSortProperty.created_at,
                ),
                AccountColumn("account", "Account"),
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
    if account and request.method == "POST":
        # This part handles the "Approve" action
        # It's a POST to the current page URL, not the status update URL
        data = await request.form()
        try:
            account_status = AccountStatusFormAdapter.validate_python(data)
            if account_status.action == "approve":
                await account_service.confirm_account_reviewed(
                    session, account, account_status.next_review_threshold
                )
            elif account_status.action == "deny":
                await account_service.deny_account(session, account)
            elif account_status.action == "under_review":
                await account_service.set_account_under_review(session, account)
            return HXRedirectResponse(request, request.url, 303)
        except ValidationError as e:
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
                with tag.div(classes="flex gap-2"):
                    with button(
                        hx_get=str(
                            request.url_for("organizations:update", id=organization.id)
                        ),
                        hx_target="#modal",
                    ):
                        text("Edit")
                    with tag.a(
                        href=str(
                            request.url_for(
                                "organizations:account_review", id=organization.id
                            )
                        ),
                        classes="btn btn-primary",
                    ):
                        text("Account Review")
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
                    description_list.DescriptionListLinkItem("website", "Website"),
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
                            with account_badge(organization.account):
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
                                if account.status == Account.Status.UNDER_REVIEW:
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


@router.get("/{id}/account-review", name="organizations:account_review")
async def account_review(
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

    # Get the first user as the owner (could be enhanced to get actual owner)
    owner = users[0] if users else None

    # Get payment statistics
    payment_stats = await get_payment_statistics(session, organization.id)
    payment_verdict = PaymentVerdict(payment_stats)

    # Get acceptable use verdict
    acceptable_use_data = await get_acceptable_use_verdict(session, organization.id)
    acceptable_use_verdict = AcceptableUseVerdict(acceptable_use_data)

    # Get setup verdict
    setup_verdict = await get_setup_verdict(organization, session)

    account = organization.account

    with layout(
        request,
        [
            ("Account Review", str(request.url)),
            (
                organization.name,
                str(request.url_for("organizations:get", id=organization.id)),
            ),
            ("Organizations", str(request.url_for("organizations:list"))),
        ],
        "organizations:account_review",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text(f"Account Review - {organization.name}")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Organization Details")
                        with description_list.DescriptionList[Organization](
                            description_list.DescriptionListAttrItem("name", "Name"),
                            description_list.DescriptionListAttrItem(
                                "slug", "Slug", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created At"
                            ),
                        ).render(request, organization):
                            pass

                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Owner")
                        if owner:
                            with description_list.DescriptionList[User](
                                description_list.DescriptionListAttrItem(
                                    "email", "Email", clipboard=True
                                ),
                                description_list.DescriptionListAttrItem(
                                    "id", "ID", clipboard=True
                                ),
                                description_list.DescriptionListDateTimeItem(
                                    "created_at", "Created At"
                                ),
                            ).render(request, owner):
                                pass
                        else:
                            with tag.p():
                                text("No owner found")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Account Status")
                            with account_badge(account):
                                pass
                        if account:
                            with description_list.DescriptionList[Account](
                                description_list.DescriptionListAttrItem(
                                    "status", "Review Status"
                                ),
                                description_list.DescriptionListCurrencyItem(
                                    "next_review_threshold", "Current Threshold"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "country", "Country"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "currency", "Currency"
                                ),
                            ).render(request, account):
                                pass
                        else:
                            with tag.p():
                                text("No account found")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-3 gap-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with acceptable_use_verdict.render():
                        pass

                with tag.div(classes="card card-border w-full shadow-sm"):
                    with setup_verdict.render():
                        pass

                with tag.div(classes="card card-border w-full shadow-sm"):
                    with payment_verdict.render():
                        pass
