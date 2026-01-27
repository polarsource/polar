from typing import Annotated

from fastapi import Depends, Path, Query, Request
from fastapi.datastructures import URL
from fastapi.responses import RedirectResponse
from pydantic import UUID4

from polar.checkout import ip_geolocation
from polar.checkout.service import checkout as checkout_service
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.exceptions import ResourceNotFound
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
    repository = CheckoutLinkRepository.from_session(session)
    checkout_link = await repository.get_by_client_secret(
        client_secret, options=repository.get_eager_options()
    )

    if checkout_link is None:
        raise ResourceNotFound()

    ip_address = request.client.host if request.client else None

    # Build query_prefill dictionary from explicit parameters
    query_prefill: dict[str, str | UUID4 | dict[str, str] | None] = {
        "product_id": product_id,
        "amount": amount,
        "customer_email": customer_email,
        "customer_name": customer_name,
        "discount_code": discount_code,
    }

    # Extract custom_field_data.* parameters from query string
    custom_field_data: dict[str, str] = {}
    for key, value in request.query_params.items():
        if key.startswith("custom_field_data."):
            slug = key.replace("custom_field_data.", "")
            custom_field_data[slug] = value

    if custom_field_data:
        query_prefill["custom_field_data"] = custom_field_data

    checkout = await checkout_service.checkout_link_create(
        session,
        checkout_link,
        embed_origin,
        ip_geolocation_client,
        ip_address,
        query_prefill=query_prefill,
        reference_id=reference_id,
        utm_source=utm_source,
        utm_medium=utm_medium,
        utm_campaign=utm_campaign,
        utm_term=utm_term,
        utm_content=utm_content,
    )

    validated_custom_field_keys = (
        set(checkout.custom_field_data.keys()) if checkout.custom_field_data else set()
    )

    checkout_url = URL(checkout.url)
    query_params = {
        k: v
        for k, v in request.query_params.items()
        if k != "embed_origin"
        and (k not in query_prefill or query_prefill[k] is None)
        and not (
            k.startswith("custom_field_data.")
            and k.replace("custom_field_data.", "") in validated_custom_field_keys
        )
    }
    checkout_url = checkout_url.include_query_params(**query_params)

    return RedirectResponse(checkout_url)
