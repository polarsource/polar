import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated, Any

from babel.numbers import format_currency
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import classes, tag, text

from polar.enums import AccountType
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import (
    Account,
    Benefit,
    Checkout,
    CheckoutLink,
    Customer,
    Order,
    Organization,
    OrganizationAccessToken,
    OrganizationReview,
    Payment,
    PersonalAccessToken,
    Product,
    ProductBenefit,
    Transaction,
    User,
    UserOrganization,
    WebhookEndpoint,
)
from polar.organization import sorting
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_session
from polar.transaction.repository import PaymentTransactionRepository
from polar.user.repository import UserRepository
from polar.user_organization.service import (
    CannotRemoveOrganizationAdmin,
    UserNotMemberOfOrganization,
)
from polar.user_organization.service import (
    OrganizationNotFound as UserOrgOrganizationNotFound,
)
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.web_backoffice.components.account_review._ai_review import AIReviewVerdict
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
    UpdateOrganizationDetailsForm,
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


@contextlib.contextmanager
def organization_badge(organization: Organization) -> Generator[None]:
    with tag.div(classes="badge"):
        if organization.status == Organization.Status.ACTIVE:
            classes("badge-success")
        elif (
            organization.status == Organization.Status.UNDER_REVIEW
            or organization.status == Organization.Status.DENIED
        ):
            classes("badge-warning")
        else:
            classes("badge-secondary")
        text(organization.status.get_display_name())
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
    """Get all-time payment statistics for an organization."""

    payment_repo = PaymentTransactionRepository.from_session(session)

    # First get the account_id for the organization
    org_account_result = await session.execute(
        select(Organization.account_id).where(Organization.id == organization_id)
    )
    org_account_row = org_account_result.first()

    if not org_account_row or not org_account_row[0]:
        return {
            "payment_count": 0,
            "p50_risk": 0,
            "p90_risk": 0,
            "risk_level": "green",
            "refunds_count": 0,
            "total_balance": 0,
            "refunds_amount": 0,
            "total_payment_amount": 0,
        }

    account_id = org_account_row[0]

    # Debug: Let's also get a count of ALL transactions for this account to verify
    all_transactions_result = await session.execute(
        select(func.count(Transaction.id)).where(Transaction.account_id == account_id)
    )
    all_transactions_count = all_transactions_result.scalar() or 0

    # Debug: Let's see what transaction types exist for this account
    transaction_types_result = await session.execute(
        select(Transaction.type, func.count(Transaction.id))
        .where(Transaction.account_id == account_id)
        .group_by(Transaction.type)
    )
    transaction_types = {row[0]: row[1] for row in transaction_types_result}

    # Get succeeded customer payments from the Payment model
    from polar.models.payment import PaymentStatus
    from polar.payment.repository import PaymentRepository
    
    payment_repo = PaymentRepository.from_session(session)
    succeeded_payments_statement = payment_repo.get_base_statement().where(
        Payment.organization_id == organization_id,
        Payment.status == PaymentStatus.succeeded
    )

    # Get all risk scores from succeeded payments
    risk_scores_result = await session.execute(
        succeeded_payments_statement.where(Payment.risk_score.isnot(None)).with_only_columns(
            Payment.risk_score
        )
    )
    risk_scores = [row[0] for row in risk_scores_result if row[0] is not None]

    # Get count of succeeded payments and total amount
    payment_stats_result = await session.execute(
        succeeded_payments_statement.with_only_columns(
            func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0)
        )
    )
    transaction_count, total_transaction_amount = payment_stats_result.first() or (
        0,
        0,
    )

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

    # Get refund statistics by joining through Order -> Customer -> Organization
    from polar.models import Refund

    refunds_result = await session.execute(
        select(func.count(Refund.id), func.coalesce(func.sum(Refund.amount), 0))
        .join(Order, Refund.order_id == Order.id)
        .join(Customer, Order.customer_id == Customer.id)
        .where(
            Customer.organization_id == organization_id,
        )
    )
    refunds_count, refunds_amount = refunds_result.first() or (0, 0)

    # Get total account balance from all transaction types (not just payments)
    balance_result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.account_id == account_id,
        )
    )
    total_balance = (balance_result.scalar() or 0) - refunds_amount

    # Debug info - let's see what's happening
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"Payment Stats - Org: {organization_id}, Account: {account_id}")
    logger.info(f"Transaction types in account: {transaction_types}")
    logger.info(
        f"All transactions: {all_transactions_count}, Payment transactions: {transaction_count}"
    )
    logger.info(
        f"Payment amount: {total_transaction_amount}, Refunds: {refunds_count}/{refunds_amount}"
    )
    logger.info(f"Total balance: {total_balance}")

    return {
        "payment_count": transaction_count,
        "p50_risk": p50_risk,
        "p90_risk": p90_risk,
        "risk_level": risk_level,
        "refunds_count": refunds_count,
        "total_balance": total_balance,
        "refunds_amount": refunds_amount,
        "total_payment_amount": total_transaction_amount,
    }


async def get_setup_verdict_data(
    organization: Organization, session: AsyncSession
) -> dict[str, Any]:
    """Get enhanced setup verdict for an organization."""

    # Check checkout links
    checkout_links_result = await session.execute(
        select(func.count(CheckoutLink.id)).where(
            CheckoutLink.organization_id == organization.id,
            CheckoutLink.deleted_at.is_(None),
        )
    )
    checkout_links_count = checkout_links_result.scalar() or 0

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

    # Check webhook endpoints
    webhook_result = await session.execute(
        select(func.count(WebhookEndpoint.id)).where(
            WebhookEndpoint.organization_id == organization.id
        )
    )
    webhook_count = webhook_result.scalar() or 0

    # Check API keys (both organization and personal access tokens)
    org_tokens_result = await session.execute(
        select(func.count(OrganizationAccessToken.id)).where(
            OrganizationAccessToken.organization_id == organization.id,
            OrganizationAccessToken.deleted_at.is_(None),
        )
    )
    org_tokens_count = org_tokens_result.scalar() or 0

    # Get personal access tokens for users in this organization
    personal_tokens_result = await session.execute(
        select(func.count(PersonalAccessToken.id.distinct()))
        .join(UserOrganization, PersonalAccessToken.user_id == UserOrganization.user_id)
        .where(
            UserOrganization.organization_id == organization.id,
            PersonalAccessToken.deleted_at.is_(None),
        )
    )
    personal_tokens_count = personal_tokens_result.scalar() or 0
    api_keys_count = org_tokens_count + personal_tokens_count

    # Check products configured
    products_result = await session.execute(
        select(func.count(Product.id)).where(
            Product.organization_id == organization.id,
            Product.deleted_at.is_(None),
        )
    )
    products_count = products_result.scalar() or 0

    # Check benefits configuration
    benefits_result = await session.execute(
        select(func.count(Benefit.id))
        .join(ProductBenefit, Benefit.id == ProductBenefit.benefit_id)
        .join(Product, ProductBenefit.product_id == Product.id)
        .where(
            Product.organization_id == organization.id,
            Product.deleted_at.is_(None),
        )
    )
    benefits_count = benefits_result.scalar() or 0

    # Check user verification status (get the first user as owner)
    user_verified_result = await session.execute(
        select(User.identity_verification_status)
        .join(UserOrganization, User.id == UserOrganization.user_id)
        .where(UserOrganization.organization_id == organization.id)
        .limit(1)
    )
    user_verified_row = user_verified_result.first()
    from polar.models.user import IdentityVerificationStatus

    user_verified = (
        user_verified_row[0] == IdentityVerificationStatus.verified
        if user_verified_row
        else False
    )

    # Check account charges and payouts enabled
    account = organization.account
    account_charges_enabled = account.is_charges_enabled if account else False
    account_payouts_enabled = account.is_payouts_enabled if account else False

    # Calculate enhanced setup score (0-6 scale)
    setup_score = sum(
        [
            1 if checkout_links_count > 0 else 0,
            1 if webhook_count > 0 else 0,
            1 if api_keys_count > 0 else 0,
            1 if products_count > 0 else 0,
            1 if benefits_count > 0 else 0,
            1 if domain_matches else 0,
        ]
    )

    return {
        "checkout_links_count": checkout_links_count,
        "webhooks_count": webhook_count,
        "api_keys_count": api_keys_count,
        "products_count": products_count,
        "benefits_count": benefits_count,
        "domain_validation": domain_matches,
        "user_verified": user_verified,
        "account_charges_enabled": account_charges_enabled,
        "account_payouts_enabled": account_payouts_enabled,
        "setup_score": setup_score,
        "benefits_configured": benefits_count > 0,
        "webhooks_configured": webhook_count > 0,
        "products_configured": products_count > 0,
        "api_keys_created": api_keys_count > 0,
    }


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
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search("query", query):
                    pass
                with input.select(
                    [
                        ("All Account Statuses", ""),
                        *[
                            (status.get_display_name(), status.value)
                            for status in Account.Status
                        ],
                    ],
                    account_status.value if account_status else "",
                    name="account_status",
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


@router.api_route(
    "/{id}/update_details", name="organizations:update_details", methods=["GET", "POST"]
)
async def update_details(
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
            # Get form values with proper type checking
            about_value = data.get("about")
            product_description_value = data.get("product_description")
            intended_use_value = data.get("intended_use")

            # Convert to string and strip if not None
            about = str(about_value).strip() if about_value is not None else ""
            product_description = (
                str(product_description_value).strip()
                if product_description_value is not None
                else ""
            )
            intended_use = (
                str(intended_use_value).strip()
                if intended_use_value is not None
                else ""
            )

            # Basic validation - use the form class to get proper validation
            form_data = {
                "about": about,
                "product_description": product_description,
                "intended_use": intended_use,
            }
            form = UpdateOrganizationDetailsForm.model_validate(form_data)

            # Preserve existing details and only update the three editable fields
            existing_details = organization.details.copy()
            existing_details.update(
                {
                    "about": form.about,
                    "product_description": form.product_description,
                    "intended_use": form.intended_use,
                }
            )

            organization = await org_repo.update(
                organization, update_dict={"details": existing_details}
            )
            return HXRedirectResponse(
                request, str(request.url_for("organizations:get", id=id)), 303
            )

        except ValidationError as e:
            validation_error = e

    with modal("Update Organization Details", open=True):
        with tag.div(classes="max-h-[85vh] overflow-y-auto px-2"):
            with tag.form(
                method="POST",
                action=str(request.url_for("organizations:update_details", id=id)),
                classes="space-y-6",
            ):
                # Business Information Section
                with tag.div(
                    classes="bg-base-50 rounded-lg p-6 border border-base-200"
                ):
                    with tag.div(classes="mb-6"):
                        with tag.h3(
                            classes="text-lg font-semibold text-base-content mb-2"
                        ):
                            text("Edit Business Information")
                        with tag.p(classes="text-sm text-base-content-secondary"):
                            text(
                                "Update the key information about your business and products"
                            )

                    with tag.div(classes="space-y-6"):
                        # About field
                        with tag.div(classes="form-control w-full"):
                            with tag.label(classes="label"):
                                with tag.span(classes="label-text font-semibold"):
                                    text("About")
                                    with tag.span(classes="text-error ml-1"):
                                        text("*")
                            with tag.textarea(
                                id="about",
                                name="about",
                                rows=4,
                                required=True,
                                classes="textarea textarea-bordered w-full resize-none",
                                placeholder="Brief information about you and your business",
                            ):
                                text(organization.details.get("about", ""))

                        # Product Description field
                        with tag.div(classes="form-control w-full"):
                            with tag.label(classes="label"):
                                with tag.span(classes="label-text font-semibold"):
                                    text("Product Description")
                                    with tag.span(classes="text-error ml-1"):
                                        text("*")
                            with tag.textarea(
                                id="product_description",
                                name="product_description",
                                rows=4,
                                required=True,
                                classes="textarea textarea-bordered w-full resize-none",
                                placeholder="Description of digital products being sold",
                            ):
                                text(
                                    organization.details.get("product_description", "")
                                )

                        # Intended Use field
                        with tag.div(classes="form-control w-full"):
                            with tag.label(classes="label"):
                                with tag.span(classes="label-text font-semibold"):
                                    text("Intended Use")
                                    with tag.span(classes="text-error ml-1"):
                                        text("*")
                            with tag.textarea(
                                id="intended_use",
                                name="intended_use",
                                rows=3,
                                required=True,
                                classes="textarea textarea-bordered w-full resize-none",
                                placeholder="How the organization will integrate and use Polar",
                            ):
                                text(organization.details.get("intended_use", ""))

                # Display validation errors
                if validation_error:
                    with tag.div(classes="alert alert-error mt-6"):
                        with tag.svg(
                            classes="stroke-current shrink-0 h-6 w-6",
                            fill="none",
                            viewBox="0 0 24 24",
                        ):
                            with tag.path(
                                stroke_linecap="round",
                                stroke_linejoin="round",
                                stroke_width="2",
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
                            ):
                                pass
                        with tag.div():
                            with tag.span(classes="font-medium"):
                                text("Please fix the following errors:")
                            with tag.ul(classes="list-disc list-inside mt-2"):
                                for error in validation_error.errors():
                                    with tag.li():
                                        text(f"{error['loc'][0]}: {error['msg']}")

                # Action buttons
                with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                    with tag.form(method="dialog"):
                        with button(ghost=True):
                            text("Cancel")
                    with button(
                        type="submit",
                        variant="primary",
                    ):
                        text("Update Details")


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


@router.get(
    "/{id}/confirm_remove_member/{user_id}", name="organizations:confirm_remove_member"
)
async def confirm_remove_member(
    request: Request,
    id: UUID4,
    user_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Show confirmation modal for removing a member."""

    # Get user info for the modal
    user_repo = UserRepository.from_session(session)
    user = await user_repo.get_by_id(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    with modal(f"Remove {user.email}", open=True):
        with tag.div(classes="flex items-start gap-4 mb-6"):
            # Message content
            with tag.div(classes="flex-1"):
                with tag.p(classes="text-sm text-gray-600 mb-4"):
                    text("Are you sure you want to remove ")
                    with tag.strong():
                        text(user.email)
                    text(" from this organization?")

                with tag.p(classes="text-xs text-gray-500"):
                    text(
                        "This action cannot be undone. The user will lose access to all organization resources."
                    )

        # Action buttons
        with tag.div(classes="modal-action"):
            with tag.form(method="dialog"):
                with button(ghost=True):
                    text("Cancel")

            with tag.form(method="dialog"):
                with button(
                    variant="error",
                    hx_delete=str(
                        request.url_for(
                            "organizations:remove_member",
                            id=id,
                            user_id=user_id,
                        )
                    ),
                    hx_target="#modal",
                ):
                    text("Remove User")


@router.api_route(
    "/{id}/remove_member/{user_id}",
    name="organizations:remove_member",
    methods=["DELETE"],
)
async def remove_member(
    request: Request,
    id: UUID4,
    user_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Remove member endpoint with DELETE method."""

    try:
        # Get user info for better error messages
        user_repo = UserRepository.from_session(session)
        user = await user_repo.get_by_id(user_id)
        user_email = user.email if user else str(user_id)

        # Attempt to remove the member safely
        await user_organization_service.remove_member_safe(session, user_id, id)

        # Add success toast and redirect
        await add_toast(
            request,
            f"{user_email} has been removed from the organization",
            "success",
        )

        return HXRedirectResponse(
            request, request.url_for("organizations:get", id=id), 303
        )

    except UserOrgOrganizationNotFound:
        raise HTTPException(status_code=404, detail="Organization not found")

    except UserNotMemberOfOrganization:
        raise HTTPException(
            status_code=400, detail="User is not a member of this organization"
        )

    except CannotRemoveOrganizationAdmin:
        raise HTTPException(
            status_code=403,
            detail=f"Cannot remove {user_email} - they are the organization admin",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail="An error occurred while removing the user"
        )


@router.api_route("/{id}", name="organizations:get", methods=["GET", "POST"])
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = OrganizationRepository.from_session(session)
    organization = await repository.get_by_id(
        id, 
        options=(
            joinedload(Organization.account),
            joinedload(Organization.review),
        ), 
        include_blocked=True
    )

    if organization is None:
        raise HTTPException(status_code=404)

    user_repository = UserRepository.from_session(session)
    users = await user_repository.get_all_by_organization(organization.id)

    account = organization.account

    # Get setup, payment, and organization verdicts for account review sections
    setup_verdict_data = await get_setup_verdict_data(organization, session)
    payment_stats = await get_payment_statistics(session, organization.id)
    setup_verdict = SetupVerdict(setup_verdict_data, organization)

    validation_error: ValidationError | None = None
    # Always show actions in the payment section (context-sensitive based on status)
    show_actions = True
    if account and request.method == "POST":
        # This part handles the "Approve" action
        # It's a POST to the current page URL, not the status update URL
        data = await request.form()
        try:
            account_status = AccountStatusFormAdapter.validate_python(data)
            if account_status.action == "approve":
                await organization_service.confirm_organization_reviewed(
                    session, organization, account_status.next_review_threshold
                )
            elif account_status.action == "deny":
                await organization_service.deny_organization(session, organization)
            elif account_status.action == "under_review":
                await organization_service.set_organization_under_review(
                    session, organization
                )
            return HXRedirectResponse(request, request.url, 303)
        except ValidationError as e:
            validation_error = e

    # Create payment verdict after validation_error is potentially set
    payment_verdict = PaymentVerdict(
        payment_stats,
        organization,
        show_actions,
        request,
        account,
        validation_error,
    )
    
    # Create AI review verdict
    ai_review_verdict = AIReviewVerdict(organization.review)

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
                # Simple users table
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.div(classes="flex justify-between items-center mb-4"):
                            with tag.h2(classes="card-title"):
                                text(f"Team Members ({len(users)})")

                        # Check if current organization has admin
                        admin_user = None
                        if organization.account_id:
                            admin_user = await repository.get_admin_user(
                                session, organization
                            )

                        if users:
                            # Users table
                            with tag.div(classes="overflow-x-auto"):
                                with tag.table(classes="table table-zebra w-full"):
                                    # Table header
                                    with tag.thead():
                                        with tag.tr():
                                            with tag.th():
                                                text("User")
                                            with tag.th():
                                                text("Role")
                                            with tag.th():
                                                text("Joined")
                                            with tag.th():
                                                text("Actions")

                                    # Table body
                                    with tag.tbody():
                                        for user in users:
                                            is_admin = (
                                                admin_user and user.id == admin_user.id
                                            )
                                            with tag.tr():
                                                # User info
                                                with tag.td():
                                                    with tag.div(
                                                        classes="flex items-center gap-3"
                                                    ):
                                                        # User details
                                                        with tag.div():
                                                            with tag.a(
                                                                href=str(
                                                                    request.url_for(
                                                                        "users:get",
                                                                        id=user.id,
                                                                    )
                                                                ),
                                                                classes="font-medium hover:text-primary",
                                                            ):
                                                                text(user.email)
                                                            if (
                                                                hasattr(
                                                                    user,
                                                                    "email_verified",
                                                                )
                                                                and user.email_verified
                                                            ):
                                                                with tag.div(
                                                                    classes="text-xs text-success"
                                                                ):
                                                                    text("✓ Verified")

                                                # Role
                                                with tag.td():
                                                    if is_admin:
                                                        with tag.span(
                                                            classes="badge badge-primary"
                                                        ):
                                                            text("Admin")
                                                    else:
                                                        with tag.span(
                                                            classes="badge badge-ghost"
                                                        ):
                                                            text("Member")

                                                # Joined date
                                                with tag.td():
                                                    with tag.span(
                                                        classes="text-sm text-gray-600"
                                                    ):
                                                        if (
                                                            hasattr(user, "created_at")
                                                            and user.created_at
                                                        ):
                                                            text(
                                                                user.created_at.strftime(
                                                                    "%b %d, %Y"
                                                                )
                                                            )
                                                        else:
                                                            text("—")

                                                # Actions
                                                with tag.td():
                                                    if not is_admin:
                                                        with tag.button(
                                                            classes="btn btn-error btn-sm",
                                                            hx_get=str(
                                                                request.url_for(
                                                                    "organizations:confirm_remove_member",
                                                                    id=organization.id,
                                                                    user_id=user.id,
                                                                )
                                                            ),
                                                            hx_target="#modal",
                                                        ):
                                                            text("Remove")
                                                    else:
                                                        with tag.span(
                                                            classes="text-xs text-gray-400"
                                                        ):
                                                            text("Cannot remove")
                        else:
                            # Empty state
                            with tag.div(classes="text-center py-8"):
                                with tag.div(classes="text-gray-400 mb-2"):
                                    text("👥")
                                with tag.p(classes="text-gray-600"):
                                    text("No team members yet")
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Account Status")
                        if account:
                            with description_list.DescriptionList[Account](
                                description_list.DescriptionListAttrItem(
                                    "id", "Account Id", clipboard=True
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
                            ).render(request, account):
                                pass

                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.div(classes="flex justify-between items-center"):
                            with tag.h2(classes="card-title"):
                                text("Details")
                            with button(
                                hx_get=str(
                                    request.url_for(
                                        "organizations:update_details",
                                        id=organization.id,
                                    )
                                ),
                                hx_target="#modal",
                                variant="secondary",
                            ):
                                text("Edit Details")

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

            # Organization Review Section
            with tag.div(classes="mt-8"):
                with tag.div(classes="flex items-center gap-4 mb-4"):
                    with tag.h2(classes="text-2xl font-bold"):
                        text("Organization Review")
                    with organization_badge(organization):
                        pass

                with tag.div(classes="grid grid-cols-1 lg:grid-cols-3 gap-4"):
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with ai_review_verdict.render():
                            pass

                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with setup_verdict.render():
                            pass

                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with payment_verdict.render():
                            pass
