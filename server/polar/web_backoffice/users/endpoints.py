import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from tagflow import classes, tag, text

from polar.account.repository import AccountRepository
from polar.account.sorting import AccountSortProperty
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Account, Organization, User, UserOrganization
from polar.models.user import IdentityVerificationStatus
from polar.organization.repository import OrganizationRepository
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_session
from polar.user import sorting
from polar.user.repository import UserRepository
from polar.user.sorting import UserSortProperty

from ..components import datatable, description_list, input
from ..layout import layout

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


@router.get("/", name="users:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    identity_verification_status: Annotated[
        IdentityVerificationStatus | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    session: AsyncSession = Depends(get_db_session),
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
                            for status in IdentityVerificationStatus
                        ],
                        identity_verification_status,
                        name="identity_verification_status",
                        placeholder="Identity Verification Status",
                    ):
                        pass
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
            with tag.h1(classes="text-4xl"):
                text(user.email)
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
        orgs = await OrganizationRepository.from_session(session).get_all(
            OrganizationRepository.from_session(session)
            .get_base_statement(include_deleted=True)
            .join(UserOrganization)
            .where(
                UserOrganization.user_id == user.id,
            )
        )
        with tag.div(classes="flex flex-col gap-4 pt-16"):
            with tag.h2(classes="text-2xl"):
                text("Organizations")
            with datatable.Datatable[Organization, OrganizationSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="organizations:get", clipboard=True
                ),
                datatable.DatatableDateTimeColumn("created_at", "Created At"),
                datatable.DatatableDateTimeColumn("deleted_at", "Deleted At"),
                datatable.DatatableDateTimeColumn("blocked_at", "Blocked At"),
                datatable.DatatableAttrColumn(
                    "slug",
                    "Slug",
                    clipboard=True,
                ),
            ).render(request, orgs):
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
                    datatable.DatatableActionHTMX(
                        "Delete Stripe Connect account",
                        lambda r, i: str(r.url_for("accounts:delete-stripe", id=i.id)),
                        target="#modal",
                        hidden=lambda _, i: not i.stripe_id,
                    ),
                    datatable.DatatableActionHTMX(
                        "Delete account",
                        lambda r, i: str(r.url_for("accounts:delete", id=i.id)),
                        target="#modal",
                        hidden=lambda _, i: i.deleted_at is not None,
                    ),
                ),
            ).render(request, accounts):
                pass
