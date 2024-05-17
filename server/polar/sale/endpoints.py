from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import Sale
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from . import auth
from .schemas import Sale as SaleSchema
from .schemas import SaleInvoice, SalesStatistics
from .service import sale as sale_service

router = APIRouter(prefix="/sales", tags=["sales"])


SaleID = Annotated[UUID4, Path(description="The sale ID.")]
SaleNotFound = {"description": "Sale not found.", "model": ResourceNotFound.schema()}


@router.get("/", response_model=ListResource[SaleSchema], tags=[Tags.PUBLIC])
async def list_sales(
    auth_subject: auth.SalesRead,
    pagination: PaginationParamsQuery,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[SaleSchema]:
    """List sales."""
    results, count = await sale_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [SaleSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/statistics", response_model=SalesStatistics, tags=[Tags.PUBLIC])
async def get_sales_statistics(
    auth_subject: auth.SalesRead,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    product_id: UUID4 | None = Query(None, description="Filter by product ID."),
    session: AsyncSession = Depends(get_db_session),
) -> SalesStatistics:
    """Get monthly data about your sales and earnings."""
    periods = await sale_service.get_statistics_periods(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
    )
    return SalesStatistics(periods=periods)


@router.get(
    "/{id}",
    response_model=SaleSchema,
    tags=[Tags.PUBLIC],
    responses={404: SaleNotFound},
)
async def get_sale(
    id: SaleID,
    auth_subject: auth.SalesRead,
    session: AsyncSession = Depends(get_db_session),
) -> Sale:
    """Get a sale by ID."""
    sale = await sale_service.get_by_id(session, auth_subject, id)

    if sale is None:
        raise ResourceNotFound()

    return sale


@router.get(
    "/{id}/invoice",
    response_model=SaleInvoice,
    tags=[Tags.PUBLIC],
    responses={404: SaleNotFound},
)
async def get_sale_invoice(
    id: SaleID,
    auth_subject: auth.SalesRead,
    session: AsyncSession = Depends(get_db_session),
) -> SaleInvoice:
    """Get a sale's invoice data."""
    sale = await sale_service.get_by_id(session, auth_subject, id)

    if sale is None:
        raise ResourceNotFound()

    invoice_url = await sale_service.get_sale_invoice_url(sale)

    return SaleInvoice(url=invoice_url)
