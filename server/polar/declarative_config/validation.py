import json
from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from decimal import Decimal
from typing import Any, cast

from polar.benefit.repository import BenefitRepository
from polar.benefit.strategies.meter_credit.properties import (
    BenefitMeterCreditProperties,
)
from polar.catalog.repository import (
    CatalogBenefitRepository,
    CatalogProductRepository,
)
from polar.catalog.service import catalog as catalog_service
from polar.event.system import SystemEvent
from polar.event_type.repository import EventTypeRepository
from polar.kit.currency import PresentmentCurrency
from polar.meter.filter import Filter, FilterOperator
from polar.meter.repository import MeterRepository
from polar.meter.schemas import MeterCreateBase
from polar.meter.service import METER_LOCKED_FIELD_MESSAGE, METER_LOCKED_FIELDS
from polar.models import (
    Benefit,
    Catalog,
    Meter,
    Organization,
    Product,
    ProductPrice,
    ProductPriceFixed,
    ProductPriceMeteredTiers,
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
    ProductPriceUnit,
    WebhookEndpoint,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository
from polar.webhook.repository import WebhookEndpointRepository

from .schemas import (
    Config,
    ConfigAction,
    ConfigBenefit,
    ConfigBenefitLicenseKeys,
    ConfigBenefitMeterCredit,
    ConfigFieldChange,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigMeter,
    ConfigProduct,
    ConfigProductPriceMeteredTiers,
    ConfigProductPriceMeteredUnit,
    ConfigResource,
    ConfigSettings,
    ConfigWebhookEndpoint,
)

Loc = list[str | int]

_METER_FIELDS = tuple(
    field for field in MeterCreateBase.model_fields if field != "metadata"
)


@dataclass
class ResourceChange[ConfigT, ModelT]:
    index: int
    config: ConfigT
    existing: ModelT | None
    update_dict: dict[str, Any]
    before: dict[str, Any] = dataclass_field(default_factory=dict)

    @property
    def action(self) -> ConfigAction:
        if self.existing is None:
            return ConfigAction.created
        if self.update_dict:
            return ConfigAction.updated
        return ConfigAction.unchanged

    @property
    def diff(self) -> list[ConfigFieldChange]:
        return [
            ConfigFieldChange(
                field="metadata" if name == "user_metadata" else name,
                before=self._before(name),
                after=after,
            )
            for name, after in self.update_dict.items()
        ]

    def _before(self, name: str) -> Any:
        if self.existing is None:
            return None
        if name in self.before:
            return self.before[name]
        return getattr(self.existing, name)


SETTINGS_FIELDS = {
    "payments.currency": "default_presentment_currency",
    "payments.tax": "default_tax_behavior",
}


def _setting(settings: ConfigSettings, field: str) -> Any:
    value: Any = settings
    for part in field.split("."):
        value = getattr(value, part)
        if value is None:
            return None
    return value


@dataclass
class SettingsChange:
    update_dict: dict[str, Any]
    before: dict[str, Any]

    @property
    def action(self) -> ConfigAction:
        if self.update_dict:
            return ConfigAction.updated
        return ConfigAction.unchanged

    @property
    def diff(self) -> list[ConfigFieldChange]:
        return [
            ConfigFieldChange(
                field=field,
                before=self.before[field],
                after=after,
            )
            for field, after in self.update_dict.items()
        ]


def diff_settings(
    organization: Organization, settings: ConfigSettings | None
) -> SettingsChange | None:
    if settings is None:
        return None
    before = {
        field: getattr(organization, attribute)
        for field, attribute in SETTINGS_FIELDS.items()
    }
    update_dict = {
        field: value
        for field in SETTINGS_FIELDS
        if (value := _setting(settings, field)) is not None and before[field] != value
    }
    return SettingsChange(update_dict, before)


MeterChange = ResourceChange[ConfigMeter, Meter]
BenefitChange = ResourceChange[ConfigBenefit, Benefit]
ProductChange = ResourceChange[ConfigProduct, Product]
WebhookChange = ResourceChange[ConfigWebhookEndpoint, WebhookEndpoint]


@dataclass
class ConfigChanges:
    settings: SettingsChange | None
    webhooks: list[WebhookChange]
    meters: list[MeterChange]
    benefits: list[BenefitChange]
    products: list[ProductChange]


def _loc(resource: ConfigResource, index: int, *path: str | int) -> Loc:
    return ["body", f"{resource}s", index, *path]


def _meter_loc(index: int, *path: str | int) -> Loc:
    return _loc(ConfigResource.meter, index, *path)


def unique_external_ids(
    resource: ConfigResource, external_ids: Sequence[str]
) -> list[ConfigIssue]:
    seen: set[str] = set()
    issues: list[ConfigIssue] = []
    for index, external_id in enumerate(external_ids):
        if external_id in seen:
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.duplicate_external_id,
                    loc=_loc(resource, index, "external_id"),
                    msg=f"Another {resource} in this config has the same external_id.",
                    input=external_id,
                )
            )
        seen.add(external_id)
    return issues


def _unknown_reference(
    resource: ConfigResource, external_id: str, loc: Loc
) -> ConfigIssue:
    return ConfigIssue(
        severity=ConfigIssueSeverity.error,
        type=ConfigIssueType.unknown_reference,
        loc=loc,
        msg=f"No {resource} in this config has this external_id.",
        input=external_id,
    )


def _deprecated_reference(
    resource: ConfigResource, external_id: str, loc: Loc
) -> ConfigIssue:
    return ConfigIssue(
        severity=ConfigIssueSeverity.error,
        type=ConfigIssueType.deprecated_reference,
        loc=loc,
        msg=(
            f"This {resource} is deprecated. "
            f"Undeprecate the {resource} or create a new one."
        ),
        input=external_id,
    )


def _reference_issues(
    resource: ConfigResource,
    known: set[str],
    deprecated: set[str],
    external_id: str,
    loc: Loc,
) -> list[ConfigIssue]:
    if external_id not in known:
        return [_unknown_reference(resource, external_id, loc)]
    if external_id in deprecated:
        return [_deprecated_reference(resource, external_id, loc)]
    return []


def invalid_references(config: Config) -> list[ConfigIssue]:
    meters = {meter.external_id for meter in config.meters}
    deprecated_meters = {
        meter.external_id for meter in config.meters if meter.deprecated
    }
    benefits = {benefit.external_id for benefit in config.benefits}
    deprecated_benefits = {
        benefit.external_id for benefit in config.benefits if benefit.deprecated
    }
    issues: list[ConfigIssue] = []
    for index, benefit in enumerate(config.benefits):
        if isinstance(benefit, ConfigBenefitMeterCredit):
            issues.extend(
                _reference_issues(
                    ConfigResource.meter,
                    meters,
                    set() if benefit.deprecated else deprecated_meters,
                    benefit.properties.meter,
                    _loc(ConfigResource.benefit, index, "properties", "meter"),
                )
            )
    for index, product in enumerate(config.products):
        product_deprecated_meters = set() if product.deprecated else deprecated_meters
        product_deprecated_benefits = (
            set() if product.deprecated else deprecated_benefits
        )
        for price_index, price in enumerate(product.prices):
            if isinstance(
                price, (ConfigProductPriceMeteredUnit, ConfigProductPriceMeteredTiers)
            ):
                issues.extend(
                    _reference_issues(
                        ConfigResource.meter,
                        meters,
                        product_deprecated_meters,
                        price.meter,
                        _loc(
                            ConfigResource.product,
                            index,
                            "prices",
                            price_index,
                            "meter",
                        ),
                    )
                )
        listed: set[str] = set()
        for benefit_index, benefit_external_id in enumerate(product.benefits):
            loc = _loc(ConfigResource.product, index, "benefits", benefit_index)
            if benefit_external_id in listed:
                issues.append(
                    ConfigIssue(
                        severity=ConfigIssueSeverity.error,
                        type=ConfigIssueType.duplicate_external_id,
                        loc=loc,
                        msg="This benefit is already listed on the product.",
                        input=benefit_external_id,
                    )
                )
            else:
                issues.extend(
                    _reference_issues(
                        ConfigResource.benefit,
                        benefits,
                        product_deprecated_benefits,
                        benefit_external_id,
                        loc,
                    )
                )
            listed.add(benefit_external_id)
    return issues


def unsupported_prices(changes: Sequence[ProductChange]) -> list[ConfigIssue]:
    issues: list[ConfigIssue] = []
    for change in changes:
        if change.existing is None or len(change.before["prices"]) == len(
            change.existing.prices
        ):
            continue
        changed = "prices" in change.update_dict
        issues.append(
            ConfigIssue(
                severity=ConfigIssueSeverity.error
                if changed
                else ConfigIssueSeverity.warning,
                type=ConfigIssueType.not_supported,
                loc=_loc(ConfigResource.product, change.index, "prices"),
                msg=(
                    "This product has prices config can't manage yet: custom "
                    "prices, or metered prices on meters not in this config. "
                    + (
                        "Its prices can't be changed from config."
                        if changed
                        else "They are left untouched."
                    )
                ),
                input=None,
            )
        )
    return issues


def _settings_loc(field: str) -> Loc:
    return ["body", "settings", *field.split(".")]


def missing_product_currencies(
    changes: Sequence[ProductChange],
    currency: PresentmentCurrency,
    *,
    currency_changed: bool,
) -> list[ConfigIssue]:
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.missing_currency,
            loc=_loc(ConfigResource.product, change.index, "prices"),
            msg=(
                "The product must have a price in the organization's "
                f"default currency, {currency.upper()}."
            ),
            input=None,
        )
        for change in changes
        if (
            currency_changed
            or change.existing is None
            or "prices" in change.update_dict
        )
        and all(price.price_currency != currency for price in change.config.prices)
    ]


async def missing_unlisted_product_currencies(
    session: AsyncSession,
    organization: Organization,
    changes: Sequence[ProductChange],
    currency: PresentmentCurrency,
) -> list[ConfigIssue]:
    listed = {change.config.external_id for change in changes}
    products = [
        product
        for product in await ProductRepository.from_session(
            session
        ).get_products_without_currency(organization.id, currency)
        if product.external_id not in listed
    ]
    if not products:
        return []
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.missing_currency,
            loc=_settings_loc("payments.currency"),
            msg=(
                "Every active product must have a price in this currency. "
                "Missing on products not in this config: "
                + ", ".join(product.name for product in products)
                + "."
            ),
            input=currency,
        )
    ]


def changed_currency(currency: PresentmentCurrency) -> ConfigIssue:
    return ConfigIssue(
        severity=ConfigIssueSeverity.warning,
        type=ConfigIssueType.currency_changed,
        loc=_settings_loc("payments.currency"),
        msg=(
            f"New checkouts will use {currency.upper()} when the product has "
            "no price in the customer's local currency."
        ),
        input=currency,
    )


def changed_intervals(changes: Sequence[ProductChange]) -> list[ConfigIssue]:
    issues: list[ConfigIssue] = []
    for change in changes:
        if change.existing is None:
            continue
        for name in ("recurring_interval", "recurring_interval_count"):
            value = getattr(change.config, name)
            if getattr(change.existing, name) != value:
                issues.append(
                    ConfigIssue(
                        severity=ConfigIssueSeverity.error,
                        type=ConfigIssueType.interval_changed,
                        loc=_loc(ConfigResource.product, change.index, name),
                        msg=(
                            "The billing interval of an existing product "
                            "can't be changed."
                        ),
                        input=value,
                    )
                )
                break
    return issues


def locked_meter_fields(changes: list[MeterChange]) -> list[ConfigIssue]:
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.meter_locked,
            loc=_meter_loc(change.index, field),
            msg=METER_LOCKED_FIELD_MESSAGE,
            input=None,
        )
        for change in changes
        if change.existing is not None
        and change.existing.last_billed_event_id is not None
        for field in METER_LOCKED_FIELDS
        if field in change.update_dict
    ]


def _event_name_references(filter: Filter, loc: Loc) -> list[tuple[str, Loc]]:
    references: list[tuple[str, Loc]] = []
    for index, clause in enumerate(filter.clauses):
        clause_loc = [*loc, "clauses", index]
        if isinstance(clause, Filter):
            references.extend(_event_name_references(clause, clause_loc))
        elif (
            clause.property == "name"
            and clause.operator == FilterOperator.eq
            and isinstance(clause.value, str)
            and clause.value not in SystemEvent
        ):
            references.append((clause.value, [*clause_loc, "value"]))
    return references


async def unknown_events(
    session: AsyncSession, organization: Organization, changes: list[MeterChange]
) -> list[ConfigIssue]:
    references = [
        reference
        for change in changes
        for reference in _event_name_references(
            change.config.filter, _meter_loc(change.index, "filter")
        )
    ]
    repository = EventTypeRepository.from_session(session)
    known = await repository.get_by_names_and_organization(
        sorted({name for name, _ in references}), organization.id
    )
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.warning,
            type=ConfigIssueType.unknown_event,
            loc=loc,
            msg="No events with this name have been received yet.",
            input=name,
        )
        for name, loc in references
        if (organization.id, name) not in known
    ]


def _get_meter_update_dict(
    meter: Meter | None, meter_config: ConfigMeter
) -> dict[str, Any]:
    update_dict: dict[str, Any] = {}
    for field in _METER_FIELDS:
        value = getattr(meter_config, field)
        if getattr(meter, field, None) != value:
            update_dict[field] = value
    if "metadata" in meter_config.model_fields_set and (
        getattr(meter, "user_metadata", None) != meter_config.metadata
    ):
        update_dict["user_metadata"] = meter_config.metadata
    return update_dict


async def diff_meters(
    session: AsyncSession,
    organization: Organization,
    meter_configs: Sequence[ConfigMeter],
    *,
    for_update: bool,
) -> list[MeterChange]:
    repository = MeterRepository.from_session(session)
    existing_meters = {
        meter.external_id: meter
        for meter in await repository.get_all_by_external_ids(
            organization.id,
            [config.external_id for config in meter_configs],
            for_update=for_update,
        )
    }
    changes: list[MeterChange] = []
    for index, meter_config in enumerate(meter_configs):
        meter = existing_meters.get(meter_config.external_id)
        update_dict = _get_meter_update_dict(meter, meter_config)
        changes.append(MeterChange(index, meter_config, meter, update_dict))
    return changes


def _create_update_dict(
    config: ConfigBenefit | ConfigProduct,
) -> dict[str, Any]:
    update_dict: dict[str, Any] = {}
    for field in type(config).model_fields:
        value = getattr(config, field)
        if field in ("external_id", "deprecated") or value in (None, [], {}):
            continue
        update_dict["user_metadata" if field == "metadata" else field] = value
    return update_dict


def benefit_properties(
    benefit: Benefit, meter_external_ids: dict[str, str]
) -> dict[str, Any]:
    if benefit.type == BenefitType.license_keys:
        return {
            key: benefit.properties.get(key)
            for key in ("prefix", "expires", "activations", "limit_usage")
        }
    if benefit.type != BenefitType.meter_credit:
        return {}
    properties = cast(BenefitMeterCreditProperties, benefit.properties)
    meter_id = str(properties["meter_id"])
    return {
        "meter": meter_external_ids.get(meter_id, meter_id),
        "units": properties["units"],
        "rollover": properties["rollover"],
    }


def _config_benefit_properties(benefit_config: ConfigBenefit) -> dict[str, Any]:
    if isinstance(benefit_config, (ConfigBenefitMeterCredit, ConfigBenefitLicenseKeys)):
        return benefit_config.properties.model_dump()
    return {}


def _get_benefit_update_dict(
    benefit: Benefit, benefit_config: ConfigBenefit, properties: dict[str, Any]
) -> dict[str, Any]:
    update_dict: dict[str, Any] = {}
    if benefit.description != benefit_config.description:
        update_dict["description"] = benefit_config.description
    if benefit.visibility != benefit_config.visibility:
        update_dict["visibility"] = benefit_config.visibility
    config_properties = _config_benefit_properties(benefit_config)
    if properties != config_properties:
        update_dict["properties"] = config_properties
    if (
        "metadata" in benefit_config.model_fields_set
        and benefit.user_metadata != benefit_config.metadata
    ):
        update_dict["user_metadata"] = benefit_config.metadata
    return update_dict


async def diff_benefits(
    session: AsyncSession,
    organization: Organization,
    benefit_configs: Sequence[ConfigBenefit],
    meters: Sequence[MeterChange],
    *,
    for_update: bool,
    catalog: Catalog | None = None,
) -> list[BenefitChange]:
    repository = BenefitRepository.from_session(session)
    catalog_benefit_repository = CatalogBenefitRepository.from_session(session)
    external_ids = [config.external_id for config in benefit_configs]
    if catalog is not None and await catalog_service.lists_benefits(session, catalog):
        benefits = await catalog_benefit_repository.get_benefits_by_external_ids(
            catalog.id, external_ids, options=repository.get_eager_options()
        )
    else:
        benefits = await repository.get_all_by_external_ids(
            organization.id, external_ids, for_update=for_update
        )
    existing_benefits = {benefit.external_id: benefit for benefit in benefits}
    meter_external_ids = _external_ids_by_id(meters)
    changes: list[BenefitChange] = []
    for index, benefit_config in enumerate(benefit_configs):
        benefit = existing_benefits.get(benefit_config.external_id)
        if benefit is None:
            if benefit_config.deprecated:
                continue
            create_dict = _create_update_dict(benefit_config)
            if "properties" in create_dict:
                create_dict["properties"] = create_dict["properties"].model_dump()
            changes.append(BenefitChange(index, benefit_config, None, create_dict))
            continue
        properties = benefit_properties(benefit, meter_external_ids)
        changes.append(
            BenefitChange(
                index,
                benefit_config,
                benefit,
                # A deprecated benefit leaves the catalog instead of getting a new row.
                {}
                if benefit_config.deprecated
                else _get_benefit_update_dict(benefit, benefit_config, properties),
                {"properties": properties},
            )
        )
    return changes


def benefit_type_changes(changes: Sequence[BenefitChange]) -> list[ConfigIssue]:
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.type_changed,
            loc=_loc(ConfigResource.benefit, change.index, "type"),
            msg="The type of an existing benefit can't be changed.",
            input=change.config.type,
        )
        for change in changes
        if change.existing is not None and change.existing.type != change.config.type
    ]


_PRODUCT_FIELDS = ("name", "description", "visibility")
_TRIAL_FIELDS = ("trial_interval", "trial_interval_count")


def price_config(
    price: ProductPrice, meter_external_ids: dict[str, str]
) -> dict[str, Any] | None:
    config: dict[str, Any] = {
        "amount_type": price.amount_type,
        "price_currency": price.price_currency,
        "tax_behavior": price.tax_behavior,
    }
    if isinstance(price, ProductPriceFixed):
        return {**config, "price_amount": price.price_amount}
    if isinstance(price, ProductPriceMeteredUnit):
        meter_id = str(price.meter_id)
        if meter_id not in meter_external_ids:
            return None
        return {
            **config,
            "meter": meter_external_ids[meter_id],
            "unit_amount": price.unit_amount,
            "cap_amount": price.cap_amount,
        }

    if isinstance(price, ProductPriceMeteredTiers):
        meter_id = str(price.meter_id)
        if meter_id not in meter_external_ids:
            return None

        return {
            **config,
            "meter": meter_external_ids[meter_id],
            "tiers": price.tiers.model_dump(),
            "cap_amount": price.cap_amount,
        }

    if isinstance(price, ProductPriceSeatUnit):
        if price.tiers is None or price.get_maximum_seats() != price.tiers.last_bound:
            return None
        return {
            **config,
            "tiers": price.tiers.model_dump(),
            "minimum_units": price.get_minimum_seats(),
        }

    if isinstance(price, ProductPriceUnit):
        if price.tiers is None or price.get_maximum_units() != price.tiers.last_bound:
            return None
        return {
            **config,
            "tiers": price.tiers.model_dump(),
            "minimum_units": price.get_minimum_purchasable_units(),
            "unit_label": price.unit_label,
        }

    return None


type PriceKey = tuple[tuple[str, str], ...]


def _comparable(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        default=lambda v: str(v.normalize()) if isinstance(v, Decimal) else str(v),
    )


def price_key(price: dict[str, Any]) -> PriceKey:
    return tuple(sorted((key, _comparable(value)) for key, value in price.items()))


def _get_product_update_dict(
    product: Product,
    product_config: ConfigProduct,
    prices: list[dict[str, Any] | None],
    benefits: list[str],
) -> dict[str, Any]:
    update_dict: dict[str, Any] = {}
    for name in (*_PRODUCT_FIELDS, *_TRIAL_FIELDS):
        value = getattr(product_config, name)
        if getattr(product, name) != value:
            update_dict[name] = value
    config_prices = [price.model_dump() for price in product_config.prices]
    if sorted(map(price_key, config_prices)) != sorted(
        price_key(price) for price in prices if price is not None
    ):
        update_dict["prices"] = config_prices
    if benefits != product_config.benefits:
        update_dict["benefits"] = product_config.benefits
    if (
        "metadata" in product_config.model_fields_set
        and product.user_metadata != product_config.metadata
    ):
        update_dict["user_metadata"] = product_config.metadata
    return update_dict


async def diff_products(
    session: AsyncSession,
    organization: Organization,
    product_configs: Sequence[ConfigProduct],
    meters: Sequence[MeterChange],
    benefits: Sequence[BenefitChange],
    *,
    for_update: bool,
    catalog: Catalog | None,
) -> list[ProductChange]:
    repository = ProductRepository.from_session(session)
    external_ids = [config.external_id for config in product_configs]
    if catalog is None:
        products = await repository.get_all_by_external_ids(
            organization.id, external_ids, for_update=for_update
        )
    else:
        products = await CatalogProductRepository.from_session(
            session
        ).get_products_by_external_ids(
            catalog.id, external_ids, options=repository.get_eager_options()
        )
    existing_products = {product.external_id: product for product in products}
    meter_external_ids = _external_ids_by_id(meters)
    benefit_external_ids = _external_ids_by_id(benefits)
    changes: list[ProductChange] = []
    for index, product_config in enumerate(product_configs):
        if product_config.deprecated:
            continue
        product = existing_products.get(product_config.external_id)
        if product is None:
            create_dict = _create_update_dict(product_config)
            create_dict["prices"] = [
                price.model_dump() for price in product_config.prices
            ]
            changes.append(ProductChange(index, product_config, None, create_dict))
            continue
        prices = [price_config(price, meter_external_ids) for price in product.prices]
        product_benefits = [
            benefit_external_ids.get(str(benefit.id), str(benefit.id))
            for benefit in product.benefits
        ]
        changes.append(
            ProductChange(
                index,
                product_config,
                product,
                _get_product_update_dict(
                    product, product_config, prices, product_benefits
                ),
                {
                    "prices": [price for price in prices if price is not None],
                    "benefits": product_benefits,
                },
            )
        )
    return changes


def _webhook_config_values(webhook_config: ConfigWebhookEndpoint) -> dict[str, Any]:
    return {
        "url": str(webhook_config.url),
        "format": webhook_config.format,
        "events": list(webhook_config.events),
        "api_version": str(webhook_config.api_version),
    }


def _webhook_endpoint_values(endpoint: WebhookEndpoint) -> dict[str, Any]:
    return {
        "url": endpoint.url,
        "format": endpoint.format,
        "events": list(endpoint.events),
        "api_version": str(endpoint.api_version),
    }


def _get_webhook_update_dict(
    before: dict[str, Any], after: dict[str, Any]
) -> dict[str, Any]:
    update_dict: dict[str, Any] = {}
    for name, value in after.items():
        if name == "events":
            if set(before[name]) != set(value):
                update_dict[name] = value
        elif before[name] != value:
            update_dict[name] = value
    return update_dict


async def diff_webhooks(
    session: AsyncSession,
    organization: Organization,
    webhook_configs: Sequence[ConfigWebhookEndpoint],
    *,
    for_update: bool,
) -> list[WebhookChange]:
    repository = WebhookEndpointRepository.from_session(session)
    existing_endpoints = {
        endpoint.external_id: endpoint
        for endpoint in await repository.get_all_by_external_ids(
            organization.id,
            [config.external_id for config in webhook_configs],
            for_update=for_update,
        )
    }
    changes: list[WebhookChange] = []
    for index, webhook_config in enumerate(webhook_configs):
        endpoint = existing_endpoints.get(webhook_config.external_id)
        after = _webhook_config_values(webhook_config)
        if endpoint is None:
            changes.append(WebhookChange(index, webhook_config, None, after))
            continue
        before = _webhook_endpoint_values(endpoint)
        changes.append(
            WebhookChange(
                index,
                webhook_config,
                endpoint,
                _get_webhook_update_dict(before, after),
                before,
            )
        )
    return changes


def _external_ids_by_id(
    changes: Sequence[ResourceChange[Any, Any]],
) -> dict[str, str]:
    return {
        str(change.existing.id): change.config.external_id
        for change in changes
        if change.existing is not None
    }


async def check(
    session: AsyncSession,
    organization: Organization,
    config: Config,
    *,
    for_update: bool,
    catalog: Catalog | None = None,
) -> tuple[ConfigChanges, list[ConfigIssue]]:
    webhooks = await diff_webhooks(
        session, organization, config.webhooks, for_update=for_update
    )
    meters = await diff_meters(
        session, organization, config.meters, for_update=for_update
    )
    benefits = await diff_benefits(
        session,
        organization,
        config.benefits,
        meters,
        for_update=for_update,
        catalog=catalog,
    )
    products = await diff_products(
        session,
        organization,
        config.products,
        meters,
        benefits,
        for_update=for_update,
        catalog=catalog,
    )
    issues = [
        *unique_external_ids(
            ConfigResource.webhook, [webhook.external_id for webhook in config.webhooks]
        ),
        *unique_external_ids(
            ConfigResource.meter, [meter.external_id for meter in config.meters]
        ),
        *unique_external_ids(
            ConfigResource.benefit, [benefit.external_id for benefit in config.benefits]
        ),
        *unique_external_ids(
            ConfigResource.product, [product.external_id for product in config.products]
        ),
        *invalid_references(config),
        *locked_meter_fields(meters),
        *await unknown_events(session, organization, meters),
        *benefit_type_changes(benefits),
        *unsupported_prices(products),
        *changed_intervals(products),
    ]
    settings = diff_settings(organization, config.settings)
    new_currency = (
        None if settings is None else settings.update_dict.get("payments.currency")
    )
    currency = new_currency or organization.default_presentment_currency
    issues.extend(
        missing_product_currencies(
            products, currency, currency_changed=new_currency is not None
        )
    )
    if new_currency is not None:
        issues.extend(
            await missing_unlisted_product_currencies(
                session, organization, products, new_currency
            )
        )
        issues.append(changed_currency(new_currency))
    return (
        ConfigChanges(settings, webhooks, meters, benefits, products),
        issues,
    )
