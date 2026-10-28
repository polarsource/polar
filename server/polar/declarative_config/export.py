from collections.abc import AsyncIterator, Callable, Collection, Iterable, Sequence
from typing import Any, Protocol, cast
from uuid import UUID

from pydantic import BaseModel, TypeAdapter, ValidationError

from polar.benefit.repository import BenefitRepository
from polar.benefit.strategies.meter_credit.properties import (
    BenefitMeterCreditProperties,
)
from polar.meter.repository import MeterRepository
from polar.models import (
    Benefit,
    Meter,
    Organization,
    Product,
    ProductPriceMeteredTiers,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .schemas import (
    MAXIMUM_BENEFITS,
    MAXIMUM_METERS,
    MAXIMUM_PRODUCTS,
    ConfigBenefit,
    ConfigBenefitRead,
    ConfigExport,
    ConfigExportDocument,
    ConfigMeter,
    ConfigMeterRead,
    ConfigProduct,
    ConfigProductRead,
    ConfigResource,
    ConfigSettings,
    ConfigSettingsRead,
    ConfigSkippedReason,
    ConfigSkippedResource,
)
from .validation import benefit_properties, price_config

# Webhook endpoints stay out: they need a permission and scope that
# unclaimed agents don't have. Apply leaves unlisted endpoints untouched.
EXPORTED_SECTIONS = ("settings", "meters", "benefits", "products")

_config_benefit = TypeAdapter[ConfigBenefit](ConfigBenefit)
_benefit_read = TypeAdapter[ConfigBenefitRead](ConfigBenefitRead)


class _Exportable(Protocol):
    @property
    def id(self) -> UUID: ...

    @property
    def external_id(self) -> str | None: ...


def _dump(config: BaseModel) -> dict[str, Any]:
    # Input models serialize `metadata` as `user_metadata`, which apply rejects.
    return config.model_dump(mode="json", by_alias=False)


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
    export.
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


def _meter_entry(meter: Meter) -> ConfigMeterRead:
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
    return ConfigMeterRead.model_validate(_dump(config))


def _benefit_entry(
    benefit: Benefit, meter_external_ids: dict[str, str]
) -> ConfigBenefitRead | None:
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
    return _benefit_read.validate_python(_dump(config))


def _product_entry(
    product: Product,
    meter_external_ids: dict[str, str],
    benefit_external_ids: dict[str, str],
    *,
    deprecated: bool,
) -> ConfigProductRead | None:
    if any(
        isinstance(price, ProductPriceMeteredTiers) and price.tiers is None
        for price in product.prices
    ):
        return None
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
    return ConfigProductRead.model_validate(
        {**_dump(config), "deprecated": True if deprecated else None}
    )


def _settings(organization: Organization) -> ConfigSettingsRead:
    settings = ConfigSettings.model_validate(
        {
            "payments": {
                "currency": organization.default_presentment_currency,
                "tax": organization.default_tax_behavior,
            }
        }
    )
    return ConfigSettingsRead.model_validate(_dump(settings))


async def get_deprecated_products(
    session: AsyncReadSession,
    organization: Organization,
    catalog_external_ids: Collection[str],
) -> Sequence[Product]:
    """Latest version of each product outside the catalog that customers still use.

    Config keeps them as deprecated, so existing customers can still reference
    them, until no customer is left.
    """
    repository = ProductRepository.from_session(session)
    in_use = await repository.get_external_ids_in_use(organization.id, None)
    return await repository.get_latest_by_external_ids(
        organization.id, sorted(in_use - set(catalog_external_ids))
    )


async def _iterate[T](items: Iterable[T]) -> AsyncIterator[T]:
    for item in items:
        yield item


async def export_config(
    session: AsyncReadSession, organization: Organization
) -> ConfigExport:
    skipped: list[ConfigSkippedResource] = []

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

    benefit_repository = BenefitRepository.from_session(session)
    benefits: list[ConfigBenefitRead]
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
    products, _ = await _export_section(
        ConfigResource.product,
        product_repository.stream(
            product_repository.get_organization_statement(organization.id)
        ),
        MAXIMUM_PRODUCTS,
        skipped,
        name=lambda product: product.name,
        archived=lambda product: product.is_archived,
        entry=lambda product: _product_entry(
            product, meter_external_ids, benefit_external_ids, deprecated=False
        ),
    )
    deprecated_products, _ = await _export_section(
        ConfigResource.product,
        _iterate(
            await get_deprecated_products(
                session,
                organization,
                await product_repository.get_current_external_ids(organization.id),
            )
        ),
        MAXIMUM_PRODUCTS - len(products),
        skipped,
        name=lambda product: product.name,
        archived=lambda product: False,
        entry=lambda product: _product_entry(
            product, meter_external_ids, benefit_external_ids, deprecated=True
        ),
    )
    products.extend(deprecated_products)

    return ConfigExport(
        config=ConfigExportDocument(
            settings=_settings(organization),
            meters=meters,
            benefits=benefits,
            products=products,
        ),
        skipped=skipped,
    )
