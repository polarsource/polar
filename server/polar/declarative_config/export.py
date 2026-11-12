from collections.abc import AsyncIterator, Callable, Collection
from typing import Any, Protocol, cast
from uuid import UUID

from pydantic import BaseModel, TypeAdapter, ValidationError
from sqlalchemy import Select
from sqlalchemy.orm import selectinload

from polar.benefit.repository import BenefitRepository
from polar.benefit.strategies.meter_credit.properties import (
    BenefitMeterCreditProperties,
)
from polar.catalog.repository import (
    CatalogBenefitRepository,
    CatalogCustomFieldRepository,
    CatalogMeterRepository,
    CatalogProductRepository,
)
from polar.catalog.service import catalog as catalog_service
from polar.custom_field.repository import CustomFieldRepository
from polar.meter.repository import MeterRepository
from polar.models import (
    Benefit,
    Catalog,
    CustomField,
    Meter,
    Organization,
    Product,
)
from polar.models.benefit import BenefitType
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .schemas import (
    MAXIMUM_BENEFITS,
    MAXIMUM_CUSTOM_FIELDS,
    MAXIMUM_METERS,
    MAXIMUM_PRODUCTS,
    ConfigBenefit,
    ConfigBenefitRead,
    ConfigCustomField,
    ConfigCustomFieldRead,
    ConfigExport,
    ConfigExportCatalog,
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
from .validation import benefit_properties, is_expressible_product, price_config

# Webhook endpoints stay out: they need a permission and scope that
# unclaimed agents don't have. Apply leaves unlisted endpoints untouched.
EXPORTED_SECTIONS = ("settings", "meters", "benefits", "products")

_config_benefit = TypeAdapter[ConfigBenefit](ConfigBenefit)
_benefit_read = TypeAdapter[ConfigBenefitRead](ConfigBenefitRead)
_config_custom_field = TypeAdapter[ConfigCustomField](ConfigCustomField)
_custom_field_read = TypeAdapter[ConfigCustomFieldRead](ConfigCustomFieldRead)


class _Exportable(Protocol):
    @property
    def id(self) -> UUID: ...


def _dump(config: BaseModel) -> dict[str, Any]:
    # Input models serialize `metadata` as `user_metadata`, which apply rejects.
    return config.model_dump(mode="json", by_alias=False)


async def _export_section[ModelT: _Exportable, EntryT](
    resource: ConfigResource,
    models: AsyncIterator[ModelT],
    maximum: int,
    skipped: list[ConfigSkippedResource],
    *,
    key: Callable[[ModelT], str | None],
    name: Callable[[ModelT], str],
    archived: Callable[[ModelT], bool],
    entry: Callable[[ModelT], EntryT | None],
    details: Callable[[ModelT], dict[str, Any]] = lambda _: {
        "recurring_interval": None,
        "recurring_interval_count": None,
    },
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
        model_key = key(model)
        if archived(model):
            reason = ConfigSkippedReason.archived
        elif model_key is None:
            reason = ConfigSkippedReason.missing_external_id
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
                external_ids[str(model.id)] = model_key
        if reason is not None and skipped_count < maximum:
            skipped_count += 1
            skipped.append(
                ConfigSkippedResource(
                    resource=resource,
                    id=model.id,
                    name=name(model),
                    reason=reason,
                    **details(model),
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


def _custom_field_entry(custom_field: CustomField) -> ConfigCustomFieldRead:
    config = _config_custom_field.validate_python(
        {
            "type": custom_field.type,
            "slug": custom_field.slug,
            "name": custom_field.name,
            "properties": custom_field.properties,
            "metadata": custom_field.user_metadata,
        }
    )
    return _custom_field_read.validate_python(_dump(config))


def _product_entry(
    product: Product,
    meter_external_ids: dict[str, str],
    benefit_external_ids: dict[str, str],
    custom_field_slugs: Collection[str] | None,
    *,
    deprecated: bool,
) -> ConfigProductRead | None:
    if not is_expressible_product(product):
        return None
    prices = [price_config(price, meter_external_ids) for price in product.prices]
    benefits = [
        benefit_external_ids.get(str(benefit.id)) for benefit in product.benefits
    ]
    if None in prices or None in benefits:
        return None
    if custom_field_slugs is not None and any(
        attached.custom_field.slug not in custom_field_slugs
        for attached in product.attached_custom_fields
    ):
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
            "meter_interval": product.meter_interval,
            "meter_interval_count": product.meter_interval_count,
            "prices": prices,
            "benefits": benefits,
            "custom_fields": [
                {"field": attached.custom_field.slug, "required": attached.required}
                for attached in product.attached_custom_fields
            ],
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


async def get_deprecated_products_statement(
    session: AsyncReadSession,
    organization: Organization,
    catalog_external_ids: Collection[str],
) -> Select[Product]:
    """Latest version of each product outside the catalog that customers still use.

    Config keeps them as deprecated, so existing customers can still reference
    them, until no customer is left.
    """
    repository = ProductRepository.from_session(session)
    outside = await repository.get_external_ids(organization.id) - set(
        catalog_external_ids
    )
    in_use = await repository.get_external_ids_in_use(organization.id, sorted(outside))
    return repository.get_latest_by_external_ids_statement(
        organization.id, sorted(in_use)
    )


async def _chain[T](*iterators: AsyncIterator[T]) -> AsyncIterator[T]:
    for iterator in iterators:
        async for item in iterator:
            yield item


async def export_config(
    session: AsyncReadSession,
    organization: Organization,
    catalog: Catalog | None,
    *,
    include_custom_fields: bool = True,
) -> ConfigExport:
    skipped: list[ConfigSkippedResource] = []

    meter_repository = MeterRepository.from_session(session)
    meters_statement = meter_repository.get_organization_statement(organization.id)
    if (
        catalog is not None
        and catalog.status != CatalogStatus.live
        and await catalog_service.lists_meters(session, catalog)
    ):
        meters_statement = CatalogMeterRepository.from_session(
            session
        ).get_meters_statement(catalog.id)
    meters, meter_external_ids = await _export_section(
        ConfigResource.meter,
        meter_repository.stream(meters_statement),
        MAXIMUM_METERS,
        skipped,
        key=lambda meter: meter.external_id,
        name=lambda meter: meter.name,
        archived=lambda meter: meter.archived_at is not None,
        entry=_meter_entry,
    )
    # Products still in use may bill previous versions of the exported meters.
    exported_meters = set(meter_external_ids.values())
    meter_external_ids = {
        **{
            id: external_id
            for id, external_id in (
                await meter_repository.get_external_ids_by_id(organization.id)
            ).items()
            if external_id in exported_meters
        },
        **meter_external_ids,
    }

    benefit_repository = BenefitRepository.from_session(session)
    benefits_statement = benefit_repository.get_organization_statement(organization.id)
    if catalog is not None and catalog.status != CatalogStatus.live:
        catalog_benefit_repository = CatalogBenefitRepository.from_session(session)
        if await catalog_service.lists_benefits(session, catalog):
            benefits_statement = catalog_benefit_repository.get_benefits_statement(
                catalog.id
            )
    benefits: list[ConfigBenefitRead]
    benefits, benefit_external_ids = await _export_section(
        ConfigResource.benefit,
        benefit_repository.stream(benefits_statement),
        MAXIMUM_BENEFITS,
        skipped,
        key=lambda benefit: benefit.external_id,
        name=lambda benefit: benefit.description,
        archived=lambda benefit: False,
        entry=lambda benefit: _benefit_entry(benefit, meter_external_ids),
    )

    custom_fields: list[ConfigCustomFieldRead] | None = None
    custom_field_slugs: Collection[str] | None = None
    if include_custom_fields:
        custom_field_repository = CustomFieldRepository.from_session(session)
        custom_fields_statement = custom_field_repository.get_current_statement(
            organization.id
        )
        if (
            catalog is not None
            and catalog.status != CatalogStatus.live
            and await catalog_service.lists_custom_fields(session, catalog)
        ):
            custom_fields_statement = CatalogCustomFieldRepository.from_session(
                session
            ).get_custom_fields_statement(catalog.id)
        custom_fields, exported_slugs = await _export_section(
            ConfigResource.custom_field,
            custom_field_repository.stream(custom_fields_statement),
            MAXIMUM_CUSTOM_FIELDS,
            skipped,
            key=lambda custom_field: custom_field.slug,
            name=lambda custom_field: custom_field.name,
            archived=lambda custom_field: False,
            entry=_custom_field_entry,
        )
        custom_field_slugs = set(exported_slugs.values())
    # Products still in use may grant previous versions of the exported benefits.
    exported_benefits = set(benefit_external_ids.values())
    benefit_external_ids = {
        **{
            id: external_id
            for id, external_id in (
                await benefit_repository.get_external_ids_by_id(organization.id)
            ).items()
            if external_id in exported_benefits
        },
        **benefit_external_ids,
    }

    product_repository = ProductRepository.from_session(session)
    if catalog is None or catalog.status == CatalogStatus.live:
        products_statement = product_repository.get_organization_statement(
            organization.id
        )
        catalog_external_ids = await product_repository.get_external_ids(
            organization.id, current=True
        )
    else:
        catalog_product_repository = CatalogProductRepository.from_session(session)
        products_statement = catalog_product_repository.get_products_statement(
            catalog.id
        )
        catalog_external_ids = await catalog_product_repository.get_external_ids(
            catalog.id
        )
    deprecated_statement = await get_deprecated_products_statement(
        session, organization, catalog_external_ids
    )
    products, _ = await _export_section(
        ConfigResource.product,
        _chain(
            product_repository.stream(
                products_statement.options(selectinload(Product.attached_custom_fields))
            ),
            product_repository.stream(
                deprecated_statement.options(
                    selectinload(Product.attached_custom_fields)
                )
            ),
        ),
        MAXIMUM_PRODUCTS,
        skipped,
        key=lambda product: product.external_id,
        name=lambda product: product.name,
        details=lambda product: {
            "recurring_interval": product.recurring_interval,
            "recurring_interval_count": product.recurring_interval_count,
        },
        archived=lambda product: (
            product.is_archived
            and (
                product.external_id is None
                or product.external_id in catalog_external_ids
            )
        ),
        entry=lambda product: _product_entry(
            product,
            meter_external_ids,
            benefit_external_ids,
            custom_field_slugs,
            deprecated=product.external_id not in catalog_external_ids,
        ),
    )

    return ConfigExport(
        enabled=organization.is_config_as_code_enabled,
        config=ConfigExportDocument(
            settings=_settings(organization),
            meters=meters,
            custom_fields=custom_fields,
            benefits=benefits,
            products=products,
        ),
        skipped=skipped,
        catalog=None
        if catalog is None
        else ConfigExportCatalog.model_validate(catalog),
    )
