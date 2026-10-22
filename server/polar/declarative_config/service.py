from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, create_model
from sqlalchemy.exc import IntegrityError
from typing_extensions import TypeForm

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.repository import BenefitRepository
from polar.benefit.service import benefit as benefit_service
from polar.catalog.repository import CatalogRepository
from polar.catalog.service import catalog as catalog_service
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Agent, Organization, Product, User
from polar.models.webhook_endpoint import WebhookEventType
from polar.oauth2.exceptions import InsufficientScopeError
from polar.organization.repository import OrganizationRepository
from polar.organization.resolver import OrganizationIDModel, get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.redis import Redis
from polar.subscription.repository import SubscriptionRepository
from polar.webhook.repository import WebhookEndpointRepository
from polar.webhook.schemas import WebhookEndpointCreate, WebhookEndpointUpdate
from polar.webhook.service import webhook as webhook_service

from . import benefits, catalogs, products, validation
from .auth import SECTION_SCOPES
from .export import EXPORTED_SECTIONS, export_config
from .schemas import (
    Config,
    ConfigAction,
    ConfigApplyResult,
    ConfigBenefitMeterCredit,
    ConfigCatalog,
    ConfigCatalogChange,
    ConfigCatalogPlan,
    ConfigChange,
    ConfigExport,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigPlan,
    ConfigProductPriceMeteredTiers,
    ConfigProductPriceMeteredUnit,
    ConfigPrune,
    ConfigPruneEntry,
    ConfigResource,
    ConfigResult,
    ConfigSettingsChange,
    ConfigSettingsResult,
)
from .validation import (
    BenefitChange,
    MeterChange,
    ProductChange,
    ResourceChange,
    SettingsChange,
    WebhookChange,
)

_METER_EXTERNAL_ID_INDEX = "ix_meters_organization_id_external_id"
_BENEFIT_EXTERNAL_ID_INDEX = "ix_benefits_organization_id_external_id"
_PRODUCT_EXTERNAL_ID_INDEX = "ix_products_organization_id_external_id"
_WEBHOOK_EXTERNAL_ID_INDEX = "ix_webhook_endpoints_organization_id_external_id"


def _assert_scopes(
    auth_subject: AuthSubject[User | Organization | Agent],
    sections: Iterable[str],
    *,
    write: bool,
) -> None:
    for section in sections:
        read_scope, write_scope = SECTION_SCOPES[section]
        required = {write_scope} if write else {read_scope, write_scope}
        if not auth_subject.scopes & required:
            raise InsufficientScopeError({str(scope) for scope in required})


def _assert_section_scopes(
    auth_subject: AuthSubject[User | Organization | Agent],
    config: Config,
    *,
    write: bool,
) -> None:
    _assert_scopes(
        auth_subject,
        (section for section in SECTION_SCOPES if section in config.model_fields_set),
        write=write,
    )


# Webhook endpoints are managed with `organization_manage`, which product
# permissions don't imply.
async def _assert_webhooks_permission(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization | Agent],
    config: Config,
    organization: Organization,
) -> None:
    if "webhooks" in config.model_fields_set:
        await assert_organization_permission(
            session,
            auth_subject,
            organization.id,
            OrganizationPermission.organization_manage,
        )


def _constraint_name(error: IntegrityError) -> str | None:
    database_error = getattr(error.orig, "__cause__", None)
    return getattr(database_error, "constraint_name", None)


@dataclass
class _OrganizationTarget:
    organization_id: UUID | None


class ConfigAsCodeNotEnabled(PolarError):
    def __init__(self) -> None:
        super().__init__("Config as code is not enabled for this organization.", 403)


class ConfigMeterConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A meter in this config was created by a concurrent request. Retry.", 409
        )


class ConfigBenefitConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A benefit in this config was created by a concurrent request. Retry.", 409
        )


class ConfigProductConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A product in this config was created by a concurrent request. Retry.", 409
        )


class ConfigWebhookConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A webhook endpoint in this config was created by a concurrent request. "
            "Retry.",
            409,
        )


class ConfigInvalid(PolarError):
    def __init__(self, errors: list[ConfigIssue]) -> None:
        super().__init__("The config can't be applied.", 409)
        self.errors = errors

    @property
    def detail(self) -> list[ConfigIssue]:
        return self.errors

    @classmethod
    def schema(cls) -> type[BaseModel]:
        if cls._schema is None:
            cls._schema = create_model(
                cls.__name__,
                error=(
                    TypeForm(Literal["ConfigInvalid"]),
                    Field(examples=[cls.__name__]),
                ),
                detail=(list[ConfigIssue], ...),
            )
        return cls._schema


class DeclarativeConfigService:
    async def apply(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User | Organization | Agent],
        config: Config,
    ) -> ConfigApplyResult:
        _assert_section_scopes(auth_subject, config, write=True)
        organization = await self._get_organization(
            session, auth_subject, config, OrganizationPermission.products_manage
        )
        if "settings" in config.model_fields_set:
            await assert_organization_permission(
                session,
                auth_subject,
                organization.id,
                OrganizationPermission.organization_manage,
            )
        await _assert_webhooks_permission(session, auth_subject, config, organization)
        await CatalogRepository.from_session(session).lock(organization.id)
        changes, issues = await validation.check(
            session, organization, config, for_update=True
        )
        issues.extend(catalogs.benefit_issues(changes))
        errors = [
            issue for issue in issues if issue.severity == ConfigIssueSeverity.error
        ]
        if errors:
            raise ConfigInvalid(errors)

        live = await catalog_service.get_or_create_live(session, organization)
        _, version_hash = await catalog_service.get_next_version_hash(
            session, organization, live, catalogs.product_definitions(changes)
        )
        settings_result = await self._apply_settings(
            session, organization, changes.settings
        )
        webhook_results = await self._apply_webhooks(
            session, auth_subject, organization, changes.webhooks
        )
        meter_results, meter_ids = await self._apply_meters(
            session, organization, changes.meters
        )
        benefit_results, benefit_ids = await self._apply_benefits(
            session, redis, auth_subject, organization, changes.benefits, meter_ids
        )
        product_results, new_products = await self._apply_products(
            session,
            auth_subject,
            organization,
            changes.products,
            meter_ids,
            benefit_ids,
        )
        catalog: ConfigCatalogChange | None = None
        if new_products:
            assert version_hash is not None
            before = None if live is None else ConfigCatalog.model_validate(live)
            published = await catalog_service.publish(
                session,
                organization,
                live,
                new_products,
                version_hash,
                name=config.catalog_name,
            )
            catalog = ConfigCatalogChange(
                before=before, after=ConfigCatalog.model_validate(published)
            )
        await catalogs.carry_over_references(session, changes.products, new_products)
        if (
            changes.settings is not None
            and changes.settings.action == ConfigAction.updated
        ):
            if "payments.currency" in changes.settings.update_dict:
                await self._assert_products_have_currency(session, organization)
            await webhook_service.send(
                session,
                organization,
                WebhookEventType.organization_updated,
                organization,
            )
        return ConfigApplyResult(
            changes=[
                *webhook_results,
                *meter_results,
                *benefit_results,
                *product_results,
            ],
            catalog=catalog,
            settings=settings_result,
        )

    async def plan(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        config: Config,
    ) -> ConfigPlan:
        _assert_section_scopes(auth_subject, config, write=False)
        organization = await self._get_organization(
            session, auth_subject, config, OrganizationPermission.products_read
        )
        await _assert_webhooks_permission(session, auth_subject, config, organization)
        changes, issues = await validation.check(
            session, organization, config, for_update=False
        )
        issues.extend(catalogs.benefit_issues(changes))
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        catalog_before, catalog_after = await catalog_service.get_next_version_hash(
            session, organization, live, catalogs.product_definitions(changes)
        )
        product_changes = self._plan_changes(ConfigResource.product, changes.products)
        catalog: ConfigCatalogPlan | None = None
        if catalog_after is not None and catalog_after != catalog_before:
            catalog = ConfigCatalogPlan(
                before=None if live is None else ConfigCatalog.model_validate(live),
                name=config.catalog_name
                if config.catalog_name is not None
                else await catalog_service.get_default_name(
                    session,
                    organization,
                    after_baseline=live is None and catalog_before is not None,
                ),
            )
            catalogs.add_catalog_diffs(
                product_changes,
                changes.products,
                None if catalog.before is None else catalog.before.name,
                catalog.name,
            )
        return ConfigPlan(
            changes=[
                *self._plan_changes(ConfigResource.webhook, changes.webhooks),
                *self._plan_changes(ConfigResource.meter, changes.meters),
                *self._plan_changes(ConfigResource.benefit, changes.benefits),
                *product_changes,
            ],
            catalog=catalog,
            settings=None
            if changes.settings is None
            else ConfigSettingsChange(
                action=changes.settings.action, diff=changes.settings.diff
            ),
            issues=issues,
        )

    async def prune(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        config: Config,
    ) -> ConfigPrune:
        _assert_section_scopes(auth_subject, config, write=False)
        organization = await self._get_organization(
            session, auth_subject, config, OrganizationPermission.products_read
        )
        meter_repository = MeterRepository.from_session(session)
        benefit_repository = BenefitRepository.from_session(session)
        product_repository = ProductRepository.from_session(session)
        subscription_repository = SubscriptionRepository.from_session(session)
        grant_repository = BenefitGrantRepository.from_session(session)

        deprecated_meters = [meter for meter in config.meters if meter.deprecated]
        deprecated_benefits = [b for b in config.benefits if b.deprecated]
        deprecated_products = [p for p in config.products if p.deprecated]

        meter_ids = {
            meter.external_id: meter.id
            for meter in await meter_repository.get_all_by_external_ids(
                organization.id, [meter.external_id for meter in deprecated_meters]
            )
        }
        benefit_ids = {
            benefit.external_id: benefit.id
            for benefit in await benefit_repository.get_all_by_external_ids(
                organization.id, [b.external_id for b in deprecated_benefits]
            )
        }
        product_ids = {
            product.external_id: product.id
            for product in await product_repository.get_all_by_external_ids(
                organization.id, [p.external_id for p in deprecated_products]
            )
        }

        product_customers = (
            await subscription_repository.count_billable_customers_by_products(
                list(product_ids.values())
            )
        )
        benefit_customers = await grant_repository.count_granted_customers_by_benefits(
            list(benefit_ids.values())
        )
        meter_customers = await subscription_repository.count_customers_by_meters(
            organization.id, list(meter_ids.values())
        )

        # Products first: a deprecated benefit or meter stays while a kept product uses it
        product_entries: list[ConfigPruneEntry] = []
        kept_products = [p for p in config.products if not p.deprecated]
        for product in deprecated_products:
            product_id = product_ids.get(product.external_id)
            customers = (
                0 if product_id is None else product_customers.get(product_id, 0)
            )
            if customers:
                kept_products.append(product)
            product_entries.append(
                ConfigPruneEntry(
                    resource=ConfigResource.product,
                    external_id=product.external_id,
                    customer_count=customers,
                    referenced_by=[],
                )
            )

        benefit_entries: list[ConfigPruneEntry] = []
        kept_benefits = [b for b in config.benefits if not b.deprecated]
        for benefit in deprecated_benefits:
            benefit_id = benefit_ids.get(benefit.external_id)
            customers = (
                0 if benefit_id is None else benefit_customers.get(benefit_id, 0)
            )
            referenced_by = [
                product.external_id
                for product in kept_products
                if benefit.external_id in product.benefits
            ]
            if customers or referenced_by:
                kept_benefits.append(benefit)
            benefit_entries.append(
                ConfigPruneEntry(
                    resource=ConfigResource.benefit,
                    external_id=benefit.external_id,
                    customer_count=customers,
                    referenced_by=referenced_by,
                )
            )

        meter_entries: list[ConfigPruneEntry] = []
        for meter in deprecated_meters:
            meter_id = meter_ids.get(meter.external_id)
            customers = 0 if meter_id is None else meter_customers.get(meter_id, 0)
            products_on_meter = [
                product.external_id
                for product in kept_products
                if any(
                    isinstance(
                        price,
                        (ConfigProductPriceMeteredUnit, ConfigProductPriceMeteredTiers),
                    )
                    and price.meter == meter.external_id
                    for price in product.prices
                )
            ]
            benefits_on_meter = [
                benefit.external_id
                for benefit in kept_benefits
                if isinstance(benefit, ConfigBenefitMeterCredit)
                and benefit.properties.meter == meter.external_id
            ]
            referenced_by = [*products_on_meter, *benefits_on_meter]
            meter_entries.append(
                ConfigPruneEntry(
                    resource=ConfigResource.meter,
                    external_id=meter.external_id,
                    customer_count=customers,
                    referenced_by=referenced_by,
                )
            )

        return ConfigPrune(entries=[*meter_entries, *benefit_entries, *product_entries])

    async def export(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        organization_id: UUID | None,
    ) -> ConfigExport:
        _assert_scopes(auth_subject, EXPORTED_SECTIONS, write=False)
        organization = await self._get_organization(
            session,
            auth_subject,
            _OrganizationTarget(organization_id),
            OrganizationPermission.products_read,
        )
        return await export_config(session, organization)

    def _plan_changes(
        self, resource: ConfigResource, changes: Sequence[ResourceChange[Any, Any]]
    ) -> list[ConfigChange]:
        return [
            ConfigChange(
                resource=resource,
                external_id=change.config.external_id,
                action=change.action,
                diff=change.diff,
            )
            for change in changes
        ]

    async def _get_organization(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        target: OrganizationIDModel,
        permission: OrganizationPermission,
    ) -> Organization:
        organization = await get_payload_organization(session, auth_subject, target)
        await assert_organization_permission(
            session, auth_subject, organization.id, permission
        )
        if not organization.is_config_as_code_enabled:
            raise ConfigAsCodeNotEnabled()
        return organization

    async def _apply_webhooks(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        organization: Organization,
        changes: Sequence[WebhookChange],
    ) -> list[ConfigResult]:
        if not changes:
            return []
        # `_assert_section_scopes` rejects a webhooks section from an agent.
        assert is_user(auth_subject) or is_organization(auth_subject)
        repository = WebhookEndpointRepository.from_session(session)
        results: list[ConfigResult] = []
        for change in changes:
            config = change.config
            endpoint = change.existing
            if endpoint is None:
                try:
                    async with session.begin_nested():
                        endpoint = await webhook_service.create_endpoint(
                            session,
                            auth_subject,
                            WebhookEndpointCreate(
                                url=config.url,
                                format=config.format,
                                events=config.events,
                                api_version=config.api_version,
                                organization_id=None
                                if is_organization(auth_subject)
                                else organization.id,
                            ),
                            declarative_config=True,
                        )
                        await repository.update(
                            endpoint, update_dict={"external_id": config.external_id}
                        )
                except IntegrityError as e:
                    if _constraint_name(e) != _WEBHOOK_EXTERNAL_ID_INDEX:
                        raise
                    raise ConfigWebhookConflict() from e
            elif change.update_dict:
                await webhook_service.update_endpoint(
                    session,
                    auth_subject,
                    endpoint=endpoint,
                    update_schema=WebhookEndpointUpdate(**change.update_dict),
                    declarative_config=True,
                )
            results.append(
                ConfigResult(
                    resource=ConfigResource.webhook,
                    external_id=config.external_id,
                    action=change.action,
                )
            )
        return results

    async def _apply_settings(
        self,
        session: AsyncSession,
        organization: Organization,
        change: SettingsChange | None,
    ) -> ConfigSettingsResult | None:
        if change is None:
            return None
        if change.update_dict:
            await OrganizationRepository.from_session(session).update(
                organization,
                update_dict={
                    validation.SETTINGS_FIELDS[field]: value
                    for field, value in change.update_dict.items()
                },
            )
        return ConfigSettingsResult(action=change.action)

    async def _assert_products_have_currency(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        currency = organization.default_presentment_currency
        products = await ProductRepository.from_session(
            session
        ).get_products_without_currency(organization.id, currency)
        if products:
            raise ConfigInvalid(
                [
                    ConfigIssue(
                        severity=ConfigIssueSeverity.error,
                        type=ConfigIssueType.missing_currency,
                        loc=["body", "settings", "payments", "currency"],
                        msg=(
                            "Every active product must have a price in this "
                            "currency. Missing on: "
                            + ", ".join(product.name for product in products)
                            + "."
                        ),
                        input=currency,
                    )
                ]
            )

    async def _apply_meters(
        self,
        session: AsyncSession,
        organization: Organization,
        changes: Sequence[MeterChange],
    ) -> tuple[list[ConfigResult], dict[str, UUID]]:
        repository = MeterRepository.from_session(session)
        results: list[ConfigResult] = []
        meter_ids: dict[str, UUID] = {}
        for change in changes:
            meter = change.existing
            if meter is None:
                try:
                    async with session.begin_nested():
                        meter = await meter_service.create_for_organization(
                            session, organization, change.config
                        )
                except IntegrityError as e:
                    if _constraint_name(e) != _METER_EXTERNAL_ID_INDEX:
                        raise
                    raise ConfigMeterConflict() from e
            elif change.update_dict:
                await repository.update(meter, update_dict=change.update_dict)
            meter_ids[change.config.external_id] = meter.id
            results.append(
                ConfigResult(
                    resource=ConfigResource.meter,
                    external_id=change.config.external_id,
                    action=change.action,
                )
            )
        return results, meter_ids

    async def _apply_benefits(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User | Organization | Agent],
        organization: Organization,
        changes: Sequence[BenefitChange],
        meter_ids: dict[str, UUID],
    ) -> tuple[list[ConfigResult], dict[str, UUID]]:
        repository = BenefitRepository.from_session(session)
        results: list[ConfigResult] = []
        benefit_ids: dict[str, UUID] = {}
        for change in changes:
            benefit = change.existing
            if benefit is None:
                try:
                    async with session.begin_nested():
                        benefit = await benefit_service.user_create(
                            session,
                            redis,
                            benefits.benefit_create(
                                change.config,
                                None
                                if is_organization(auth_subject)
                                else organization.id,
                                meter_ids,
                            ),
                            auth_subject,
                            declarative_config=True,
                        )
                        await repository.update(
                            benefit,
                            update_dict={"external_id": change.config.external_id},
                        )
                except IntegrityError as e:
                    if _constraint_name(e) != _BENEFIT_EXTERNAL_ID_INDEX:
                        raise
                    raise ConfigBenefitConflict() from e
            elif change.update_dict:
                await benefit_service.update(
                    session,
                    redis,
                    benefit,
                    benefits.benefit_update(change, meter_ids),
                    auth_subject,
                    declarative_config=True,
                )
            benefit_ids[change.config.external_id] = benefit.id
            results.append(
                ConfigResult(
                    resource=ConfigResource.benefit,
                    external_id=change.config.external_id,
                    action=change.action,
                )
            )
        return results, benefit_ids

    async def _apply_products(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        organization: Organization,
        changes: Sequence[ProductChange],
        meter_ids: dict[str, UUID],
        benefit_ids: dict[str, UUID],
    ) -> tuple[list[ConfigResult], dict[str, Product]]:
        repository = ProductRepository.from_session(session)
        external_ids = {
            str(id): external_id
            for ids in (meter_ids, benefit_ids)
            for external_id, id in ids.items()
        }
        results: list[ConfigResult] = []
        new_products: dict[str, Product] = {}
        for change in changes:
            config = change.config
            product = change.existing
            copy_on_write = product is not None and bool(change.update_dict)
            try:
                if product is None or copy_on_write:
                    try:
                        async with session.begin_nested():
                            if product is not None:
                                await repository.update(
                                    product,
                                    update_dict={"is_current": False},
                                    flush=True,
                                )
                            product = await product_service.create(
                                session,
                                products.product_create(
                                    config,
                                    None
                                    if is_organization(auth_subject)
                                    else organization.id,
                                    meter_ids,
                                ),
                                auth_subject,
                                declarative_config=True,
                            )
                            if change.existing is not None:
                                catalog_service.copy_product_settings(
                                    change.existing, product
                                )
                            await repository.update(
                                product, update_dict={"external_id": config.external_id}
                            )
                    except IntegrityError as e:
                        if _constraint_name(e) != _PRODUCT_EXTERNAL_ID_INDEX:
                            raise
                        raise ConfigProductConflict() from e
                if (change.existing is None or copy_on_write) and config.benefits:
                    await product_service.update_benefits(
                        session,
                        product,
                        [benefit_ids[benefit] for benefit in config.benefits],
                        auth_subject,
                        declarative_config=True,
                    )
            except PolarRequestValidationError as e:
                raise products.product_error(e, change.index, external_ids) from e
            if (change.existing is None or copy_on_write) and not product.is_archived:
                new_products[config.external_id] = product
            results.append(
                ConfigResult(
                    resource=ConfigResource.product,
                    external_id=config.external_id,
                    action=change.action,
                )
            )
        return results, new_products


declarative_config = DeclarativeConfigService()
