from typing import Any, cast

from pydantic import TypeAdapter, ValidationError

from polar.benefit.repository import BenefitRepository
from polar.benefit.strategies.meter_credit.properties import (
    BenefitMeterCreditProperties,
)
from polar.meter.repository import MeterRepository
from polar.models import Benefit, Organization, Product
from polar.models.benefit import BenefitType
from polar.postgres import AsyncReadSession
from polar.product.guard import is_metered_price
from polar.product.repository import ProductRepository

from . import schemas
from .schemas import (
    ConfigBenefit,
    ConfigExportBenefit,
    ConfigExportMeter,
    ConfigExportProduct,
    ConfigMeter,
    ConfigProduct,
    ConfigResource,
    ConfigSkippedReason,
    ConfigSkippedResource,
)
from .validation import (
    BENEFIT_PROPERTIES,
    benefit_properties,
    price_config,
    product_benefits,
    product_custom_fields,
)

_benefit_adapter: TypeAdapter[ConfigBenefit] = TypeAdapter(ConfigBenefit)
_export_benefit_adapter: TypeAdapter[ConfigExportBenefit] = TypeAdapter(
    ConfigExportBenefit
)

ExternalIDs = dict[str, str]


async def export_meters(
    session: AsyncReadSession,
    organization: Organization,
    skipped: list[ConfigSkippedResource],
) -> tuple[list[ConfigExportMeter], ExternalIDs]:
    repository = MeterRepository.from_session(session)
    meters: list[ConfigExportMeter] = []
    external_ids: ExternalIDs = {}
    statement = repository.get_organization_statement(organization.id)
    async for meter in repository.stream(statement):
        reason: ConfigSkippedReason | None = None
        if meter.external_id is None:
            reason = ConfigSkippedReason.missing_external_id
        elif meter.archived_at is not None:
            reason = ConfigSkippedReason.archived
        elif len(meters) >= schemas.MAXIMUM_METERS:
            reason = ConfigSkippedReason.over_limit
        else:
            try:
                meter_config = ConfigMeter(
                    external_id=meter.external_id,
                    name=meter.name,
                    unit=meter.unit,
                    custom_label=meter.custom_label,
                    custom_multiplier=meter.custom_multiplier,
                    filter=meter.filter,
                    aggregation=meter.aggregation,
                    metadata=meter.user_metadata,
                )
            except ValidationError:
                reason = ConfigSkippedReason.invalid
            else:
                meters.append(
                    ConfigExportMeter.model_validate(meter_config, from_attributes=True)
                )
                external_ids[str(meter.id)] = meter.external_id
        if reason is not None:
            skipped.append(
                ConfigSkippedResource(
                    resource=ConfigResource.meter,
                    id=meter.id,
                    name=meter.name,
                    reason=reason,
                )
            )
    return meters, external_ids


def _benefit_document(
    benefit: Benefit, meter_external_ids: ExternalIDs
) -> dict[str, Any] | ConfigSkippedReason:
    document: dict[str, Any] = {
        "external_id": benefit.external_id,
        "type": benefit.type,
        "description": benefit.description,
        "visibility": benefit.visibility,
        "metadata": benefit.user_metadata,
    }
    if benefit.type == BenefitType.feature_flag:
        return document
    if benefit.type not in {*BENEFIT_PROPERTIES, BenefitType.meter_credit}:
        return ConfigSkippedReason.not_supported
    if benefit.type == BenefitType.meter_credit:
        properties = cast(BenefitMeterCreditProperties, benefit.properties)
        if str(properties["meter_id"]) not in meter_external_ids:
            return ConfigSkippedReason.unknown_reference
    document["properties"] = benefit_properties(benefit, meter_external_ids)
    return document


async def export_benefits(
    session: AsyncReadSession,
    organization: Organization,
    meter_external_ids: ExternalIDs,
    skipped: list[ConfigSkippedResource],
) -> tuple[list[ConfigExportBenefit], ExternalIDs]:
    repository = BenefitRepository.from_session(session)
    benefits: list[ConfigExportBenefit] = []
    external_ids: ExternalIDs = {}
    statement = repository.get_organization_statement(organization.id)
    async for benefit in repository.stream(statement):
        result: dict[str, Any] | ConfigSkippedReason
        if benefit.external_id is None:
            result = ConfigSkippedReason.missing_external_id
        elif len(benefits) >= schemas.MAXIMUM_BENEFITS:
            result = ConfigSkippedReason.over_limit
        else:
            result = _benefit_document(benefit, meter_external_ids)
        if isinstance(result, dict):
            try:
                benefit_config = _benefit_adapter.validate_python(result)
            except ValidationError:
                result = ConfigSkippedReason.invalid
            else:
                benefits.append(
                    _export_benefit_adapter.validate_python(benefit_config.model_dump())
                )
                external_ids[str(benefit.id)] = benefit_config.external_id
                continue
        skipped.append(
            ConfigSkippedResource(
                resource=ConfigResource.benefit,
                id=benefit.id,
                name=benefit.description,
                reason=result,
            )
        )
    return benefits, external_ids


def _product_document(
    product: Product,
    meter_external_ids: ExternalIDs,
    benefit_external_ids: ExternalIDs,
) -> dict[str, Any] | ConfigSkippedReason:
    if product.is_legacy_recurring_price:
        return ConfigSkippedReason.not_supported
    prices = [
        config
        for price in product.prices
        if (config := price_config(price, meter_external_ids)) is not None
    ]
    if not prices:
        return (
            ConfigSkippedReason.unknown_reference
            if any(
                is_metered_price(price)
                and str(price.meter_id) not in meter_external_ids
                for price in product.prices
            )
            else ConfigSkippedReason.not_supported
        )
    benefits = product_benefits(product, benefit_external_ids)
    return {
        "external_id": product.external_id,
        "name": product.name,
        "description": product.description,
        "visibility": product.visibility,
        "recurring_interval": product.recurring_interval,
        "recurring_interval_count": product.recurring_interval_count,
        "trial_interval": product.trial_interval,
        "trial_interval_count": product.trial_interval_count,
        "meter_interval": product.meter_interval,
        "meter_interval_count": product.meter_interval_count,
        "prices": prices,
        "benefits": benefits,
        "custom_fields": product_custom_fields(product),
        "metadata": product.user_metadata,
    }


async def export_products(
    session: AsyncReadSession,
    organization: Organization,
    meter_external_ids: ExternalIDs,
    benefit_external_ids: ExternalIDs,
    skipped: list[ConfigSkippedResource],
) -> list[ConfigExportProduct]:
    repository = ProductRepository.from_session(session)
    products: list[ConfigExportProduct] = []
    statement = repository.get_organization_statement(organization.id)
    async for product in repository.stream(statement):
        result: dict[str, Any] | ConfigSkippedReason
        if product.external_id is None:
            result = ConfigSkippedReason.missing_external_id
        elif product.is_archived:
            result = ConfigSkippedReason.archived
        elif len(products) >= schemas.MAXIMUM_PRODUCTS:
            result = ConfigSkippedReason.over_limit
        else:
            result = _product_document(
                product, meter_external_ids, benefit_external_ids
            )
        if isinstance(result, dict):
            try:
                product_config = ConfigProduct.model_validate(result)
            except ValidationError:
                result = ConfigSkippedReason.invalid
            else:
                products.append(
                    ConfigExportProduct.model_validate(product_config.model_dump())
                )
                continue
        skipped.append(
            ConfigSkippedResource(
                resource=ConfigResource.product,
                id=product.id,
                name=product.name,
                reason=result,
            )
        )
    return products
