import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import or_
from tagflow import tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.models import Organization
from polar.organization import sorting
from polar.organization.repository import OrganizationRepository
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_session

from ..components import datatable, input
from ..decorators import layout

router = APIRouter(include_in_schema=False)


@router.get("/", name="organizations:list")
@layout(["Organizations"], "organizations:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = OrganizationRepository.from_session(session)
    statement = repository.apply_sorting(repository.get_base_statement(), sorting)
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
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with tag.div(classes="flex flex-col gap-4"):
        with tag.h1(classes="text-4xl"):
            text("Organizations")
        with tag.div():
            with tag.form(method="GET"):
                with input.search("query", query):
                    pass
        with datatable.Datatable[Organization, OrganizationSortProperty](
            datatable.DatatableActionsColumn("", ("Edit", "/edit")),
            datatable.DatatableAttrColumn("id", "ID", clipboard=True),
            datatable.DatatableDateTimeColumn(
                "created_at",
                "Created At",
                sorting=OrganizationSortProperty.created_at,
            ),
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
