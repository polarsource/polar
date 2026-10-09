from collections.abc import Callable, Iterable
from typing import Any, Protocol, cast
from uuid import UUID

from pydantic import TypeAdapter, ValidationError

from polar.benefit.repository import BenefitRepository
from polar.benefit.strategies.meter_credit.properties import (
    BenefitMeterCreditProperties,
)
from polar.meter.repository import MeterRepository
from polar.models import Benefit, Meter, Organization, Product
from polar.models.benefit import BenefitType
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .schemas import (
    MAXIMUM_BENEFITS,
    MAXIMUM_METERS,
    MAXIMUM_PRODUCTS,
    ConfigBenefit,
    ConfigExport,
    ConfigExportBenefit,
    ConfigExportDocument,
    ConfigExportMeter,
    ConfigExportProduct,
    ConfigMeter,
    ConfigProduct,
    ConfigResource,
    ConfigSkippedReason,
    ConfigSkippedResource,
)
from .validation import benefit_properties, price_config

_config_benefit = TypeAdapter[ConfigBenefit](ConfigBenefit)
_export_benefit = TypeAdapter[ConfigExportBenefit](ConfigExportBenefit)


class _Exportable(Protocol):
    @property
    def id(self) -> UUID: ...

    @property
    def external_id(self) -> str | None: ...


def _export_section[ModelT: _Exportable, EntryT](
    resource: ConfigResource,
    models: Iterable[ModelT],
    maximum: int,
    skipped: list[ConfigSkippedResource],
    *,
    name: Callable[[ModelT], str],
    archived: Callable[[ModelT], bool],
    entry: Callable[[ModelT], EntryT | None],
) -> tuple[list[EntryT], dict[str, str]]:
    """
    `entry` returns `None` when the model references something left out of the
    export. Also returns the exported `external_id`s by model ID, so later
    sections only reference entries that are in the document.
    """
    entries: list[EntryT] = []
    external_ids: dict[str, str] = {}
    for model in models:
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
        if reason is not None:
            skipped.append(
                ConfigSkippedResource(
                    resource=resource, id=model.id, name=name(model), reason=reason
                )
            )
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
    if None in prices or None in benefits:
        return None
    config = ConfigProduct.model_validate(
        {
            "external_id": product.external_id,
            "name": product.name,
            "description": product.description,
            "visibility": product.visibility,
            "recurring_interval": product.recurring_interval,
            "recurring_interval_count": product.recurring_interval_count,
            "prices": prices,
            "benefits": benefits,
            "metadata": product.user_metadata,
        }
    )
    return ConfigExportProduct.model_validate(config.model_dump())


async def export_config(
    session: AsyncReadSession, organization: Organization
) -> ConfigExport:
    skipped: list[ConfigSkippedResource] = []

    meter_repository = MeterRepository.from_session(session)
    meters, meter_external_ids = _export_section(
        ConfigResource.meter,
        await meter_repository.get_all(
            meter_repository.get_organization_statement(organization.id)
        ),
        MAXIMUM_METERS,
        skipped,
        name=lambda meter: meter.name,
        archived=lambda meter: meter.archived_at is not None,
        entry=_meter_entry,
    )

    benefits: list[ConfigExportBenefit]
    benefits, benefit_external_ids = _export_section(
        ConfigResource.benefit,
        await BenefitRepository.from_session(session).get_all_by_organization(
            organization.id
        ),
        MAXIMUM_BENEFITS,
        skipped,
        name=lambda benefit: benefit.description,
        archived=lambda benefit: False,
        entry=lambda benefit: _benefit_entry(benefit, meter_external_ids),
    )

    products, _ = _export_section(
        ConfigResource.product,
        await ProductRepository.from_session(
            session
        ).get_all_by_organization_with_archived(organization.id),
        MAXIMUM_PRODUCTS,
        skipped,
        name=lambda product: product.name,
        archived=lambda product: product.is_archived,
        entry=lambda product: _product_entry(
            product, meter_external_ids, benefit_external_ids
        ),
    )

    return ConfigExport(
        config=ConfigExportDocument(
            meters=meters, benefits=benefits, products=products
        ),
        skipped=skipped,
    )
