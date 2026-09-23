from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm.attributes import set_committed_value

from polar.enums import SubscriptionRecurringInterval
from polar.kit.currency import get_currency_decimal_factor
from polar.kit.math import polar_round
from polar.kit.utils import utc_now
from polar.meter.aggregation import CountAggregation
from polar.meter.filter import Filter
from polar.models import (
    Meter,
    Product,
    ProductBenefit,
    ProductPriceFixed,
    ProductPriceMeteredUnit,
    VoidDeployment,
)
from polar.postgres import AsyncSession
from polar.void.deploy.repository import DeployRepository
from polar.void.meter.schemas import MeterCreate, to_schema
from polar.void.meter.service import meter as meter_service


def meter_model(**kwargs: Any) -> Meter:
    kwargs.setdefault("name", kwargs["slug"])
    definition = {
        "slug": kwargs["slug"],
        "unit_amount": str(kwargs.pop("unit_amount", 0)),
        "currency": kwargs.pop("currency", "usd"),
    }
    owner = {
        key: kwargs[key] for key in ("organization", "organization_id") if key in kwargs
    }
    created_at = kwargs.pop("created_at", utc_now())
    return Meter(
        **kwargs,
        created_at=created_at,
        filter=Filter.model_validate({"conjunction": "and", "clauses": []}),
        aggregation=CountAggregation(),
        deployment=VoidDeployment(
            **owner,
            version_id=kwargs["version_id"],
            checksum="test",
            status="draft",
            entries=[],
            configuration={"meters": [definition]},
        ),
    )


def product_model(**kwargs: Any) -> Product:
    amount = kwargs.pop("amount", Decimal(0))
    currency = kwargs.pop("currency", "usd")
    recurring = kwargs.pop("price_type", "recurring") == "recurring"
    interval = kwargs.pop("interval", "month")
    count = kwargs.pop("interval_count", 1)
    meters = kwargs.pop("meters", [])
    benefits = kwargs.pop("entitlements", [])
    kwargs.pop("meter_ids", None)
    kwargs.pop("entitlement_ids", None)
    factor = get_currency_decimal_factor(currency)
    prices = [
        ProductPriceFixed(
            price_amount=polar_round(amount * factor), price_currency=currency
        ),
        *[
            ProductPriceMeteredUnit(
                meter=meter,
                unit_amount=to_schema(meter).unit_amount * factor,
                price_currency=currency,
            )
            for meter in meters
        ],
    ]
    product = Product(
        **kwargs,
        recurring_interval=SubscriptionRecurringInterval(interval)
        if recurring
        else None,
        recurring_interval_count=count if recurring else None,
        all_prices=prices,
        product_benefits=[
            ProductBenefit(benefit=benefit, order=index)
            for index, benefit in enumerate(benefits)
        ],
    )
    set_committed_value(product, "prices", prices)
    return product


async def create_meter(
    session: AsyncSession, organization_id: UUID, definition: MeterCreate
) -> Meter:
    repository = DeployRepository.from_session(session)
    deployment = await repository.by_version(organization_id, definition.version_id)
    config = {
        "slug": definition.slug,
        "unit_amount": str(definition.unit_amount),
        "currency": definition.currency,
    }
    if deployment is None:
        deployment = VoidDeployment(
            organization_id=organization_id,
            version_id=definition.version_id,
            checksum="test",
            status="draft",
            entries=[],
            configuration={"meters": [config]},
        )
        session.add(deployment)
    else:
        configuration = dict(deployment.configuration or {})
        configuration["meters"] = [
            item
            for item in configuration.get("meters", [])
            if item["slug"] != definition.slug
        ] + [config]
        deployment.configuration = configuration
    await session.flush()
    return await meter_service.create(session, organization_id, definition)
