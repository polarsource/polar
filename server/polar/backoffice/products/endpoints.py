import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4
from sqlalchemy import or_
from sqlalchemy.orm import joinedload, selectinload
from tagflow import tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.models import Organization, Product, ProductBenefit
from polar.postgres import AsyncSession, get_db_session
from polar.product import sorting
from polar.product.repository import ProductRepository
from polar.product.sorting import ProductSortProperty

from ..components import button, datatable, description_list, input
from ..layout import layout

router = APIRouter()


class OrganizationColumn(datatable.DatatableAttrColumn[Product, ProductSortProperty]):
    def __init__(self) -> None:
        super().__init__("organization.name", "Organization")
        self.href_getter = lambda r, i: str(
            r.url_for("organizations:get", id=i.organization_id)
        )


@router.get("/", name="products:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = ProductRepository.from_session(session)
    statement = repository.get_base_statement().options(
        joinedload(Product.organization)
    )

    if query:
        try:
            query_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(Product.id == query_uuid, Product.organization_id == query_uuid)
            )
        except ValueError:
            statement = statement.where(
                or_(
                    Product.name.ilike(f"%{query}%"),
                    Organization.slug.ilike(f"%{query}%"),
                    Organization.name.ilike(f"%{query}%"),
                )
            ).join(Organization, Product.organization_id == Organization.id)

    statement = repository.apply_sorting(statement, sorting)

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Products", str(request.url_for("products:list"))),
        ],
        "products:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Products")

            # Filters
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    "query",
                    query,
                    placeholder="Search by ID, name, organization name/slug",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            # Results table
            with datatable.Datatable[Product, ProductSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="products:get", clipboard=True
                ),
                datatable.DatatableDateTimeColumn(
                    "created_at",
                    "Created At",
                    sorting=ProductSortProperty.created_at,
                ),
                datatable.DatatableAttrColumn(
                    "name", "Name", sorting=ProductSortProperty.product_name
                ),
                OrganizationColumn(),
                datatable.DatatableAttrColumn("is_archived", "Archived"),
            ).render(request, items, sorting=sorting):
                pass

            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="products:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = ProductRepository.from_session(session)
    product = await repository.get_by_id(
        id,
        options=(
            joinedload(Product.organization),
            selectinload(Product.all_prices),
            selectinload(Product.product_benefits).joinedload(ProductBenefit.benefit),
        ),
    )

    if product is None:
        raise HTTPException(status_code=404)

    with layout(
        request,
        [
            (f"{product.name}", str(request.url)),
            ("Products", str(request.url_for("products:list"))),
        ],
        "products:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text(f"Product: {product.name}")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Product Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Product Details")
                        with description_list.DescriptionList[Product](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem("name", "Name"),
                            description_list.DescriptionListAttrItem(
                                "description", "Description"
                            ),
                            description_list.DescriptionListAttrItem(
                                "is_archived", "Archived"
                            ),
                            description_list.DescriptionListAttrItem(
                                "is_recurring", "Recurring"
                            ),
                            description_list.DescriptionListAttrItem(
                                "recurring_interval", "Recurring Interval"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "modified_at", "Modified At"
                            ),
                        ).render(request, product):
                            pass

                # Organization Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Organization")
                        with description_list.DescriptionList[Product](
                            description_list.DescriptionListLinkItem[Product](
                                "organization.name",
                                "Name",
                                href_getter=lambda r, i: str(
                                    r.url_for("organizations:get", id=i.organization_id)
                                ),
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization.slug", "Slug"
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization_id", "ID", clipboard=True
                            ),
                        ).render(request, product):
                            pass

            # Prices section
            with tag.div(classes="flex flex-col gap-4 pt-8"):
                with tag.h2(classes="text-2xl"):
                    text("Prices")
                if not product.all_prices:
                    with tag.div(classes="text-gray-500"):
                        text("No prices configured for this product.")
                else:
                    with tag.div(classes="overflow-x-auto"):
                        with tag.table(classes="table table-zebra w-full"):
                            with tag.thead():
                                with tag.tr():
                                    with tag.th():
                                        text("ID")
                                    with tag.th():
                                        text("Type")
                                    with tag.th():
                                        text("Amount Type")
                                    with tag.th():
                                        text("Amount")
                                    with tag.th():
                                        text("Currency")
                                    with tag.th():
                                        text("Archived")
                            with tag.tbody():
                                for price in product.all_prices:
                                    with tag.tr():
                                        with tag.td():
                                            text(str(price.id))
                                        with tag.td():
                                            text(str(price.type or "N/A"))
                                        with tag.td():
                                            text(str(price.amount_type))
                                        with tag.td():
                                            if hasattr(price, "price_amount"):
                                                text(
                                                    f"{price.price_amount / 100:.2f}"
                                                    if price.price_amount
                                                    else "N/A"
                                                )
                                            else:
                                                text("N/A")
                                        with tag.td():
                                            text(str(price.price_currency or "N/A"))
                                        with tag.td():
                                            text(str(price.is_archived))

            # Benefits section
            with tag.div(classes="flex flex-col gap-4 pt-8"):
                with tag.h2(classes="text-2xl"):
                    text("Benefits")
                if not product.product_benefits:
                    with tag.div(classes="text-gray-500"):
                        text("No benefits attached to this product.")
                else:
                    with tag.div(classes="overflow-x-auto"):
                        with tag.table(classes="table table-zebra w-full"):
                            with tag.thead():
                                with tag.tr():
                                    with tag.th():
                                        text("ID")
                                    with tag.th():
                                        text("Type")
                                    with tag.th():
                                        text("Description")
                                    with tag.th():
                                        text("Order")
                            with tag.tbody():
                                for product_benefit in product.product_benefits:
                                    benefit = product_benefit.benefit
                                    with tag.tr():
                                        with tag.td():
                                            with tag.a(
                                                href=str(
                                                    request.url_for(
                                                        "benefits:get", id=benefit.id
                                                    )
                                                ),
                                                classes="link",
                                            ):
                                                text(str(benefit.id))
                                        with tag.td():
                                            text(benefit.type.get_display_name())
                                        with tag.td():
                                            text(benefit.description)
                                        with tag.td():
                                            text(str(product_benefit.order))
