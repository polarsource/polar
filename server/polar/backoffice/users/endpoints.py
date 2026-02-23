import contextlib
import uuid
from collections.abc import Generator
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from tagflow import classes, tag, text

from polar.account.repository import AccountRepository
from polar.account.sorting import AccountSortProperty
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Account, User, UserOrganization
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


class IdentityVerificationStatusDescriptionListItem(
    description_list.DescriptionListItem[User]
):
    def render(self, request: Request, item: User) -> Generator[None] | None:
        status = item.identity_verification_status
        if item.identity_verification_id is not None:
            with tag.a(
                href=f"https://dashboard.stripe.com/identity/verification-sessions/{item.identity_verification_id}",
                classes="link flex flex-row gap-1",
                target="_blank",
                rel="noopener noreferrer",
            ):
                text(status.get_display_name())
                with tag.div(classes="icon-external-link"):
                    pass
        else:
            text(status.get_display_name())
        return None


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
            statement = statement.where(User.email.ilike(f"%{query}%"))
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

    with layout(
        request,
        [
            (user.email, str(request.url)),
            ("Users", str(request.url_for("users:list"))),
        ],
        "users:get",
    ):
        #################
        ### User info ###
        #################
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex items-center justify-between"):
                with tag.h1(classes="text-4xl"):
                    text(user.email)

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
                IdentityVerificationStatusDescriptionListItem("Identity"),
            ).render(request, user):
                pass

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
                        r.url_for("organizations-classic:get", id=i.organization_id)
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

        ################
        ### Accounts ###
        ################
        accounts = await AccountRepository.from_session(session).get_all(
            AccountRepository.from_session(session)
            .get_base_statement(include_deleted=True)
            .where(Account.admin_id == user.id)
        )

        def _stripe_link(request: Request, value: Account) -> str:
            return f"https://dashboard.stripe.com/connect/accounts/{value.stripe_id}"

        with tag.div(classes="flex flex-col gap-4 pt-16"):
            with tag.h2(classes="text-2xl"):
                text("Accounts")
            with datatable.Datatable[Account, AccountSortProperty](
                datatable.DatatableAttrColumn("id", "ID", clipboard=True),
                datatable.DatatableDateTimeColumn("created_at", "Created At"),
                datatable.DatatableDateTimeColumn("deleted_at", "Deleted At"),
                datatable.DatatableAttrColumn(
                    "account_type",
                    "Account Type",
                    external_href=_stripe_link,
                ),
                datatable.DatatableAttrColumn("country", "Country"),
                datatable.DatatableAttrColumn("currency", "Currency"),
                datatable.DatatableAttrColumn(
                    "next_review_threshold", "Next Review Threshold"
                ),
                datatable.DatatableActionsColumn(
                    "",
                    datatable.DatatableActionHTMX[Account](
                        "Delete Stripe Connect account",
                        lambda r, i: str(r.url_for("accounts:delete-stripe", id=i.id)),
                        target="#modal",
                        hidden=lambda _, i: not i.stripe_id,
                    ),
                ),
            ).render(request, accounts):
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
