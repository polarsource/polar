from typing import Annotated

from fastapi import Depends, Path, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import UUID4

from polar.checkout import ip_geolocation
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

router = APIRouter()


CheckoutLinkClientSecret = Annotated[
    str, Path(description="The checkout link client secret.")
]


@router.get("/{client_secret}")
async def redirect(
    request: Request,
    client_secret: CheckoutLinkClientSecret,
    ip_geolocation_client: ip_geolocation.IPGeolocationClient,
    embed_origin: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
    # Product pre-selection & query parameter prefill
    product_id: UUID4 | None = Query(None),
    amount: str | None = Query(None),
    customer_email: str | None = Query(None),
    customer_name: str | None = Query(None),
    discount_code: str | None = Query(None),
    # Metadata that can be set from query parameters
    reference_id: str | None = Query(None),
    utm_source: str | None = Query(None),
    utm_medium: str | None = Query(None),
    utm_campaign: str | None = Query(None),
    utm_term: str | None = Query(None),
    utm_content: str | None = Query(None),
) -> RedirectResponse:
    """Use a checkout link to create a checkout session and redirect to it."""
    url = await checkout_link_service.create_checkout_redirect_url(
        session,
        client_secret,
        request,
        ip_geolocation_client,
        embed_origin=embed_origin,
        product_id=product_id,
        amount=amount,
        customer_email=customer_email,
        customer_name=customer_name,
        discount_code=discount_code,
        reference_id=reference_id,
        utm_source=utm_source,
        utm_medium=utm_medium,
        utm_campaign=utm_campaign,
        utm_term=utm_term,
        utm_content=utm_content,
    )
    return RedirectResponse(url)
