import uuid
from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import or_
from sqlalchemy.orm import contains_eager
from tagflow import classes, tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Account, Organization
from polar.organization import sorting
from polar.organization.repository import OrganizationRepository
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_session

from ..components import datatable, description_list, input
from ..layout import layout

router = APIRouter()


class AccountColumn(
    datatable.DatatableAttrColumn[Organization, OrganizationSortProperty]
):
    def render(self, request: Request, item: Organization) -> Generator[None] | None:
        account = item.account
        with tag.div(classes="badge"):
            if account is None:
                classes("badge-neutral")
                text("No account")
            else:
                if account.status == Account.Status.ACTIVE:
                    classes("badge-success")
                elif account.status == Account.Status.UNDER_REVIEW:
                    classes("badge-warning")
                else:
                    classes("badge-neutral")
                text(account.status.get_display_name())
        return None


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


@router.get("/{id}", name="organizations:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = OrganizationRepository.from_session(session)
    organization = await repository.get_by_id(id)

    if organization is None:
        raise HTTPException(status_code=404)

    with layout(
        request,
        [
            (organization.name, str(request.url)),
            ("Organizations", str(request.url_for("organizations:list"))),
        ],
        "organizations:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text(organization.name)
            with description_list.DescriptionList[Organization](
                description_list.DescriptionListAttrItem("id", "ID", clipboard=True),
                description_list.DescriptionListAttrItem(
                    "slug", "Slug", clipboard=True
                ),
                description_list.DescriptionListDateTimeItem(
                    "created_at", "Created At"
                ),
            ).render(request, organization):
                pass
