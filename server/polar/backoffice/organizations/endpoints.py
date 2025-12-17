import builtins
import contextlib
import uuid
from collections.abc import Generator
from datetime import UTC, datetime
from typing import Annotated, Any, Literal, override

import structlog
from babel.numbers import format_currency
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import UUID4, BeforeValidator, ValidationError
from pydantic_core import PydanticCustomError
from sqlalchemy import or_, select
from sqlalchemy.orm import contains_eager, joinedload
from sse_starlette.sse import EventSourceResponse
from tagflow import classes, document, tag, text

from polar.account.service import (
    CannotChangeAdminError,
    UserNotOrganizationMemberError,
)
from polar.account.service import account as account_service
from polar.enums import AccountType
from polar.file.repository import FileRepository
from polar.file.service import file as file_service
from polar.file.sorting import FileSortProperty
from polar.integrations.plain.service import plain as plain_service
from polar.kit.pagination import PaginationParams
from polar.kit.schemas import empty_str_to_none
from polar.kit.sorting import Sorting
from polar.models import (
    Account,
    File,
    Organization,
    User,
    UserOrganization,
)
from polar.models.file import FileServiceTypes
from polar.models.organization import OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.models.transaction import TransactionType
from polar.models.user import IdentityVerificationStatus
from polar.organization import sorting
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import OrganizationFeatureSettings
from polar.organization.service import organization as organization_service
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
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

from .. import formatters
from ..components import accordion, button, datatable, description_list, input, modal
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast
from .account_review._ai_review import AIReviewVerdict
from .account_review._payment_verdict import PaymentVerdict
from .account_review._setup_verdict import SetupVerdict
from .analytics import (
    OrganizationSetupAnalyticsService,
    PaymentAnalyticsService,
)
from .forms import (
    OrganizationOrdersImportForm,
    OrganizationStatusFormAdapter,
    UpdateOrganizationDetailsForm,
    UpdateOrganizationForm,
    UpdateOrganizationInternalNotesForm,
)
from .orders_import import orders_import_sse
from .schemas import PaymentStatistics, SetupVerdictData

router = APIRouter()

logger = structlog.getLogger(__name__)


def empty_str_to_none_before_enum(value: Any) -> Any:
    """Convert empty strings to None before enum parsing."""
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def empty_str_to_none_before_bool(value: Any) -> Any:
    """Convert empty strings to None before boolean parsing."""
    if isinstance(value, str) and value.strip() == "":
        return None
    if isinstance(value, str):
        if value.lower() in ("true", "1", "yes", "on"):
            return True
        elif value.lower() in ("false", "0", "no", "off"):
            return False
    return value


@contextlib.contextmanager
def organization_badge(organization: Organization) -> Generator[None]:
    with tag.div(classes="badge"):
        if organization.status == OrganizationStatus.ACTIVE:
            classes("badge-success")
        elif (
            organization.is_under_review
            or organization.status == OrganizationStatus.DENIED
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


class NextReviewThresholdColumn(
    datatable.DatatableAttrColumn[Organization, OrganizationSortProperty]
):
    def render(self, request: Request, item: Organization) -> Generator[None] | None:
        from babel.numbers import format_currency

        text(format_currency(item.next_review_threshold / 100, "USD", locale="en_US"))
        return None


class DaysInStatusColumn(
    datatable.DatatableAttrColumn[Organization, OrganizationSortProperty]
):
    def render(self, request: Request, item: Organization) -> Generator[None] | None:
        if item.status_updated_at:
            delta = datetime.now(UTC) - item.status_updated_at
            days = delta.days
        else:
            delta = datetime.now(UTC) - item.created_at
            days = delta.days

        if item.is_under_review:
            text(f"{days} days in review")
        else:
            text(f"{days} days since review")
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
    sorting: sorting.ListSorting,
    session: AsyncSession = Depends(get_db_read_session),
    page: int = Query(1, description="Page number, defaults to 1.", gt=0),
    limit: int = Query(100, description="Size of a page, defaults to 100.", gt=0),
    query: str | None = Query(None),
    organization_status: Annotated[
        OrganizationStatus | None,
        BeforeValidator(empty_str_to_none_before_enum),
        Query(),
    ] = None,
    has_appealed: Annotated[
        bool | None, BeforeValidator(empty_str_to_none_before_bool), Query()
    ] = None,
    review_cycle: Annotated[
        Literal["first", "subsequent"] | None,
        BeforeValidator(empty_str_to_none),
        Query(),
    ] = None,
) -> None:
    # Create custom pagination with default limit of 100
    pagination = PaginationParams(page, min(100, limit))
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
                    Organization.website.ilike(f"%{query}%"),
                )
            )
    if organization_status:
        statement = statement.where(Organization.status == organization_status)

    # Add appeal filter
    if has_appealed is not None:
        if has_appealed:
            statement = statement.join(
                OrganizationReview,
                Organization.id == OrganizationReview.organization_id,
            ).where(OrganizationReview.appeal_submitted_at.is_not(None))
        else:
            statement = statement.outerjoin(
                OrganizationReview,
                Organization.id == OrganizationReview.organization_id,
            ).where(
                or_(
                    OrganizationReview.id.is_(None),
                    OrganizationReview.appeal_submitted_at.is_(None),
                )
            )

    # Add review cycle filter
    if review_cycle:
        match review_cycle:
            case "first":
                status = OrganizationStatus.INITIAL_REVIEW
            case "subsequent":
                status = OrganizationStatus.ONGOING_REVIEW
        statement = statement.where(Organization.status == status)

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
            with tag.form(method="GET", classes="w-full flex flex-col gap-4"):
                with tag.div(classes="flex flex-row gap-2"):
                    with input.search("query", query):
                        pass
                    with input.select(
                        [
                            ("All Organization Statuses", ""),
                            *[
                                (status.get_display_name(), status.value)
                                for status in OrganizationStatus
                            ],
                        ],
                        organization_status.value if organization_status else "",
                        name="organization_status",
                    ):
                        pass
                    with input.select(
                        [
                            ("All Appeal Statuses", ""),
                            ("Has Appealed", "true"),
                            ("Has Not Appealed", "false"),
                        ],
                        "true"
                        if has_appealed is True
                        else ("false" if has_appealed is False else ""),
                        name="has_appealed",
                    ):
                        pass
                    with input.select(
                        [
                            ("All Review Cycles", ""),
                            ("First Review", "first"),
                            ("Subsequent Review", "subsequent"),
                        ],
                        review_cycle or "",
                        name="review_cycle",
                    ):
                        pass
                with tag.div(classes="flex flex-row gap-2"):
                    with input.select(
                        [
                            ("25 per page", "25"),
                            ("50 per page", "50"),
                            ("100 per page", "100"),
                        ],
                        str(limit),
                        name="limit",
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
                NextReviewThresholdColumn(
                    "next_review_threshold",
                    "Next Review Threshold",
                    sorting=OrganizationSortProperty.next_review_threshold,
                ),
                DaysInStatusColumn(
                    "status_updated_at",
                    "Days in Status",
                    sorting=OrganizationSortProperty.days_in_status,
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
            form = UpdateOrganizationForm.model_validate_form(data)
            if form.slug != organization.slug:
                existing_slug = await org_repo.get_by_slug(form.slug)
                if existing_slug is not None:
                    raise ValidationError.from_exception_data(
                        title="SlugAlreadyExists",
                        line_errors=[
                            {
                                "loc": ("slug",),
                                "type": PydanticCustomError(
                                    "SlugAlreadyExists",
                                    "An organization with this slug already exists.",
                                ),
                                "input": form.slug,
                            }
                        ],
                    )

            form_dict = form.model_dump(exclude_none=True)
            feature_flags_from_form = form_dict.pop("feature_flags", None)

            # Dynamically handle all feature flags from OrganizationFeatureSettings
            # If None, all checkboxes were unchecked - set all to False
            if feature_flags_from_form is None:
                # Get all field names from OrganizationFeatureSettings and set to False
                feature_flags = {
                    field_name: False
                    for field_name in OrganizationFeatureSettings.model_fields.keys()
                }
            else:
                # Use the values from the form, ensuring all fields have values
                feature_flags = {
                    field_name: feature_flags_from_form.get(field_name, False)
                    for field_name in OrganizationFeatureSettings.model_fields.keys()
                }

            # Merge with existing feature_settings
            updated_feature_settings = {
                **organization.feature_settings,
                **feature_flags,
            }

            # Update organization with both basic fields and feature_settings
            organization = await org_repo.update(
                organization,
                update_dict={
                    **form_dict,
                    "feature_settings": updated_feature_settings,
                },
            )
            return HXRedirectResponse(
                request, str(request.url_for("organizations:get", id=id)), 303
            )

        except ValidationError as e:
            validation_error = e

    # Prepare data for form rendering with current feature settings
    # Dynamically populate all feature flags from OrganizationFeatureSettings
    form_data = {
        "name": organization.name,
        "slug": organization.slug,
        "customer_invoice_prefix": organization.customer_invoice_prefix,
        "feature_flags": {
            field_name: organization.feature_settings.get(field_name, False)
            for field_name in OrganizationFeatureSettings.model_fields.keys()
        },
    }

    with modal("Update Organization", open=True):
        with UpdateOrganizationForm.render(
            form_data,
            hx_post=str(request.url_for("organizations:update", id=id)),
            hx_target="#modal",
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
            form = UpdateOrganizationDetailsForm.model_validate_form(data)
            organization = await org_repo.update(
                organization, update_dict=form.model_dump(exclude_none=True)
            )
            return HXRedirectResponse(
                request, str(request.url_for("organizations:get", id=id)), 303
            )

        except ValidationError as e:
            validation_error = e

    with modal("Edit Business Information", open=True):
        with tag.p(classes="text-sm text-base-content-secondary"):
            text("Update the key information about your business and products")

        with UpdateOrganizationDetailsForm.render(
            data=organization,
            validation_error=validation_error,
            hx_post=str(request.url_for("organizations:update_details", id=id)),
            hx_target="#modal",
            classes="space-y-6",
        ):
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


@router.api_route(
    "/{id}/update_internal_notes",
    name="organizations:update_internal_notes",
    methods=["GET", "POST"],
)
async def update_internal_notes(
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
            form = UpdateOrganizationInternalNotesForm.model_validate_form(data)
            organization = await org_repo.update(
                organization, update_dict=form.model_dump(exclude_none=True)
            )
            return HXRedirectResponse(
                request, str(request.url_for("organizations:get", id=id)), 303
            )

        except ValidationError as e:
            validation_error = e

    with modal("Edit Internal Notes", open=True):
        with tag.p(classes="text-sm text-base-content-secondary"):
            text("Add or update internal notes about this organization (admin only)")

        with UpdateOrganizationInternalNotesForm.render(
            data=organization,
            validation_error=validation_error,
            hx_post=str(request.url_for("organizations:update_internal_notes", id=id)),
            hx_target="#modal",
            classes="space-y-4",
        ):
            # Action buttons
            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Save Notes")


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

    except Exception:
        raise HTTPException(
            status_code=500, detail="An error occurred while removing the user"
        )


@router.get(
    "/{id}/confirm_change_admin/{user_id}", name="organizations:confirm_change_admin"
)
async def confirm_change_admin(
    request: Request,
    id: UUID4,
    user_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Show confirmation modal for changing account admin."""

    # Get organization and account
    org_repo = OrganizationRepository.from_session(session)
    organization = await org_repo.get_by_id(
        id, options=(joinedload(Organization.account),)
    )

    if not organization or not organization.account:
        raise HTTPException(status_code=404, detail="Organization or account not found")

    # Get current admin
    current_admin = await org_repo.get_admin_user(session, organization)

    # Get new admin user info
    user_repo = UserRepository.from_session(session)
    new_admin = await user_repo.get_by_id(user_id)

    if not new_admin:
        raise HTTPException(status_code=404, detail="User not found")

    # Check all the conditions that might prevent changing admin
    has_stripe_account = bool(organization.account.stripe_id)
    user_not_verified = (
        new_admin.identity_verification_status != IdentityVerificationStatus.verified
    )
    not_enough_users = (
        len(await user_repo.get_all_by_organization(organization.id)) <= 1
    )

    # Determine if admin change is blocked and why
    is_blocked = has_stripe_account or user_not_verified or not_enough_users

    with modal("Change Account Admin", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            # Show appropriate alert based on blocking conditions
            if is_blocked:
                with tag.div(classes="alert alert-error"):
                    with tag.div():
                        with tag.h3(classes="font-bold"):
                            text("Cannot Change Admin")
                        if has_stripe_account:
                            with tag.p():
                                text(
                                    "To change account admin, first delete the Stripe account using backoffice account management."
                                )
                        elif user_not_verified:
                            with tag.p():
                                text(
                                    "The selected user must be verified in Stripe before they can become an admin. Please ensure they complete identity verification first."
                                )
                        elif not_enough_users:
                            with tag.p():
                                text(
                                    "Need at least 2 team members to change account admin."
                                )
            else:
                with tag.div(classes="alert alert-success"):
                    with tag.div():
                        with tag.h3(classes="font-bold"):
                            text("Change Account Administrator")
                        with tag.p():
                            text(
                                "Account admin can now be changed. This will change who has admin control over the account."
                            )

            with tag.div(classes="space-y-4"):
                with tag.div():
                    with tag.h4(classes="font-semibold text-sm"):
                        text("Current Admin:")
                    with tag.p(classes="text-gray-600"):
                        if current_admin:
                            text(current_admin.email)
                        else:
                            text("No current admin found")

                with tag.div():
                    with tag.h4(classes="font-semibold text-sm"):
                        text("New Admin:")
                    with tag.p(classes="text-gray-600"):
                        text(new_admin.email)

                # Show verification status
                with tag.div():
                    with tag.h4(classes="font-semibold text-sm"):
                        text("Identity Verification Status:")
                    verification_status = new_admin.identity_verification_status
                    if verification_status == IdentityVerificationStatus.verified:
                        with tag.p(classes="text-green-600 font-medium"):
                            text("✅ Verified")
                    else:
                        with tag.p(classes="text-red-600 font-medium"):
                            text(f"❌ {verification_status.get_display_name()}")

            # Show warning if user is not verified
            if (
                new_admin.identity_verification_status
                != IdentityVerificationStatus.verified
            ):
                with tag.div(classes="alert alert-error"):
                    with tag.div():
                        with tag.h3(classes="font-bold"):
                            text("Cannot Change Admin")
                        with tag.p():
                            text(
                                "The selected user must be verified in Stripe before they can become an admin. Please ensure they complete identity verification first."
                            )

        # Action buttons
        with tag.div(classes="modal-action"):
            with tag.form(method="dialog"):
                with button(ghost=True):
                    text("Cancel")

            # Show button based on blocking conditions
            if is_blocked:
                # Show disabled button with appropriate message
                with button(variant="primary", disabled=True):
                    if has_stripe_account:
                        text("Change Admin (Delete Stripe Account First)")
                    elif user_not_verified:
                        text("Change Admin (Requires Verification)")
                    elif not_enough_users:
                        text("Change Admin (Need More Members)")
            else:
                # All conditions met - show active button
                with tag.form(method="dialog"):
                    with button(
                        variant="primary",
                        hx_post=str(
                            request.url_for(
                                "organizations:change_admin",
                                id=id,
                                user_id=user_id,
                            )
                        ),
                        hx_target="#modal",
                    ):
                        text("Change Admin")


@router.api_route(
    "/{id}/change_admin/{user_id}",
    name="organizations:change_admin",
    methods=["POST"],
)
async def change_admin(
    request: Request,
    id: UUID4,
    user_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Change account admin endpoint."""

    try:
        # Get organization and account
        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(
            id, options=(joinedload(Organization.account),)
        )

        if not organization or not organization.account:
            raise HTTPException(
                status_code=404, detail="Organization or account not found"
            )

        # Get user info for better error messages
        user_repo = UserRepository.from_session(session)
        user = await user_repo.get_by_id(user_id)
        user_email = user.email if user else str(user_id)

        # Change the admin
        await account_service.change_admin(
            session, organization.account, user_id, organization.id
        )

        # Add success toast and redirect
        await add_toast(
            request,
            f"Account admin changed to {user_email}",
            "success",
        )

        return HXRedirectResponse(
            request, request.url_for("organizations:get", id=id), 303
        )

    except CannotChangeAdminError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except UserNotOrganizationMemberError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception:
        raise HTTPException(
            status_code=500, detail="An error occurred while changing the admin"
        )


@router.api_route(
    "/{id}/setup_manual_payout",
    name="organizations:setup_manual_payout",
    methods=["GET", "POST"],
)
async def setup_manual_payout(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    org_repo = OrganizationRepository.from_session(session)
    organization = await org_repo.get_by_id(id)
    if not organization:
        raise HTTPException(status_code=404)

    # Check if organization already has an account
    if organization.account_id is not None:
        raise HTTPException(
            status_code=400, detail="Organization already has an account"
        )

    if request.method == "POST":
        # Create a manual account for the organization
        # Get country from form data
        data = await request.form()
        country = data.get("country", "US")

        # Get the first user of the organization as admin
        user_repository = UserRepository.from_session(session)
        users = await user_repository.get_all_by_organization(organization.id)
        if not users:
            raise HTTPException(status_code=400, detail="Organization has no users")

        admin_user = users[0]  # Use first user as admin

        # Create manual account
        account = Account(
            account_type=AccountType.manual,
            admin_id=admin_user.id,
            country=country,
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            processor_fees_applicable=False,  # No processor fees for manual accounts
            status=Account.Status.ACTIVE,
        )

        session.add(account)
        await session.flush()

        # Associate account with organization
        organization = await org_repo.update(
            organization, update_dict={"account_id": account.id}
        )

        await add_toast(
            request,
            f"Manual payout account created for {organization.name}",
            "success",
        )

        return HXRedirectResponse(
            request, str(request.url_for("organizations:get", id=id)), 303
        )

    with modal("Setup Manual Payout", open=True):
        with tag.form(method="POST", action=str(request.url), classes="flex flex-col"):
            # Warning message
            with tag.div(classes="alert alert-warning"):
                with tag.svg(
                    classes="stroke-current shrink-0 h-6 w-6",
                    fill="none",
                    viewBox="0 0 24 24",
                ):
                    with tag.path(
                        stroke_linecap="round",
                        stroke_linejoin="round",
                        stroke_width="2",
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
                    ):
                        pass
                with tag.span(classes="font-semibold"):
                    text(
                        "Should only be enabled by Birk at this stage since its manual and reserved for a few customers in alpha"
                    )

            with tag.p():
                text("This will create a manual payout account for this organization.")

            # Country selection
            with tag.div(classes="form-control w-full"):
                with tag.label(classes="label"):
                    with tag.span(classes="label-text"):
                        text("Country Code")
                with tag.input(
                    type="text",
                    name="country",
                    required=True,
                    maxlength="2",
                    minlength="2",
                    pattern="[A-Z]{2}",
                    placeholder="US",
                    classes="input input-bordered w-full",
                    title="Enter a 2-letter country code (e.g., US, GB, CA)",
                ):
                    pass
                with tag.p(classes="text-xs text-gray-500 mt-1"):
                    text("Enter a 2-letter ISO country code (e.g., US, GB, CA)")

            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Create Manual Account")


@router.post(
    "/{id}/create_plain_thread",
    name="organizations:create_plain_thread",
)
async def create_plain_thread(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Create a Plain thread for this organization."""
    try:
        form = await request.form()
        logger.info(f"Form data received: {dict(form)}")
        title_field = form.get("title", "")
        title = title_field.strip() if isinstance(title_field, str) else ""
        logger.info(f"Extracted title: '{title}'")
        if not title:
            await add_toast(
                request,
                "Thread title is required",
                "error",
            )
            return RedirectResponse(
                url=request.url_for("organizations:get_organization", id=id),
                status_code=302,
            )

        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(id)
        if not organization:
            raise HTTPException(status_code=404)

        admin_user = await org_repo.get_admin_user(session, organization)
        if not admin_user:
            raise HTTPException(status_code=404, detail="No admin user found")

        thread_id = await plain_service.create_manual_organization_thread(
            session, organization, admin_user, title
        )
        logger.info(
            f"Created Plain thread {thread_id} for organization {organization.id}"
        )

        thread_url = f"https://app.plain.com/workspace/w_01JE9TRRX9KT61D8P2CH77XDQM/thread/{thread_id}"

        with document() as doc:
            with tag.div(id="modal"):
                with tag.dialog(classes="modal modal-open"):
                    with tag.div(classes="modal-box"):
                        with tag.h3(classes="font-bold text-lg text-success"):
                            text("✅ Thread Created Successfully!")

                        with tag.p(classes="py-4"):
                            text(
                                "Your Plain thread has been created. Click the link below to open it:"
                            )

                        with tag.div(classes="modal-action"):
                            with tag.a(
                                href=thread_url,
                                target="_blank",
                                classes="btn btn-primary",
                            ):
                                text("🔗 Open Plain Thread")
                            with tag.button(
                                type="button",
                                classes="btn",
                                hx_get=str(
                                    request.url_for(
                                        "organizations:clear_modal",
                                        id=organization.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Close")

                    with tag.div(
                        classes="modal-backdrop",
                        hx_get=str(
                            request.url_for(
                                "organizations:clear_modal", id=organization.id
                            )
                        ),
                        hx_target="#modal",
                    ):
                        pass

        return HTMLResponse(str(doc))

    except Exception as e:
        logger.error(f"Error in create_plain_thread: {str(e)}", exc_info=True)
        await add_toast(
            request,
            f"Failed to create Plain thread: {str(e)}",
            "error",
        )

        return HXRedirectResponse(
            request, str(request.url_for("organizations:get", id=id)), 303
        )


class FileDownloadLinkColumn(datatable.DatatableColumn[File]):
    """A column that displays a download link for a file."""

    def __init__(self, label: str = "Download"):
        super().__init__(label)

    def render(self, request: Request, item: File) -> Generator[None]:
        """Render a download link for the file."""
        url, _ = file_service.generate_download_url(item)
        with tag.a(
            href=url, classes="btn btn-sm", target="_blank", rel="noopener noreferrer"
        ):
            with tag.div(classes="icon-download"):
                pass
            text("Download")
        yield


class FileSizeColumn(datatable.DatatableAttrColumn[File, FileSortProperty]):
    """A column that displays file size with proper formatting."""

    @override
    def get_value(self, item: File) -> str | None:
        raw_value: int | None = self.get_raw_value(item)
        return formatters.file_size(raw_value) if raw_value is not None else None


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
    if request.method == "POST":
        # This part handles the "Approve" action
        # It's a POST to the current page URL, not the status update URL
        data = await request.form()
        try:
            account_status = OrganizationStatusFormAdapter.validate_python(data)
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
            elif account_status.action == "approve_appeal":
                await organization_service.approve_appeal(session, organization)
            elif account_status.action == "deny_appeal":
                await organization_service.deny_appeal(session, organization)
            return HXRedirectResponse(request, request.url, 303)
        except ValidationError as e:
            validation_error = e

    # Create payment verdict after validation_error is potentially set
    payment_verdict = PaymentVerdict(
        payment_stats,
        organization,
        show_actions,
        request,
        validation_error,
    )

    # Create AI review verdict
    ai_review_verdict = AIReviewVerdict(organization.review, organization, request)

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
                    # Plain Actions
                    with tag.a(
                        classes="btn",
                        href=str(
                            request.url_for(
                                "organizations:plain_search_url", id=organization.id
                            )
                        ),
                        title="Search in Plain",
                        target="_blank",
                    ):
                        with tag.div(classes="icon-search"):
                            pass
                        text("Search in Plain")
                    with tag.button(
                        classes="btn",
                        hx_get=str(
                            request.url_for(
                                "organizations:create_thread_modal", id=organization.id
                            )
                        ),
                        hx_target="#modal",
                        title="Create Thread in Plain",
                    ):
                        with tag.div(classes="icon-message-square-more"):
                            pass
                        text("Create Thread")
                    with tag.button(
                        classes="btn",
                        hx_get=str(
                            request.url_for(
                                "organizations:import_orders", id=organization.id
                            )
                        ),
                        hx_target="#modal",
                        title="Import Orders",
                    ):
                        with tag.div(classes="icon-upload"):
                            pass
                        text("Import Orders")
                    with button(
                        variant="primary",
                        hx_get=str(
                            request.url_for("organizations:update", id=organization.id)
                        ),
                        hx_target="#modal",
                    ):
                        text("Edit")
                    with tag.a(
                        classes="btn",
                        href=str(
                            request.url_for(
                                "organizations-v2:detail",
                                organization_id=organization.id,
                            )
                        ),
                        title="Switch to new view",
                    ):
                        text("View V2")
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
                    description_list.DescriptionListSocialsItem("Social Links"),
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
                                                        # Impersonate button (always visible)
                                                        with tag.button(
                                                            classes="btn btn-primary btn-sm",
                                                            name="user_id",
                                                            value=str(user.id),
                                                            hx_post=str(
                                                                request.url_for(
                                                                    "backoffice:start_impersonation",
                                                                )
                                                            ),
                                                            hx_confirm="Are you sure you want to impersonate this user?",
                                                        ):
                                                            text("Impersonate")

                                                        # More actions dropdown menu
                                                        if not is_admin:
                                                            # Check if we can show Change Admin button
                                                            can_change_admin = (
                                                                account  # Has account
                                                                and not account.stripe_id  # Stripe account deleted
                                                                and len(users)
                                                                > 1  # More than one user
                                                                and user.identity_verification_status
                                                                == IdentityVerificationStatus.verified  # User must be verified
                                                            )

                                                            with tag.div(
                                                                classes="dropdown dropdown-end"
                                                            ):
                                                                with tag.div(
                                                                    classes="btn btn-ghost btn-sm",
                                                                    tabindex="0",
                                                                    role="button",
                                                                ):
                                                                    # Three dots icon
                                                                    with tag.svg(
                                                                        classes="w-4 h-4",
                                                                        fill="currentColor",
                                                                        viewBox="0 0 20 20",
                                                                    ):
                                                                        with tag.path(
                                                                            d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
                                                                        ):
                                                                            pass

                                                                with tag.ul(
                                                                    classes="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow",
                                                                    tabindex="0",
                                                                ):
                                                                    # Make Admin option (always show, handle restrictions in modal)
                                                                    with tag.li():
                                                                        with tag.a(
                                                                            hx_get=str(
                                                                                request.url_for(
                                                                                    "organizations:confirm_change_admin",
                                                                                    id=organization.id,
                                                                                    user_id=user.id,
                                                                                )
                                                                            ),
                                                                            hx_target="#modal",
                                                                            classes="text-warning hover:bg-warning hover:text-warning-content",
                                                                        ):
                                                                            text(
                                                                                "Make Admin"
                                                                            )

                                                                    # Remove option
                                                                    with tag.li():
                                                                        with tag.a(
                                                                            hx_get=str(
                                                                                request.url_for(
                                                                                    "organizations:confirm_remove_member",
                                                                                    id=organization.id,
                                                                                    user_id=user.id,
                                                                                )
                                                                            ),
                                                                            hx_target="#modal",
                                                                            classes="text-error hover:bg-error hover:text-error-content",
                                                                        ):
                                                                            text(
                                                                                "Remove Member"
                                                                            )

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

                            # Show admin change status
                            if account and len(users) <= 1:
                                with tag.div(
                                    classes="mt-4 p-3 bg-gray-50 border border-gray-200 rounded"
                                ):
                                    with tag.p(classes="text-sm text-gray-600"):
                                        text(
                                            "ℹ️ Need at least 2 team members to change account admin."
                                        )
                        else:
                            with tag.div(classes="text-center py-8"):
                                with tag.p(classes="text-gray-600 mb-4"):
                                    text(
                                        "No account has been set up for this organization"
                                    )
                                with button(
                                    hx_get=str(
                                        request.url_for(
                                            "organizations:setup_manual_payout",
                                            id=organization.id,
                                        )
                                    ),
                                    hx_target="#modal",
                                    variant="primary",
                                ):
                                    text("Setup Manual Account")

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

            # Internal Notes Section
            with tag.div(classes="card card-border w-full shadow-sm"):
                with tag.div(classes="card-body"):
                    with tag.div(classes="flex justify-between items-center mb-4"):
                        with tag.h2(classes="card-title"):
                            text("Internal Notes")
                        with button(
                            hx_get=str(
                                request.url_for(
                                    "organizations:update_internal_notes",
                                    id=organization.id,
                                )
                            ),
                            hx_target="#modal",
                            variant="secondary",
                        ):
                            text("Edit Notes")

                    if organization.internal_notes:
                        with tag.div(classes="prose max-w-none"):
                            with tag.p(classes="whitespace-pre-line text-sm"):
                                text(organization.internal_notes)
                    else:
                        with tag.div(classes="text-center py-4"):
                            with tag.p(classes="text-gray-400"):
                                text("No internal notes yet")

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

            # Organization Files Section
            with tag.div(classes="mt-8"):
                with tag.div(classes="flex items-center gap-4 mb-4"):
                    with tag.h2(classes="text-2xl font-bold"):
                        text("Downloadable Files")

                sorting: builtins.list[Sorting[FileSortProperty]] = [
                    (FileSortProperty.created_at, True)
                ]
                file_repository = FileRepository.from_session(session)
                files = await file_repository.get_all_by_organization(
                    organization.id,
                    service=FileServiceTypes.downloadable,
                    sorting=sorting,
                )

                with datatable.Datatable[File, FileSortProperty](
                    datatable.DatatableAttrColumn("name", "Name"),
                    datatable.DatatableDateTimeColumn("created_at", "Created At"),
                    datatable.DatatableAttrColumn("mime_type", "MIME Type"),
                    FileSizeColumn("size", "Size"),
                    FileDownloadLinkColumn(),
                    empty_message="No downloadable files found",
                ).render(request, files, sorting=sorting):
                    pass


@router.get("/{id}/plain_search_url", name="organizations:plain_search_url")
async def get_plain_search_url(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Get the Plain search URL for this organization's admin."""
    org_repo = OrganizationRepository.from_session(session)
    organization = await org_repo.get_by_id(id)
    if not organization:
        raise HTTPException(status_code=404)

    admin_user = await org_repo.get_admin_user(session, organization)
    if not admin_user:
        raise HTTPException(status_code=404, detail="No admin user found")

    search_url = f"https://app.plain.com/workspace/w_01JE9TRRX9KT61D8P2CH77XDQM/search/?q={admin_user.email}"

    return RedirectResponse(url=search_url, status_code=302)


@router.get("/{id}/create_thread_modal", name="organizations:create_thread_modal")
async def get_create_thread_modal(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    """Get the create thread modal HTML."""
    org_repo = OrganizationRepository.from_session(session)
    organization = await org_repo.get_by_id(id)
    if not organization:
        raise HTTPException(status_code=404)

    with document() as doc:
        with tag.div(id="modal"):
            with tag.dialog(classes="modal modal-open"):
                with tag.div(classes="modal-box"):
                    with tag.form(method="dialog"):
                        with tag.button(
                            classes="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                        ):
                            text("✕")

                    with tag.h3(classes="font-bold text-lg"):
                        text("Create Plain Thread")

                    with tag.form(
                        id="create-thread-form",
                        hx_post=str(
                            request.url_for(
                                "organizations:create_plain_thread", id=organization.id
                            )
                        ),
                        hx_target="#modal",
                    ):
                        with tag.div(classes="form-control w-full mt-4"):
                            with tag.label(classes="label"):
                                with tag.span(classes="label-text"):
                                    text("Thread Title")
                            with tag.input(
                                type="text",
                                name="title",
                                placeholder="Enter thread title...",
                                classes="input input-bordered w-full",
                                required=True,
                                autofocus=True,
                            ):
                                pass

                        with tag.div(classes="modal-action"):
                            with tag.button(
                                type="button",
                                classes="btn",
                                hx_get=str(
                                    request.url_for(
                                        "organizations:clear_modal", id=organization.id
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Cancel")
                            with tag.button(
                                type="submit",
                                classes="btn btn-primary",
                            ):
                                text("Create Thread")

                with tag.div(
                    classes="modal-backdrop",
                    hx_get=str(
                        request.url_for("organizations:clear_modal", id=organization.id)
                    ),
                    hx_target="#modal",
                ):
                    pass

    return HTMLResponse(str(doc))


@router.get("/{id}/clear_modal", name="organizations:clear_modal")
async def clear_modal(id: UUID4) -> Any:
    """Clear the modal content."""
    return HTMLResponse('<div id="modal"></div>')


@router.api_route(
    "/{id}/import-orders", name="organizations:import_orders", methods=["GET", "POST"]
)
async def import_orders(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = OrganizationRepository.from_session(session)
    organization = await repository.get_by_id(id)

    if organization is None:
        raise HTTPException(status_code=404)

    validation_error: ValidationError | None = None
    if request.method == "POST":
        data = await request.form()
        try:
            form = OrganizationOrdersImportForm.model_validate_form(data)
            return EventSourceResponse(
                orders_import_sse(
                    session,
                    organization,
                    form.file,
                    invoice_number_prefix=form.invoice_number_prefix,
                )
            )
        except ValidationError as e:
            validation_error = e

    with modal("Import Orders", open=True):
        with OrganizationOrdersImportForm.render(
            {"invoice_number_prefix": "IMPORTED-"},
            action=str(request.url),
            method="POST",
            classes="flex flex-col",
            validation_error=validation_error,
            _="on submit halt the event then call formPostSSE(me, '#import-progress')",
        ):
            with tag.div(id="import-progress"):
                pass
            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Import")
