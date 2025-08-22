import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated, Any

from babel.numbers import format_currency
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy import or_, select
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import classes, tag, text

from polar.enums import AccountType
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import (
    Account,
    Organization,
    User,
    UserOrganization,
)
from polar.models.transaction import TransactionType
from polar.models.user import IdentityVerificationStatus
from polar.organization import sorting
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_session
from polar.transaction.service.transaction import transaction as transaction_service
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
)
from polar.web_backoffice.organizations.analytics import (
    OrganizationSetupAnalyticsService,
    PaymentAnalyticsService,
)
from polar.web_backoffice.organizations.schemas import (
    PaymentStatistics,
    SetupVerdictData,
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


class OrganizationStatusColumn(
    datatable.DatatableAttrColumn[Organization, OrganizationSortProperty]
):
    def render(self, request: Request, item: Organization) -> Generator[None] | None:
        with organization_badge(item):
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
) -> PaymentStatistics:
    """Get all-time payment statistics for an organization."""

    analytics_service = PaymentAnalyticsService(session)

    # Get account ID for the organization
    account_id = await analytics_service.get_organization_account_id(organization_id)
    if not account_id:
        return PaymentStatistics(
            payment_count=0,
            p50_risk=0,
            p90_risk=0,
            refunds_count=0,
            transfer_sum=0,
            refunds_amount=0,
            total_payment_amount=0,
        )

    # Get payment statistics
    (
        payment_count,
        total_payment_amount,
        risk_scores,
    ) = await analytics_service.get_succeeded_payments_stats(organization_id)

    # Calculate risk percentiles and level
    p50_risk, p90_risk = analytics_service.calculate_risk_percentiles(risk_scores)

    # Get refund statistics
    refunds_count, refunds_amount = await analytics_service.get_refund_stats(
        organization_id
    )

    # Get transfer sum (used for review threshold checking)
    transfer_sum = await transaction_service.get_transactions_sum(
        session, account_id, type=TransactionType.balance
    )

    return PaymentStatistics(
        payment_count=payment_count,
        p50_risk=p50_risk,
        p90_risk=p90_risk,
        refunds_count=refunds_count,
        transfer_sum=transfer_sum,
        refunds_amount=refunds_amount,
        total_payment_amount=total_payment_amount,
    )


async def get_setup_verdict_data(
    organization: Organization, session: AsyncSession
) -> SetupVerdictData:
    """Get enhanced setup verdict for an organization."""

    analytics_service = OrganizationSetupAnalyticsService(session)

    # Get all setup metrics using helper methods
    checkout_links_count = await analytics_service.get_checkout_links_count(
        organization.id
    )
    webhooks_count = await analytics_service.get_webhooks_count(organization.id)
    org_tokens_count = await analytics_service.get_organization_tokens_count(
        organization.id
    )
    products_count = await analytics_service.get_products_count(organization.id)
    benefits_count = await analytics_service.get_benefits_count(organization.id)

    # Check user verification status (get the first user as owner)
    user_verified_result = await session.execute(
        select(User.identity_verification_status)
        .join(UserOrganization, User.id == UserOrganization.user_id)
        .where(UserOrganization.organization_id == organization.id)
        .limit(1)
    )
    user_verified_row = user_verified_result.first()
    user_verified = (
        user_verified_row[0] == IdentityVerificationStatus.verified
        if user_verified_row
        else False
    )

    # Check account charges and payouts enabled
    (
        account_charges_enabled,
        account_payouts_enabled,
    ) = await analytics_service.check_account_enabled(organization)

    # Calculate setup score using helper
    setup_score = analytics_service.calculate_setup_score(
        checkout_links_count=checkout_links_count,
        webhooks_count=webhooks_count,
        org_tokens_count=org_tokens_count,
        products_count=products_count,
        benefits_count=benefits_count,
        user_verified=user_verified,
        account_charges_enabled=account_charges_enabled,
        account_payouts_enabled=account_payouts_enabled,
    )

    return SetupVerdictData(
        checkout_links_count=checkout_links_count,
        webhooks_count=webhooks_count,
        api_keys_count=org_tokens_count,  # Only organization tokens now
        products_count=products_count,
        benefits_count=benefits_count,
        user_verified=user_verified,
        account_charges_enabled=account_charges_enabled,
        account_payouts_enabled=account_payouts_enabled,
        setup_score=setup_score,
        benefits_configured=benefits_count > 0,
        webhooks_configured=webhooks_count > 0,
        products_configured=products_count > 0,
        api_keys_created=org_tokens_count > 0,
    )


@router.get("/", name="organizations:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    organization_status: Annotated[
        Organization.Status | None, BeforeValidator(empty_str_to_none), Query()
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
                            for status in Organization.Status
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
                OrganizationStatusColumn("status", "Status"),
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
        include_blocked=True,
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
                                                    with tag.div(classes="flex gap-2"):
                                                        with tag.button(
                                                            classes="btn btn-primary btn-sm",
                                                            name="user_id",
                                                            value=str(user.id),
                                                            hx_post=str(
                                                                request.url_for(
                                                                    "auth:start_impersonation",
                                                                )
                                                            ),
                                                            hx_confirm="Are you sure you want to impersonate this user?",
                                                        ):
                                                            text("Impersonate")

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

                with tag.div(
                    classes="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
                ):
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with ai_review_verdict.render():
                            pass

                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with setup_verdict.render():
                            pass

                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with payment_verdict.render():
                            pass
