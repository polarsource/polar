import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4
from sqlalchemy import or_
from tagflow import tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.models import Organization
from polar.organization import sorting
from polar.organization.repository import OrganizationRepository
from polar.organization.sorting import OrganizationSortProperty
from polar.postgres import AsyncSession, get_db_session

from ..components import datatable, description_list, input
from ..layout import layout

router = APIRouter(include_in_schema=False)


@router.get("/", name="organizations:list")
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
            with tag.div():
                with tag.form(method="GET"):
                    with input.search("query", query):
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
