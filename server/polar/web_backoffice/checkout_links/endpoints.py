import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import or_
from sqlalchemy.orm import contains_eager, joinedload, selectinload
from tagflow import tag, text

from polar.checkout_link import sorting
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import CheckoutLink, CheckoutLinkProduct, Organization, Product
from polar.postgres import AsyncSession, get_db_session

from ..components import button, datatable, description_list, input
from ..layout import layout
from .components import checkout_links_datatable

router = APIRouter()


@router.get("/", name="checkout_links:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    include_deleted: Annotated[
        bool, BeforeValidator(empty_str_to_none), Query()
    ] = False,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = CheckoutLinkRepository.from_session(session)
    statement = (
        repository.get_base_statement(include_deleted=include_deleted)
        .join(Organization, CheckoutLink.organization_id == Organization.id)
        .options(
            contains_eager(CheckoutLink.organization),
        )
    )

    if query is not None:
        try:
            parsed_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(
                    CheckoutLink.id == parsed_uuid,
                    Organization.id == parsed_uuid,
                )
            )
        except ValueError:
            statement = statement.where(
                or_(
                    CheckoutLink.label.ilike(f"%{query}%"),
                    CheckoutLink.client_secret.ilike(f"%{query}%"),
                    Organization.slug.ilike(f"%{query}%"),
                    Organization.name.ilike(f"%{query}%"),
                )
            )

    statement = repository.apply_sorting(statement, sorting)

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Checkout Links", str(request.url_for("checkout_links:list"))),
        ],
        "checkout_links:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Checkout Links")
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    "query",
                    query,
                    placeholder="Search by label, client secret, organization...",
                ):
                    pass
                with input.select(
                    [
                        ("Active Links", "false"),
                        ("All Links", "true"),
                    ],
                    "true" if include_deleted else "false",
                    name="include_deleted",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            with checkout_links_datatable(request, items, sorting=sorting):
                pass
            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="checkout_links:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    checkout_link_repository = CheckoutLinkRepository.from_session(session)
    checkout_link = await checkout_link_repository.get_by_id(
        id,
        include_deleted=True,
        options=(
            joinedload(CheckoutLink.organization),
            joinedload(CheckoutLink.discount),
            selectinload(CheckoutLink.checkout_link_products).joinedload(
                CheckoutLinkProduct.product
            ).joinedload(Product.organization),
        ),
    )

    if checkout_link is None:
        raise HTTPException(status_code=404)

    with layout(
        request,
        [
            (f"{checkout_link.id}", str(request.url)),
            ("Checkout Links", str(request.url_for("checkout_links:list"))),
        ],
        "checkout_links:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text(
                        f"Checkout Link {checkout_link.label or checkout_link.client_secret[:16]}..."
                    )

                # Show restore button for deleted checkout links
                if checkout_link.deleted_at is not None:
                    with tag.form(
                        method="POST",
                        action=str(
                            request.url_for(
                                "checkout_links:restore", id=checkout_link.id
                            )
                        ),
                        classes="inline-block",
                    ):
                        with button(type="submit", classes="btn btn-success"):
                            text("Restore")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Checkout Link Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Checkout Link Details")
                        with description_list.DescriptionList[CheckoutLink](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "deleted_at", "Deleted At"
                            ),
                            description_list.DescriptionListAttrItem("label", "Label"),
                            description_list.DescriptionListAttrItem(
                                "client_secret", "Client Secret", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "_success_url", "Success URL"
                            ),
                            description_list.DescriptionListAttrItem(
                                "allow_discount_codes", "Allow Discount Codes"
                            ),
                            description_list.DescriptionListAttrItem(
                                "require_billing_address", "Require Billing Address"
                            ),
                        ).render(request, checkout_link):
                            pass

                # Organization Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Organization")
                        with description_list.DescriptionList[CheckoutLink](
                            description_list.DescriptionListAttrItem(
                                "organization.id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListLinkItem[CheckoutLink](
                                "organization.name",
                                "Name",
                                href_getter=lambda r, i: str(
                                    r.url_for(
                                        "organizations:get",
                                        id=i.organization_id,
                                    )
                                ),
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization.slug", "Slug"
                            ),
                        ).render(request, checkout_link):
                            pass

            # Products section
            if checkout_link.checkout_link_products:
                with tag.div(classes="card card-border w-full shadow-sm mt-6"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Products")
                        for (
                            checkout_link_product
                        ) in checkout_link.checkout_link_products:
                            product = checkout_link_product.product
                            with tag.div(classes="mb-4 p-4 bg-gray-50 rounded"):
                                with tag.div(classes="text-sm text-gray-600"):
                                    text(f"Product ID: {product.id}")
                                with tag.div(classes="font-medium"):
                                    text(product.name)


from fastapi.responses import RedirectResponse


@router.post("/{id}/restore", name="checkout_links:restore")
async def restore(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    checkout_link_repository = CheckoutLinkRepository.from_session(session)
    checkout_link = await checkout_link_repository.get_by_id(id, include_deleted=True)

    if checkout_link is None:
        raise HTTPException(status_code=404, detail="Checkout link not found")

    if checkout_link.deleted_at is None:
        raise HTTPException(status_code=400, detail="Checkout link is not deleted")

    # Restore the checkout link
    await checkout_link_service.restore(session, checkout_link)

    # Redirect back to the checkout link details
    return RedirectResponse(
        url=str(request.url_for("checkout_links:get", id=checkout_link.id)),
        status_code=302,
    )
