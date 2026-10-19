from collections.abc import AsyncIterator, Callable
from typing import Any, Literal, Protocol, cast, get_origin
from uuid import UUID

from pydantic import BaseModel, TypeAdapter, ValidationError

from polar.benefit.repository import BenefitRepository
from polar.benefit.strategies.meter_credit.properties import (
    BenefitMeterCreditProperties,
)
from polar.discount.repository import DiscountRepository
from polar.meter.repository import MeterRepository
from polar.models import (
    Benefit,
    Discount,
    Meter,
    Organization,
    Product,
    WebhookEndpoint,
)
from polar.models.benefit import BenefitType
from polar.models.discount import DiscountFixed, DiscountPercentage
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository
from polar.webhook.repository import WebhookEndpointRepository

from .schemas import (
    MAXIMUM_BENEFITS,
    MAXIMUM_DISCOUNTS,
    MAXIMUM_METERS,
    MAXIMUM_PRODUCTS,
    MAXIMUM_WEBHOOK_ENDPOINTS,
    ConfigBenefit,
    ConfigDiscount,
    ConfigExport,
    ConfigExportBenefit,
    ConfigExportDiscount,
    ConfigExportDocument,
    ConfigExportMeter,
    ConfigExportProduct,
    ConfigMeter,
    ConfigProduct,
    ConfigResource,
    ConfigSettings,
    ConfigSkippedReason,
    ConfigSkippedResource,
    ConfigWebhookEndpoint,
)
from .validation import SETTINGS_FIELDS, benefit_properties, price_config

_config_benefit = TypeAdapter[ConfigBenefit](ConfigBenefit)
_export_benefit = TypeAdapter[ConfigExportBenefit](ConfigExportBenefit)
_config_discount = TypeAdapter[ConfigDiscount](ConfigDiscount)
_export_discount = TypeAdapter[ConfigExportDiscount](ConfigExportDiscount)


class _Exportable(Protocol):
    @property
    def id(self) -> UUID: ...

    @property
    def external_id(self) -> str | None: ...


async def _export_section[ModelT: _Exportable, EntryT](
    resource: ConfigResource,
    models: AsyncIterator[ModelT],
    maximum: int,
    skipped: list[ConfigSkippedResource],
    *,
    name: Callable[[ModelT], str],
    archived: Callable[[ModelT], bool],
    entry: Callable[[ModelT], EntryT | None],
) -> tuple[list[EntryT], dict[str, str]]:
    """
    `entry` returns `None` when the model references something left out of the
    export. At most `maximum` models are listed in `skipped`, and the stream
    stops once both lists are full.
    """
    entries: list[EntryT] = []
    external_ids: dict[str, str] = {}
    skipped_count = 0
    async for model in models:
        reason: ConfigSkippedReason | None = None
        if model.external_id is None:
            reason = ConfigSkippedReason.missing_external_id
        elif archived(model):
            reason = ConfigSkippedReason.archived
        elif len(entries) >= maximum:
            reason = ConfigSkippedReason.over_limit
        else:
            try:
                exported = entry(model)
            except ValidationError:
                exported = None
            if exported is None:
                reason = ConfigSkippedReason.invalid
            else:
                entries.append(exported)
                external_ids[str(model.id)] = model.external_id
        if reason is not None and skipped_count < maximum:
            skipped_count += 1
            skipped.append(
                ConfigSkippedResource(
                    resource=resource, id=model.id, name=name(model), reason=reason
                )
            )
        if len(entries) >= maximum and skipped_count >= maximum:
            break
    return entries, external_ids


def _meter_entry(meter: Meter) -> ConfigExportMeter:
    config = ConfigMeter(
        external_id=cast(str, meter.external_id),
        name=meter.name,
        unit=meter.unit,
        custom_label=meter.custom_label,
        custom_multiplier=meter.custom_multiplier,
        filter=meter.filter,
        aggregation=meter.aggregation,
        metadata=meter.user_metadata,
    )
    return ConfigExportMeter.model_validate(config.model_dump())


def _benefit_entry(
    benefit: Benefit, meter_external_ids: dict[str, str]
) -> ConfigExportBenefit | None:
    data: dict[str, Any] = {
        "type": benefit.type,
        "external_id": benefit.external_id,
        "description": benefit.description,
        "visibility": benefit.visibility,
        "metadata": benefit.user_metadata,
    }
    if benefit.type == BenefitType.meter_credit:
        properties = cast(BenefitMeterCreditProperties, benefit.properties)
        if str(properties["meter_id"]) not in meter_external_ids:
            return None
        data["properties"] = benefit_properties(benefit, meter_external_ids)
    config = _config_benefit.validate_python(data)
    return _export_benefit.validate_python(config.model_dump())


def _product_entry(
    product: Product,
    meter_external_ids: dict[str, str],
    benefit_external_ids: dict[str, str],
) -> ConfigExportProduct | None:
    prices = [price_config(price, meter_external_ids) for price in product.prices]
    benefits = [
        benefit_external_ids.get(str(benefit.id)) for benefit in product.benefits
    ]
    if product.meter_interval is not None or None in prices or None in benefits:
        return None
    config = ConfigProduct.model_validate(
        {
            "external_id": product.external_id,
            "name": product.name,
            "description": product.description,
            "visibility": product.visibility,
            "recurring_interval": product.recurring_interval,
            "recurring_interval_count": product.recurring_interval_count,
            "trial_interval": product.trial_interval,
            "trial_interval_count": product.trial_interval_count,
            "prices": prices,
            "benefits": benefits,
            "metadata": product.user_metadata,
        }
    )
    return ConfigExportProduct.model_validate(config.model_dump())


def _discount_entry(
    discount: Discount, product_external_ids: dict[str, str]
) -> ConfigExportDiscount | None:
    products = [
        product_external_ids.get(str(product.id)) for product in discount.products
    ]
    if None in products:
        return None
    data: dict[str, Any] = {
        "type": discount.type,
        "external_id": discount.external_id,
        "name": discount.name,
        "code": discount.code,
        "duration": discount.duration,
        "duration_in_months": discount.duration_in_months,
        "starts_at": discount.starts_at,
        "ends_at": discount.ends_at,
        "max_redemptions": discount.max_redemptions,
        "max_redemptions_per_customer": discount.max_redemptions_per_customer,
        "products": products,
        "metadata": discount.user_metadata,
    }
    if isinstance(discount, DiscountFixed):
        data["amounts"] = discount.amounts
    elif isinstance(discount, DiscountPercentage):
        data["basis_points"] = discount.basis_points
    config = _config_discount.validate_python(data)
    return _export_discount.validate_python(config.model_dump())


def _settings(organization: Organization) -> ConfigSettings:
    settings: dict[str, dict[str, Any]] = {}
    for field, attribute in SETTINGS_FIELDS.items():
        group, name = field.split(".")
        settings.setdefault(group, {})[name] = getattr(organization, attribute)
    return ConfigSettings.model_validate(settings)


def _webhook_entry(endpoint: WebhookEndpoint) -> ConfigWebhookEndpoint | None:
    if not endpoint.enabled:
        return None
    return ConfigWebhookEndpoint.model_validate(
        {
            "external_id": endpoint.external_id,
            "url": endpoint.url,
            "format": endpoint.format,
            "events": endpoint.events,
            "api_version": endpoint.api_version,
        }
    )


async def export_config(
    session: AsyncReadSession, organization: Organization
) -> ConfigExport:
    skipped: list[ConfigSkippedResource] = []

    webhook_repository = WebhookEndpointRepository.from_session(session)
    webhooks, _ = await _export_section(
        ConfigResource.webhook,
        webhook_repository.stream(
            webhook_repository.get_organization_statement(organization.id)
        ),
        MAXIMUM_WEBHOOK_ENDPOINTS,
        skipped,
        name=lambda endpoint: endpoint.name or endpoint.url,
        archived=lambda endpoint: False,
        entry=_webhook_entry,
    )

    meter_repository = MeterRepository.from_session(session)
    meters, meter_external_ids = await _export_section(
        ConfigResource.meter,
        meter_repository.stream(
            meter_repository.get_organization_statement(organization.id)
        ),
        MAXIMUM_METERS,
        skipped,
        name=lambda meter: meter.name,
        archived=lambda meter: meter.archived_at is not None,
        entry=_meter_entry,
    )

    benefits: list[ConfigExportBenefit]
    benefit_repository = BenefitRepository.from_session(session)
    benefits, benefit_external_ids = await _export_section(
        ConfigResource.benefit,
        benefit_repository.stream(
            benefit_repository.get_organization_statement(organization.id)
        ),
        MAXIMUM_BENEFITS,
        skipped,
        name=lambda benefit: benefit.description,
        archived=lambda benefit: False,
        entry=lambda benefit: _benefit_entry(benefit, meter_external_ids),
    )

    product_repository = ProductRepository.from_session(session)
    products, product_external_ids = await _export_section(
        ConfigResource.product,
        product_repository.stream(
            product_repository.get_organization_statement(organization.id)
        ),
        MAXIMUM_PRODUCTS,
        skipped,
        name=lambda product: product.name,
        archived=lambda product: product.is_archived,
        entry=lambda product: _product_entry(
            product, meter_external_ids, benefit_external_ids
        ),
    )

    discounts: list[ConfigExportDiscount]
    discount_repository = DiscountRepository.from_session(session)
    discounts, _ = await _export_section(
        ConfigResource.discount,
        discount_repository.stream(
            discount_repository.get_organization_statement(organization.id)
        ),
        MAXIMUM_DISCOUNTS,
        skipped,
        name=lambda discount: discount.name,
        archived=lambda discount: False,
        entry=lambda discount: _discount_entry(discount, product_external_ids),
    )

    return ConfigExport(
        config=ConfigExportDocument(
            webhooks=webhooks,
            meters=meters,
            benefits=benefits,
            products=products,
            discounts=discounts,
        ),
        settings=_settings(organization),
        skipped=skipped,
    )


def _is_default(model: BaseModel, name: str) -> bool:
    field = type(model).model_fields[name]
    if field.is_required() or get_origin(field.annotation) is Literal:
        return False
    return getattr(model, name) == field.get_default(call_default_factory=True)


def _drop_defaults(value: Any, data: Any) -> Any:
    if isinstance(value, BaseModel):
        return {
            name: _drop_defaults(getattr(value, name), item)
            for name, item in data.items()
            if not _is_default(value, name)
        }
    if isinstance(value, list):
        return [_drop_defaults(v, d) for v, d in zip(value, data, strict=True)]
    return data


def without_defaults(export: ConfigExport) -> dict[str, Any]:
    """
    Dump the export leaving out fields set to their default, since plan and
    apply fill them in. `Literal` fields are kept: they discriminate unions,
    like a meter's `aggregation.func`, and apply can't parse the entry without
    them.
    """
    return cast(dict[str, Any], _drop_defaults(export, export.model_dump(mode="json")))
