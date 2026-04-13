import builtins
import contextlib
import uuid
from collections.abc import Generator
from dataclasses import dataclass
from datetime import UTC, datetime
from difflib import SequenceMatcher
from typing import Annotated, Any

import stripe as stripe_lib
from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload
from tagflow import classes, tag, text

from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import User, UserOrganization
from polar.models.user import IdentityVerificationStatus, OAuthAccount
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.user import sorting
from polar.user.repository import UserRepository
from polar.user.schemas import UserDeletionBlockedReason
from polar.user.service import user as user_service
from polar.user.sorting import UserSortProperty

from ..components import button, datatable, description_list, input, modal
from ..layout import layout
from ..toast import add_toast
from .views.modals import DeleteIdentityVerificationModal

router = APIRouter()


@contextlib.contextmanager
def identity_verification_status_badge(
    status: IdentityVerificationStatus,
) -> Generator[None]:
    with tag.div(classes="badge"):
        if status == IdentityVerificationStatus.verified:
            classes("badge-success")
        elif status in {
            IdentityVerificationStatus.pending,
            IdentityVerificationStatus.failed,
        }:
            classes("badge-warning")
        else:
            classes("badge-neutral")
        text(status.get_display_name())
    yield


class IdentityVerificationStatusColumn(
    datatable.DatatableAttrColumn[User, UserSortProperty]
):
    def render(self, request: Request, item: User) -> Generator[None] | None:
        status = item.identity_verification_status
        with identity_verification_status_badge(status):
            pass
        return None


class FullNameColumn(datatable.DatatableAttrColumn[User, UserSortProperty]):
    def __init__(self) -> None:
        super().__init__("full_name", "Full Name")


@dataclass
class IdentityMatchResult:
    first_name_score: float
    last_name_score: float
    country_match: bool | None
    dob_match: bool | None
    overall_score: float


def _fuzzy_name_score(
    user_name: str | None, verified_parts: builtins.list[str]
) -> float:
    if not user_name:
        return 0.0
    user_lower = user_name.strip().lower()
    if not user_lower:
        return 0.0
    best = 0.0
    for part in verified_parts:
        part_lower = part.strip().lower()
        if not part_lower:
            continue
        if user_lower == part_lower:
            return 1.0
        if part_lower.startswith(user_lower) and len(user_lower) >= 3:
            best = max(best, 0.85)
        elif user_lower in part_lower or part_lower in user_lower:
            best = max(best, 0.7)
        ratio = SequenceMatcher(None, user_lower, part_lower).ratio()
        best = max(best, ratio)
    return best


def compute_identity_match(
    user: User,
    verified_first_name: str | None,
    verified_last_name: str | None,
    verified_country: str | None,
    verified_dob: str | None,
) -> IdentityMatchResult | None:
    # Need at least one field on both sides to compare
    has_user_info = any(
        [user.first_name, user.last_name, user.country, user.date_of_birth]
    )
    has_verified_info = any(
        [verified_first_name, verified_last_name, verified_country, verified_dob]
    )
    if not has_user_info or not has_verified_info:
        return None

    first_name_parts = verified_first_name.split() if verified_first_name else []
    if verified_first_name and len(first_name_parts) > 1:
        first_name_parts.append(verified_first_name)
    last_name_parts = verified_last_name.split() if verified_last_name else []
    if verified_last_name and len(last_name_parts) > 1:
        last_name_parts.append(verified_last_name)

    first_name_score = _fuzzy_name_score(user.first_name, first_name_parts)
    last_name_score = _fuzzy_name_score(user.last_name, last_name_parts)

    country_match: bool | None = None
    if user.country and verified_country:
        country_match = user.country.upper() == verified_country.upper()

    dob_match: bool | None = None
    if user.date_of_birth and verified_dob:
        dob_match = user.date_of_birth.isoformat() == verified_dob

    scores: builtins.list[float] = []
    weights: builtins.list[float] = []
    if user.first_name and verified_first_name:
        scores.append(first_name_score)
        weights.append(0.3)
    if user.last_name and verified_last_name:
        scores.append(last_name_score)
        weights.append(0.3)
    if country_match is not None:
        scores.append(1.0 if country_match else 0.0)
        weights.append(0.2)
    if dob_match is not None:
        scores.append(1.0 if dob_match else 0.0)
        weights.append(0.2)

    total_weight = sum(weights)
    overall = (
        sum(s * w for s, w in zip(scores, weights)) / total_weight
        if total_weight > 0
        else 0.0
    )

    return IdentityMatchResult(
        first_name_score=first_name_score,
        last_name_score=last_name_score,
        country_match=country_match,
        dob_match=dob_match,
        overall_score=overall,
    )


def _score_color(score: float) -> str:
    if score >= 0.8:
        return "text-success"
    if score >= 0.5:
        return "text-warning"
    return "text-error"


def _render_match_row(
    label: str,
    user_val: str | None,
    verified_val: str | None,
    score: float | None = None,
    score_text: str | None = None,
) -> None:
    with tag.tr():
        with tag.td(classes="font-medium"):
            text(label)
        with tag.td():
            text(user_val or "—")
        with tag.td():
            text(verified_val or "—")
        if score_text is not None:
            with tag.td(classes=_score_color(score) if score is not None else ""):
                text(score_text)


class OAuthPlatformColumn(
    datatable.DatatableAttrColumn[OAuthAccount, UserSortProperty]
):
    def get_value(self, item: OAuthAccount) -> str | None:
        return str(item.platform)


class OAuthExpiresAtColumn(
    datatable.DatatableAttrColumn[OAuthAccount, UserSortProperty]
):
    def get_value(self, item: OAuthAccount) -> str | None:
        if item.expires_at is None:
            return None
        return datetime.fromtimestamp(item.expires_at, tz=UTC).strftime(
            "%Y-%m-%d %H:%M:%S"
        )


@router.get("/", name="users:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    identity_verification_status: Annotated[
        IdentityVerificationStatus | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = UserRepository.from_session(session)
    statement = repository.get_base_statement()
    if query:
        try:
            statement = statement.where(User.id == uuid.UUID(query))
        except ValueError:
            statement = (
                statement.outerjoin(User.oauth_accounts)
                .where(
                    or_(
                        User.email.ilike(f"%{query}%"),
                        OAuthAccount.account_email.ilike(f"%{query}%"),
                    )
                )
                .distinct()
            )
    if identity_verification_status:
        statement = statement.where(
            User.identity_verification_status == identity_verification_status
        )

    statement = repository.apply_sorting(statement, sorting)
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Users", str(request.url_for("users:list"))),
        ],
        "users:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Users")
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search("query", query):
                    pass
                with input.select(
                    [
                        ("All Identity Statuses", ""),
                        *[
                            (status.get_display_name(), status.value)
                            for status in IdentityVerificationStatus
                        ],
                    ],
                    identity_verification_status.value
                    if identity_verification_status
                    else "",
                    name="identity_verification_status",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")
            with datatable.Datatable[User, UserSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="users:get", clipboard=True
                ),
                datatable.DatatableAttrColumn(
                    "email", "Email", clipboard=True, sorting=UserSortProperty.email
                ),
                FullNameColumn(),
                datatable.DatatableDateTimeColumn(
                    "created_at",
                    "Created At",
                    sorting=UserSortProperty.created_at,
                ),
                IdentityVerificationStatusColumn(
                    "identity_verification_status", "Identity"
                ),
            ).render(request, items, sorting=sorting):
                pass
            with datatable.pagination(request, pagination, count):
                pass


@router.api_route("/{id}", name="users:get", methods=["GET", "POST"])
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = UserRepository.from_session(session)
    user = await repository.get_by_id(id)

    if user is None:
        raise HTTPException(status_code=404)

    # Fetch Stripe verified outputs for identity comparison
    identity_match: IdentityMatchResult | None = None
    verified_first_name: str | None = None
    verified_last_name: str | None = None
    verified_country: str | None = None
    verified_dob: str | None = None
    if user.identity_verification_id is not None:
        try:
            vs = await stripe_service.get_verification_session(
                user.identity_verification_id,
                expand=["verified_outputs"],
            )
            verified_outputs = getattr(vs, "verified_outputs", None)
            if verified_outputs:
                verified_first_name = getattr(verified_outputs, "first_name", None)
                verified_last_name = getattr(verified_outputs, "last_name", None)
                address = getattr(verified_outputs, "address", None)
                if address:
                    verified_country = address.country
                dob = getattr(verified_outputs, "dob", None)
                if dob and dob.year and dob.month and dob.day:
                    verified_dob = f"{dob.year}-{dob.month:02d}-{dob.day:02d}"

                identity_match = compute_identity_match(
                    user,
                    verified_first_name,
                    verified_last_name,
                    verified_country,
                    verified_dob,
                )
        except stripe_lib.StripeError:
            pass

    with layout(
        request,
        [
            ("Users", str(request.url_for("users:list"))),
            (user.email, str(request.url)),
        ],
        "users:get",
    ):
        #################
        ### User info ###
        #################
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex items-center justify-between"):
                with tag.h1(classes="text-4xl"):
                    text(user.full_name or user.email)

                # Actions dropdown menu
                with tag.div(classes="dropdown dropdown-end"):
                    with tag.button(
                        classes="btn btn-circle btn-ghost",
                        tabindex="0",
                        **{"aria-label": "More options"},
                    ):
                        text("⋮")
                    with tag.ul(
                        classes="dropdown-content menu shadow bg-base-100 rounded-box w-56 z-10",
                        tabindex="0",
                    ):
                        # Show Delete Identity Verification only if user has identity verification
                        if user.identity_verification_id is not None:
                            with tag.li():
                                with tag.a(
                                    hx_get=str(
                                        request.url_for(
                                            "users:delete-identity-verification",
                                            id=user.id,
                                        )
                                    ),
                                    hx_target="#modal",
                                    classes="text-error",
                                ):
                                    text("Delete Identity Verification")

                        # Always show Delete User action
                        with tag.li():
                            with tag.a(
                                hx_get=str(
                                    request.url_for(
                                        "users:delete",
                                        id=user.id,
                                    )
                                ),
                                hx_target="#modal",
                                classes="text-error",
                            ):
                                text("Delete User")
            with description_list.DescriptionList[User](
                description_list.DescriptionListAttrItem("id", "ID", clipboard=True),
                description_list.DescriptionListAttrItem(
                    "email", "Email", clipboard=True
                ),
                description_list.DescriptionListDateTimeItem(
                    "created_at", "Created At"
                ),
                description_list.DescriptionListDateTimeItem(
                    "blocked_at", "Blocked At"
                ),
            ).render(request, user):
                pass

        ################
        ### Identity ###
        ################
        with tag.div(classes="flex flex-col gap-4 pt-8"):
            with tag.div(classes="flex items-center gap-2"):
                with tag.h2(classes="text-2xl"):
                    text("Identity")
                status = user.identity_verification_status
                if user.identity_verification_id is not None:
                    with tag.a(
                        href=f"https://dashboard.stripe.com/identity/verification-sessions/{user.identity_verification_id}",
                        classes="link",
                        target="_blank",
                        rel="noopener noreferrer",
                    ):
                        with identity_verification_status_badge(status):
                            pass
                else:
                    with identity_verification_status_badge(status):
                        pass
                if identity_match is not None:
                    overall_pct = int(identity_match.overall_score * 100)
                    if overall_pct >= 80:
                        badge_class = "badge-success"
                    elif overall_pct >= 50:
                        badge_class = "badge-warning"
                    else:
                        badge_class = "badge-error"
                    with tag.div(classes=f"badge {badge_class}"):
                        text(f"{overall_pct}% match")

            with tag.div(
                classes="overflow-x-auto rounded-box bg-base-100 border-1 border-base-200",
            ):
                with tag.table(classes="table"):
                    with tag.thead():
                        with tag.tr():
                            with tag.th():
                                pass
                            with tag.th():
                                text("User")
                            with tag.th():
                                text("Verified")
                            if identity_match is not None:
                                with tag.th():
                                    text("Score")
                    with tag.tbody():
                        _render_match_row(
                            "First Name",
                            user.first_name,
                            verified_first_name,
                            score=identity_match.first_name_score
                            if identity_match
                            else None,
                            score_text=f"{int(identity_match.first_name_score * 100)}%"
                            if identity_match
                            else None,
                        )
                        _render_match_row(
                            "Last Name",
                            user.last_name,
                            verified_last_name,
                            score=identity_match.last_name_score
                            if identity_match
                            else None,
                            score_text=f"{int(identity_match.last_name_score * 100)}%"
                            if identity_match
                            else None,
                        )
                        _render_match_row(
                            "Country",
                            user.country,
                            verified_country,
                            score=1.0
                            if identity_match and identity_match.country_match
                            else 0.0
                            if identity_match
                            and identity_match.country_match is not None
                            else None,
                            score_text="Match"
                            if identity_match and identity_match.country_match
                            else "Mismatch"
                            if identity_match
                            and identity_match.country_match is not None
                            else None,
                        )
                        _render_match_row(
                            "Date of Birth",
                            user.date_of_birth.isoformat()
                            if user.date_of_birth
                            else None,
                            verified_dob,
                            score=1.0
                            if identity_match and identity_match.dob_match
                            else 0.0
                            if identity_match and identity_match.dob_match is not None
                            else None,
                            score_text="Match"
                            if identity_match and identity_match.dob_match
                            else "Mismatch"
                            if identity_match and identity_match.dob_match is not None
                            else None,
                        )

        #####################
        ### Organizations ###
        #####################
        user_orgs_result = await session.execute(
            select(UserOrganization)
            .options(selectinload(UserOrganization.organization))
            .where(UserOrganization.user_id == user.id)
        )
        user_orgs = user_orgs_result.scalars().all()

        with tag.div(classes="flex flex-col gap-4 pt-16"):
            with tag.h2(classes="text-2xl"):
                text("Organizations")
            with datatable.Datatable[UserOrganization, OrganizationSortProperty](
                datatable.DatatableAttrColumn(
                    "organization.id",
                    "ID",
                    external_href=lambda r, i: str(
                        r.url_for(
                            "organizations:detail", organization_id=i.organization_id
                        )
                    ),
                    clipboard=True,
                ),
                datatable.DatatableDateTimeColumn(
                    "organization.created_at", "Created At"
                ),
                datatable.DatatableDateTimeColumn(
                    "organization.deleted_at", "Organization Deleted At"
                ),
                datatable.DatatableDateTimeColumn(
                    "deleted_at", "Membership Deleted At"
                ),
                datatable.DatatableDateTimeColumn(
                    "organization.blocked_at", "Blocked At"
                ),
                datatable.DatatableAttrColumn(
                    "organization.slug",
                    "Slug",
                    clipboard=True,
                ),
                datatable.DatatableActionsColumn(
                    "",
                    datatable.DatatableActionHTMX[UserOrganization](
                        "Delete Organization",
                        lambda r, i: str(
                            r.url_for(
                                "organizations-classic:delete", id=i.organization_id
                            )
                        ),
                        target="#modal",
                        hidden=lambda _, i: i.organization.is_deleted,
                    ),
                ),
            ).render(request, user_orgs):
                pass

        ########################
        ### OAuth Accounts  ###
        ########################
        active_oauth_result = await session.execute(
            select(OAuthAccount).where(
                OAuthAccount.user_id == user.id,
                OAuthAccount.is_deleted.is_(False),
            )
        )
        active_oauth_accounts = active_oauth_result.scalars().all()

        deleted_oauth_result = await session.execute(
            select(OAuthAccount).where(
                OAuthAccount.user_id == user.id,
                OAuthAccount.is_deleted.is_(True),
            )
        )
        deleted_oauth_accounts = deleted_oauth_result.scalars().all()

        with tag.div(classes="flex flex-col gap-4 pt-16"):
            with tag.h2(classes="text-2xl"):
                text("OAuth Accounts")
            with datatable.Datatable[OAuthAccount, UserSortProperty](
                datatable.DatatableAttrColumn("id", "ID", clipboard=True),
                OAuthPlatformColumn("platform", "Platform"),
                datatable.DatatableAttrColumn("account_id", "Account ID"),
                datatable.DatatableAttrColumn("account_email", "Email"),
                datatable.DatatableAttrColumn("account_username", "Username"),
                datatable.DatatableDateTimeColumn("created_at", "Created At"),
                OAuthExpiresAtColumn("expires_at", "Expires At"),
                empty_message="No active OAuth accounts",
            ).render(request, active_oauth_accounts):
                pass

        if deleted_oauth_accounts:
            with tag.div(classes="flex flex-col gap-4 pt-8"):
                with tag.h2(classes="text-2xl text-base-content/60"):
                    text("Deleted OAuth Accounts")
                with datatable.Datatable[OAuthAccount, UserSortProperty](
                    datatable.DatatableAttrColumn("id", "ID", clipboard=True),
                    OAuthPlatformColumn("platform", "Platform"),
                    datatable.DatatableAttrColumn("account_id", "Account ID"),
                    datatable.DatatableAttrColumn("account_email", "Email"),
                    datatable.DatatableAttrColumn("account_username", "Username"),
                    datatable.DatatableDateTimeColumn("created_at", "Created At"),
                    datatable.DatatableDateTimeColumn("deleted_at", "Deleted At"),
                ).render(request, deleted_oauth_accounts):
                    pass


@router.api_route(
    "/{id}/delete",
    name="users:delete",
    methods=["GET", "POST"],
)
async def delete_user(
    request: Request,
    id: UUID4,
    confirm: bool = Form(False),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = UserRepository.from_session(session)
    user = await repository.get_by_id(id)

    if user is None:
        raise HTTPException(status_code=404)

    # Check if user can be deleted
    check_result = await user_service.check_can_delete(session, user)
    has_blocking_reasons = bool(check_result.blocked_reasons)

    if request.method == "POST" and confirm:
        if has_blocking_reasons:
            # Show error if there are blocking reasons
            error_message = "Cannot delete user: "
            if (
                UserDeletionBlockedReason.HAS_ACTIVE_ORGANIZATIONS
                in check_result.blocked_reasons
            ):
                error_message += (
                    "User has active organizations that must be deleted first."
                )
            await add_toast(request, error_message, "error")
            return

        # Perform the soft deletion
        await user_service.soft_delete_user(session, user)
        await add_toast(
            request,
            f"User {user.email} has been soft-deleted",
            "success",
        )
        return

    # Show modal with errors if any
    with modal(f"Delete User {user.email}", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text("Are you sure you want to delete this user? ")
                text("This will soft-delete the user account, anonymize PII, ")
                text("and remove all OAuth accounts. This action cannot be undone.")

            # Show blocking reasons if any
            if has_blocking_reasons:
                with tag.div(classes="alert alert-error"):
                    with tag.div(classes="flex items-center gap-2"):
                        with tag.div(classes="icon-alert-triangle"):
                            pass
                        with tag.p():
                            text("Cannot delete this user:")
                            with tag.ul(classes="list-disc pl-4 mt-1"):
                                if (
                                    UserDeletionBlockedReason.HAS_ACTIVE_ORGANIZATIONS
                                    in check_result.blocked_reasons
                                ):
                                    with tag.li():
                                        text(
                                            "User has active organizations that must be deleted first"
                                        )
                                    with tag.ul(classes="list-disc pl-4 mt-1"):
                                        for org in check_result.blocking_organizations:
                                            with tag.li():
                                                text(f"{org.name} ({org.slug})")

            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                # Only show confirm button if no blocking reasons
                if not has_blocking_reasons:
                    with button(
                        type="button",
                        variant="error",
                        hx_post=str(request.url),
                        hx_target="#modal",
                        hx_vals='{"confirm": "true"}',
                    ):
                        text("Delete User")


@router.api_route(
    "/{id}/delete-identity-verification",
    name="users:delete-identity-verification",
    methods=["GET", "POST"],
)
async def delete_identity_verification(
    request: Request,
    id: UUID4,
    confirm: bool = Form(False),
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = UserRepository.from_session(session)
    user = await repository.get_by_id(id)

    if user is None:
        raise HTTPException(status_code=404)

    if request.method == "POST" and confirm:
        await user_service.delete_identity_verification(session, user)
        await add_toast(
            request,
            f"Identity verification for {user.email} has been deleted and redacted",
            "success",
        )
        return

    form_action = str(request.url_for("users:delete-identity-verification", id=user.id))
    with DeleteIdentityVerificationModal(user, form_action).render():
        pass
