from decimal import Decimal
from typing import Any, get_args

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.benefit.repository import BenefitRepository
from polar.catalog.repository import (
    CatalogProductRepository,
    CatalogRepository,
)
from polar.catalog.service import compute_version_hash
from polar.declarative_config.schemas import (
    Config,
    ConfigAction,
    ConfigBenefit,
    ConfigCatalog,
    ConfigCatalogChange,
    ConfigCatalogPlan,
    ConfigExportDocument,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigProductPrice,
    ConfigProductPriceFixedRead,
    ConfigRemoval,
    ConfigRemovalReason,
    ConfigResource,
    ConfigSkippedReason,
)
from polar.declarative_config.service import (
    ConfigAsCodeNotEnabled,
    ConfigBenefitConflict,
    ConfigInvalid,
    ConfigMeterConflict,
    ConfigProductConflict,
)
from polar.declarative_config.service import (
    declarative_config as declarative_config_service,
)
from polar.enums import (
    SubscriptionProrationBehavior,
    SubscriptionRecurringInterval,
    TaxBehaviorOption,
)
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.kit.trial import TrialInterval
from polar.kit.utils import utc_now
from polar.kit.visibility import Visibility
from polar.meter.repository import MeterRepository
from polar.meter.unit import MeterUnit
from polar.models import (
    Agent,
    Customer,
    Organization,
    ProductPriceFixed,
    ProductPriceMeteredTiers,
    ProductPriceUnit,
    SubscriptionMeter,
    SubscriptionUpdate,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.product_price import ProductPriceAmountType
from polar.models.subscription import SubscriptionStatus
from polar.models.user_organization import OrganizationRole
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.oauth2.exceptions import InsufficientScopeError
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository
from polar.product.tiers import Tiers
from polar.redis import Redis
from polar.version import CURRENT_API_VERSION, V2026_04
from polar.webhook.repository import WebhookEndpointRepository
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_active_subscription,
    create_benefit,
    create_benefit_grant,
    create_checkout_link,
    create_discount,
    create_event,
    create_meter,
    create_product,
    create_product_price_metered_tiers,
    create_product_price_unit_based,
    create_subscription,
    create_webhook_endpoint,
)

TOOL_CALLS_METER = {
    "external_id": "sdk-tool-calls",
    "name": "SDK - Tool Calls",
    "filter": {
        "conjunction": "and",
        "clauses": [
            {
                "conjunction": "or",
                "clauses": [
                    {"property": "name", "operator": "eq", "value": "tool_call"}
                ],
            }
        ],
    },
    "aggregation": {"func": "count"},
    "unit": "custom",
    "custom_label": "call",
    "custom_multiplier": None,
}

FIXTURE_METER = {
    "external_id": "my-meter",
    "name": "My Meter",
    "filter": {
        "conjunction": "and",
        "clauses": [{"property": "name", "operator": "eq", "value": METER_TEST_EVENT}],
    },
    "aggregation": {"func": "count"},
}


CREDITS_BENEFIT = {
    "type": "meter_credit",
    "external_id": "tool-call-credits",
    "description": "1,000 tool calls",
    "properties": {"meter": "sdk-tool-calls", "units": 1000},
}

BETA_BENEFIT = {
    "type": "feature_flag",
    "external_id": "beta",
    "description": "Beta access",
}

PRO_PRODUCT = {
    "external_id": "pro",
    "name": "Pro",
    "recurring_interval": "month",
    "prices": [
        {"amount_type": "fixed", "price_amount": 2000},
        {
            "amount_type": "metered_unit",
            "meter": "sdk-tool-calls",
            "unit_amount": "0.5",
        },
    ],
    "benefits": ["tool-call-credits", "beta"],
}

PACK_PRODUCT = {
    "external_id": "pack",
    "name": "Pack",
    "prices": [{"amount_type": "fixed", "price_amount": 1000}],
}

EUR_PACK_PRICE = {
    "amount_type": "fixed",
    "price_amount": 900,
    "price_currency": "eur",
}


TEAM_PRODUCT = {
    "external_id": "team",
    "name": "Team",
    "description": "Description",
    "recurring_interval": "month",
    "prices": [
        {
            "amount_type": "seat_based",
            "tax_behavior": "exclusive",
            "tiers": {
                "type": "volume",
                "tiers": [{"bound": None, "unit_amount": "1000.0"}],
            },
        }
    ],
}


METERED_TIERS_PRICE = {
    "amount_type": "metered_tiers",
    "meter": "sdk-tool-calls",
    "tiers": {
        "type": "graduated",
        "tiers": [
            {"bound": 1000, "unit_amount": "0"},
            {"bound": None, "unit_amount": "0.5"},
        ],
    },
}


USAGE_PRODUCT = {
    "external_id": "usage",
    "name": "Usage",
    "description": "Description",
    "recurring_interval": "month",
    "prices": [METERED_TIERS_PRICE],
}


UNIT_BASED_PRICE = {
    "amount_type": "unit_based",
    "tax_behavior": "exclusive",
    "tiers": {
        "type": "graduated",
        "tiers": [
            {"bound": 10, "unit_amount": "1000"},
            {"bound": None, "unit_amount": "800"},
        ],
    },
}


DEVICES_PRODUCT = {
    "external_id": "devices",
    "name": "Devices",
    "description": "Description",
    "recurring_interval": "month",
    "prices": [UNIT_BASED_PRICE],
}


ORDERS_WEBHOOK = {
    "external_id": "orders",
    "url": "https://example.com/webhook",
    "format": "raw",
    "events": ["order.created", "order.paid"],
    "api_version": str(CURRENT_API_VERSION),
}


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
class TestApply:
    async def test_not_enabled(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        with pytest.raises(ConfigAsCodeNotEnabled):
            await declarative_config_service.apply(
                session, redis, auth_subject, Config.model_validate({"meters": []})
            )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_create(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"meters": [TOOL_CALLS_METER]}),
        )

        assert result.changes[0].action == ConfigAction.created
        [meter] = await MeterRepository.from_session(session).get_all_by_external_ids(
            organization.id, ["sdk-tool-calls"]
        )
        assert meter.name == "SDK - Tool Calls"
        assert meter.unit == MeterUnit.custom
        assert meter.custom_label == "call"
        assert enqueue_job_mock.call_args_list == [
            mocker.call("reducer.invalidate_cache", organization.id),
            mocker.call("meter.backfill_events", meter.id),
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_create_deprecated(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {"meters": [{**TOOL_CALLS_METER, "deprecated": True}]}
            ),
        )

        assert result.changes[0].action == ConfigAction.created
        [meter] = await MeterRepository.from_session(session).get_all_by_external_ids(
            organization.id, ["sdk-tool-calls"]
        )
        assert meter.archived_at is None

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unchanged(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="my-meter"
        )
        enqueue_job_mock = mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"meters": [FIXTURE_METER]}),
        )

        assert result.changes[0].action == ConfigAction.unchanged
        enqueue_job_mock.assert_not_called()

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_update(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="sdk-tool-calls"
        )

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"meters": [TOOL_CALLS_METER]}),
        )

        assert result.changes[0].action == ConfigAction.updated
        assert meter.name == "SDK - Tool Calls"
        assert meter.unit == MeterUnit.custom
        assert meter.custom_label == "call"
        assert meter.filter.model_dump() == TOOL_CALLS_METER["filter"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_ignores_other_organization_meter(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization_second: Organization,
    ) -> None:
        other_meter = await create_meter(
            save_fixture, organization=organization_second, external_id="sdk-tool-calls"
        )
        mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"meters": [TOOL_CALLS_METER]}),
        )

        assert result.changes[0].action == ConfigAction.created
        assert other_meter.name == "My Meter"

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_aggregating_meter_aggregation_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )

        with pytest.raises(ConfigInvalid) as exc_info:
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate(
                    {
                        "meters": [
                            {
                                **FIXTURE_METER,
                                "aggregation": {"func": "sum", "property": "tokens"},
                            }
                        ]
                    }
                ),
            )

        [error] = exc_info.value.errors
        assert error.loc == ["body", "meters", 0, "aggregation"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_aggregating_meter_name_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        meter = await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"meters": [{**FIXTURE_METER, "name": "Renamed"}]}),
        )

        assert result.changes[0].action == ConfigAction.updated
        assert meter.name == "Renamed"

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_omitted_metadata_keeps_existing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            user_metadata={"team": "sdk"},
        )

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"meters": [FIXTURE_METER]}),
        )

        assert result.changes[0].action == ConfigAction.unchanged
        assert meter.user_metadata == {"team": "sdk"}

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_metadata_update(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            user_metadata={"team": "sdk"},
        )

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {"meters": [{**FIXTURE_METER, "metadata": {"team": "billing"}}]}
            ),
        )

        assert result.changes[0].action == ConfigAction.updated
        assert meter.user_metadata == {"team": "billing"}

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_concurrent_create(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="sdk-tool-calls"
        )
        mocker.patch(
            "polar.declarative_config.service.MeterRepository.get_all_by_external_ids",
            return_value=[],
        )
        mocker.patch("polar.meter.service.enqueue_job")

        with pytest.raises(ConfigMeterConflict):
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate({"meters": [TOOL_CALLS_METER]}),
            )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_create_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [TOOL_CALLS_METER],
                    "benefits": [CREDITS_BENEFIT, BETA_BENEFIT],
                }
            ),
        )

        assert [(change.resource, change.action) for change in result.changes] == [
            (ConfigResource.meter, ConfigAction.created),
            (ConfigResource.benefit, ConfigAction.created),
            (ConfigResource.benefit, ConfigAction.created),
        ]
        [meter] = await MeterRepository.from_session(session).get_all_by_external_ids(
            organization.id, ["sdk-tool-calls"]
        )
        benefits = {
            benefit.external_id: benefit
            for benefit in await BenefitRepository.from_session(
                session
            ).get_all_by_external_ids(organization.id, ["tool-call-credits", "beta"])
        }
        assert dict(benefits["tool-call-credits"].properties) == {
            "meter_id": str(meter.id),
            "units": 1000,
            "rollover": False,
        }
        assert benefits["beta"].type == BenefitType.feature_flag
        assert benefits["tool-call-credits"].visibility == Visibility.public
        assert benefits["beta"].visibility == Visibility.public

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_update_benefit(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")
        meter = await create_meter(
            save_fixture, organization=organization, external_id="sdk-tool-calls"
        )
        await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            description="1,000 tool calls",
            properties={"meter_id": str(meter.id), "units": 10, "rollover": False},
            external_id="tool-call-credits",
        )
        config = Config.model_validate(
            {"meters": [TOOL_CALLS_METER], "benefits": [CREDITS_BENEFIT]}
        )

        with pytest.raises(ConfigInvalid) as error:
            await declarative_config_service.apply(session, redis, auth_subject, config)

        [issue] = error.value.errors
        assert issue.type == ConfigIssueType.not_supported
        assert issue.loc == ["body", "benefits", 0]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_benefit_visibility(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        private = Config.model_validate(
            {"meters": [], "benefits": [{**BETA_BENEFIT, "visibility": "private"}]}
        )
        default = Config.model_validate({"meters": [], "benefits": [BETA_BENEFIT]})

        await declarative_config_service.apply(session, redis, auth_subject, private)
        [benefit] = await BenefitRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["beta"])
        assert benefit.visibility == Visibility.private

        plan = await declarative_config_service.plan(session, auth_subject, default)
        assert [
            (change.field, change.before, change.after)
            for change in plan.changes[0].diff
        ] == [("visibility", Visibility.private, Visibility.public)]
        assert [issue.type for issue in plan.issues] == [ConfigIssueType.not_supported]

        with pytest.raises(ConfigInvalid) as error:
            await declarative_config_service.apply(
                session, redis, auth_subject, default
            )

        [issue] = error.value.errors
        assert issue.type == ConfigIssueType.not_supported
        assert issue.loc == ["body", "benefits", 0]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_concurrent_benefit_create(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.feature_flag,
            properties={},
            external_id="beta",
        )
        mocker.patch(
            "polar.declarative_config.validation.BenefitRepository.get_all_by_external_ids",
            return_value=[],
        )

        with pytest.raises(ConfigBenefitConflict):
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate({"benefits": [BETA_BENEFIT]}),
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.benefits_write})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_meters_require_meters_scope(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        with pytest.raises(InsufficientScopeError):
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate({"meters": [TOOL_CALLS_METER]}),
            )

    @pytest.mark.parametrize("benefits", [[BETA_BENEFIT], []])
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_write})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_benefits_require_benefits_scope(
        self,
        benefits: list[dict[str, Any]],
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        with pytest.raises(InsufficientScopeError):
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate({"benefits": benefits}),
            )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_create_and_update_product(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")
        config = {
            "meters": [TOOL_CALLS_METER],
            "benefits": [CREDITS_BENEFIT, BETA_BENEFIT],
            "products": [{**PRO_PRODUCT, "description": "The Pro plan"}],
        }

        created = await declarative_config_service.apply(
            session, redis, auth_subject, Config.model_validate(config)
        )
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pro"])
        metered_price = product.prices[1]
        updated = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {
                    **config,
                    "products": [
                        {
                            **PRO_PRODUCT,
                            "name": "Pro Plus",
                            "prices": [
                                {"amount_type": "fixed", "price_amount": 3000},
                                PRO_PRODUCT["prices"][1],
                            ],
                            "benefits": ["beta"],
                        }
                    ],
                }
            ),
        )

        assert created.changes[3].action == ConfigAction.created
        assert updated.changes[3].action == ConfigAction.updated
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pro"])
        assert product.name == "Pro Plus"
        assert product.description is None
        assert [price.amount_type for price in product.prices] == [
            ProductPriceAmountType.fixed,
            ProductPriceAmountType.metered_unit,
        ]
        assert product.prices[1].id != metered_price.id
        assert [benefit.description for benefit in product.benefits] == ["Beta access"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_deprecated_product_not_created(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [TOOL_CALLS_METER],
                    "benefits": [CREDITS_BENEFIT, BETA_BENEFIT],
                    "products": [{**PRO_PRODUCT, "deprecated": True}],
                }
            ),
        )

        assert [change.resource for change in result.changes] == [
            ConfigResource.meter,
            ConfigResource.benefit,
            ConfigResource.benefit,
        ]
        assert (result.removed, result.catalog) == ([], None)
        assert (
            await ProductRepository.from_session(session).get_all_by_external_ids(
                organization.id, ["pro"]
            )
            == []
        )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_trial(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        product_config = {
            "external_id": "pro",
            "name": "Pro",
            "recurring_interval": "month",
            "trial_interval": "day",
            "trial_interval_count": 14,
            "prices": [{"amount_type": "fixed", "price_amount": 2000}],
        }

        config = Config.model_validate({"products": [product_config]})
        plan = await declarative_config_service.plan(session, auth_subject, config)
        assert [
            (field.field, field.after)
            for field in plan.changes[0].diff
            if field.field.startswith("trial_")
        ] == [
            ("trial_interval", TrialInterval.day),
            ("trial_interval_count", 14),
        ]

        created = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pro"])
        assert created.changes[0].action == ConfigAction.created
        assert product.trial_interval == TrialInterval.day
        assert product.trial_interval_count == 14

        updated = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {"products": [{**product_config, "trial_interval_count": 7}]}
            ),
        )
        assert updated.changes[0].action == ConfigAction.updated
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pro"])
        assert product.trial_interval == TrialInterval.day
        assert product.trial_interval_count == 7

        cleared = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {
                    "products": [
                        {
                            "external_id": "pro",
                            "name": "Pro",
                            "recurring_interval": "month",
                            "prices": [{"amount_type": "fixed", "price_amount": 2000}],
                        }
                    ]
                }
            ),
        )
        assert cleared.changes[0].action == ConfigAction.updated
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pro"])
        assert product.trial_interval is None
        assert product.trial_interval_count is None

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unchanged_product_requires_products_manage(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        user_organization.role = OrganizationRole.finance
        await save_fixture(user_organization)
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="pack",
        )
        config = Config.model_validate(
            {
                "organization_id": str(organization.id),
                "products": [
                    {
                        "external_id": "pack",
                        "name": "Product",
                        "description": "Description",
                        "prices": [{"amount_type": "fixed", "price_amount": 1000}],
                    }
                ],
            }
        )

        plan = await declarative_config_service.plan(session, auth_subject, config)
        assert plan.changes[0].action == ConfigAction.unchanged
        with pytest.raises(NotPermitted):
            await declarative_config_service.apply(session, redis, auth_subject, config)

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_concurrent_product_create(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="pack",
        )
        mocker.patch(
            "polar.declarative_config.validation.ProductRepository.get_all_by_external_ids",
            return_value=[],
        )

        with pytest.raises(ConfigProductConflict):
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate(
                    {
                        "products": [
                            {
                                "external_id": "pack",
                                "name": "Pack",
                                "prices": [{"amount_type": "fixed", "price_amount": 0}],
                            }
                        ]
                    }
                ),
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.meters_write, Scope.benefits_write}
        )
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_products_require_products_scope(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        with pytest.raises(InsufficientScopeError):
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate({"products": [PRO_PRODUCT]}),
            )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_validation_error_location(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")
        metered_price = PRO_PRODUCT["prices"][1]

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate(
                    {
                        "meters": [TOOL_CALLS_METER],
                        "products": [
                            {
                                **PRO_PRODUCT,
                                "prices": [metered_price, metered_price],
                                "benefits": [],
                            }
                        ],
                    }
                ),
            )

        [error] = exc_info.value.errors()
        assert error["loc"] == ("body", "products", 0, "prices", 1, "meter")
        assert error["input"] == "sdk-tool-calls"

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_create_and_update_metered_tiers_price(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")
        config = {"meters": [TOOL_CALLS_METER], "products": [USAGE_PRODUCT]}

        await declarative_config_service.apply(
            session, redis, auth_subject, Config.model_validate(config)
        )
        [meter] = await MeterRepository.from_session(session).get_all_by_external_ids(
            organization.id, ["sdk-tool-calls"]
        )
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["usage"])
        [price] = product.prices
        updated = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {**config, "products": [{**USAGE_PRODUCT, "name": "Usage Plus"}]}
            ),
        )

        assert isinstance(price, ProductPriceMeteredTiers)
        assert price.meter_id == meter.id
        assert updated.changes[1].action == ConfigAction.updated
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["usage"])
        assert product.name == "Usage Plus"
        assert [p.amount_type for p in product.prices] == [
            ProductPriceAmountType.metered_tiers
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_create_and_update_unit_based_price(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        config = {"products": [DEVICES_PRODUCT]}

        await declarative_config_service.apply(
            session, redis, auth_subject, Config.model_validate(config)
        )
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["devices"])
        [price] = product.prices
        updated = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {"products": [{**DEVICES_PRODUCT, "name": "Devices Plus"}]}
            ),
        )

        assert isinstance(price, ProductPriceUnit)
        assert price.get_minimum_purchasable_units() == 1
        assert updated.changes[0].action == ConfigAction.updated
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["devices"])
        assert product.name == "Devices Plus"
        assert [p.amount_type for p in product.prices] == [
            ProductPriceAmountType.unit_based
        ]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled", "user_organization")
    async def test_create_webhook(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        config = Config.model_validate(
            {
                "organization_id": str(organization.id),
                "webhooks": [{**ORDERS_WEBHOOK, "api_version": str(V2026_04)}],
            }
        )

        created = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )
        plan = await declarative_config_service.plan(session, auth_subject, config)
        reapplied = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )

        [created_change] = created.changes
        assert created_change.action == ConfigAction.created
        [endpoint] = await WebhookEndpointRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["orders"])
        assert endpoint.url == "https://example.com/webhook"
        assert endpoint.format == WebhookFormat.raw
        assert endpoint.events == ["order.created", "order.paid"]
        assert endpoint.api_version == V2026_04
        assert endpoint.secret.startswith("whsec_")
        assert [change.action for change in plan.changes] == [ConfigAction.unchanged]
        assert [change.action for change in reapplied.changes] == [
            ConfigAction.unchanged
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_update_webhook(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        endpoint = await create_webhook_endpoint(
            save_fixture,
            organization=organization,
            events=[WebhookEventType.order_created],
            external_id="orders",
        )

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {"webhooks": [{**ORDERS_WEBHOOK, "url": "https://example.com/polar"}]}
            ),
        )

        assert [change.action for change in result.changes] == [ConfigAction.updated]
        assert endpoint.url == "https://example.com/polar"
        assert endpoint.events == ["order.created", "order.paid"]
        assert endpoint.secret == "SECRET"

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_currency_with_new_products(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {
                    "settings": {"payments": {"currency": "eur"}},
                    "products": [
                        {
                            **PACK_PRODUCT,
                            "prices": [EUR_PACK_PRICE],
                        }
                    ],
                }
            ),
        )

        assert result.settings is not None
        assert result.settings.action == ConfigAction.updated
        assert organization.default_presentment_currency == "eur"
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pack"])
        assert [price.price_currency for price in product.prices] == ["eur"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_tax(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(1000, "eur")],
        )

        result = await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"settings": {"payments": {"tax": "exclusive"}}}),
        )

        assert result.settings is not None
        assert result.settings.action == ConfigAction.updated
        assert organization.default_tax_behavior == TaxBehaviorOption.exclusive

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_currency_switch(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Pack",
            external_id="pack",
        )

        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate(
                {
                    "settings": {"payments": {"currency": "eur"}},
                    "products": [{**PACK_PRODUCT, "prices": [EUR_PACK_PRICE]}],
                }
            ),
        )

        assert organization.default_presentment_currency == "eur"
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pack"])
        assert [price.price_currency for price in product.prices] == ["eur"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_currency_missing_on_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )

        with pytest.raises(ConfigInvalid) as exc_info:
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate({"settings": {"payments": {"currency": "eur"}}}),
            )

        [issue] = exc_info.value.errors
        assert issue.type == ConfigIssueType.missing_currency
        assert issue.loc == ["body", "settings", "payments", "currency"]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_write})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_require_organizations_scope(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        with pytest.raises(InsufficientScopeError):
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate({"settings": {"payments": {"currency": "eur"}}}),
            )

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_require_organization_manage(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)

        with pytest.raises(NotPermitted):
            await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate(
                    {
                        "organization_id": str(organization.id),
                        "settings": {"payments": {"currency": "usd"}},
                    }
                ),
            )


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
class TestPlan:
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_diff(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate({"settings": {"payments": {"currency": "eur"}}}),
        )

        assert plan.settings is not None
        assert plan.settings.action == ConfigAction.updated
        assert [change.model_dump() for change in plan.settings.diff] == [
            {"field": "payments.currency", "before": "usd", "after": "eur"}
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_tax_diff(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate({"settings": {"payments": {"tax": "inclusive"}}}),
        )

        assert plan.settings is not None
        assert [change.model_dump() for change in plan.settings.diff] == [
            {"field": "payments.tax", "before": "location", "after": "inclusive"}
        ]
        assert plan.issues == []

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_unchanged(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate({"settings": {"payments": {"currency": "usd"}}}),
        )

        assert plan.settings is not None
        assert plan.settings.action == ConfigAction.unchanged
        assert plan.settings.diff == []

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_settings_omitted(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"meters": []})
        )

        assert plan.settings is None

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_currency_change_warning(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "settings": {"payments": {"currency": "eur"}},
                    "products": [{**PACK_PRODUCT, "prices": [EUR_PACK_PRICE]}],
                }
            ),
        )

        assert [(issue.severity, issue.type, issue.loc) for issue in plan.issues] == [
            (
                ConfigIssueSeverity.warning,
                ConfigIssueType.currency_changed,
                ["body", "settings", "payments", "currency"],
            )
        ]
        assert plan.issues[0].msg == (
            "New checkouts will use EUR when the product has no price in the "
            "customer's local currency."
        )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_missing_new_currency(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "settings": {"payments": {"currency": "eur"}},
                    "products": [PACK_PRODUCT],
                }
            ),
        )

        [error] = [
            issue
            for issue in plan.issues
            if issue.severity == ConfigIssueSeverity.error
        ]
        assert error.type == ConfigIssueType.missing_currency
        assert error.loc == ["body", "products", 0, "prices"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unlisted_product_missing_new_currency(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Legacy",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate({"settings": {"payments": {"currency": "eur"}}}),
        )

        [error] = [
            issue
            for issue in plan.issues
            if issue.severity == ConfigIssueSeverity.error
        ]
        assert error.type == ConfigIssueType.missing_currency
        assert error.loc == ["body", "settings", "payments", "currency"]
        assert "Legacy" in error.msg

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_new_product_missing_default_currency(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {"products": [{**PACK_PRODUCT, "prices": [EUR_PACK_PRICE]}]}
            ),
        )

        [error] = plan.issues
        assert error.type == ConfigIssueType.missing_currency
        assert error.loc == ["body", "products", 0, "prices"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unchanged_product_missing_default_currency(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Pack",
            external_id="pack",
            prices=[(900, "eur")],
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "products": [
                        {
                            **PACK_PRODUCT,
                            "description": "Description",
                            "prices": [EUR_PACK_PRICE],
                        }
                    ]
                }
            ),
        )

        assert plan.changes[0].action == ConfigAction.unchanged
        assert plan.issues == []

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_read}),
        AuthSubjectFixture(subject="agent"),
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_webhooks_require_webhooks_scope(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization | Agent]
    ) -> None:
        with pytest.raises(InsufficientScopeError):
            await declarative_config_service.plan(
                session,
                auth_subject,
                Config.model_validate({"webhooks": [ORDERS_WEBHOOK]}),
            )

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_webhooks_require_organization_manage(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        user_organization.role = OrganizationRole.member
        await save_fixture(user_organization)
        config = {"organization_id": str(organization.id), "benefits": [BETA_BENEFIT]}

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate(config)
        )
        assert [change.action for change in plan.changes] == [ConfigAction.created]
        with pytest.raises(NotPermitted):
            await declarative_config_service.plan(
                session,
                auth_subject,
                Config.model_validate({**config, "webhooks": [ORDERS_WEBHOOK]}),
            )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_webhook_diff(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_webhook_endpoint(
            save_fixture,
            organization=organization,
            events=[WebhookEventType.order_created, WebhookEventType.order_paid],
            external_id="orders",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "webhooks": [
                        {
                            **ORDERS_WEBHOOK,
                            "url": "https://example.com/polar",
                            "format": "slack",
                            "events": ["order.paid", "order.refunded"],
                        },
                        {**ORDERS_WEBHOOK, "external_id": "refunds"},
                    ]
                }
            ),
        )

        assert [(change.external_id, change.action) for change in plan.changes] == [
            ("orders", ConfigAction.updated),
            ("refunds", ConfigAction.created),
        ]
        assert [
            (change.field, change.before, change.after)
            for change in plan.changes[0].diff
        ] == [
            ("url", "https://example.com/webhook", "https://example.com/polar"),
            ("format", WebhookFormat.raw, WebhookFormat.slack),
            (
                "events",
                ["order.created", "order.paid"],
                ["order.paid", "order.refunded"],
            ),
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_webhook_events_order_ignored(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_webhook_endpoint(
            save_fixture,
            organization=organization,
            events=[WebhookEventType.order_created, WebhookEventType.order_paid],
            external_id="orders",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "webhooks": [
                        {**ORDERS_WEBHOOK, "events": ["order.paid", "order.created"]}
                    ]
                }
            ),
        )

        assert [change.action for change in plan.changes] == [ConfigAction.unchanged]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_read})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_benefits_require_benefits_scope(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        with pytest.raises(InsufficientScopeError):
            await declarative_config_service.plan(
                session,
                auth_subject,
                Config.model_validate({"benefits": [BETA_BENEFIT]}),
            )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.meters_read, Scope.benefits_read}
        )
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_benefits_read_scope(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"benefits": [BETA_BENEFIT]})
        )

        [change] = plan.changes
        assert (change.resource, change.action) == (
            ConfigResource.benefit,
            ConfigAction.created,
        )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_benefit_diff(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="sdk-tool-calls"
        )
        await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            description="1,000 tool calls",
            properties={"meter_id": str(meter.id), "units": 10, "rollover": False},
            external_id="tool-call-credits",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {"meters": [TOOL_CALLS_METER], "benefits": [CREDITS_BENEFIT]}
            ),
        )

        [benefit_change] = [
            change
            for change in plan.changes
            if change.resource == ConfigResource.benefit
        ]
        assert benefit_change.action == ConfigAction.updated
        assert [
            (change.field, change.before, change.after)
            for change in benefit_change.diff
        ] == [
            (
                "properties",
                {"meter": "sdk-tool-calls", "units": 10, "rollover": False},
                {"meter": "sdk-tool-calls", "units": 1000, "rollover": False},
            )
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_benefit_type_changed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.feature_flag,
            properties={},
            external_id="beta",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {"benefits": [{**CREDITS_BENEFIT, "external_id": "beta"}]}
            ),
        )

        assert [
            issue.loc
            for issue in plan.issues
            if issue.type == ConfigIssueType.type_changed
        ] == [["body", "benefits", 0, "type"]]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_new_resources(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [TOOL_CALLS_METER],
                    "benefits": [CREDITS_BENEFIT, BETA_BENEFIT],
                    "products": [PRO_PRODUCT],
                }
            ),
        )

        assert [
            (change.resource, change.external_id, change.action)
            for change in plan.changes
        ] == [
            (ConfigResource.meter, "sdk-tool-calls", ConfigAction.created),
            (ConfigResource.benefit, "tool-call-credits", ConfigAction.created),
            (ConfigResource.benefit, "beta", ConfigAction.created),
            (ConfigResource.product, "pro", ConfigAction.created),
        ]
        product_diff = {change.field: change.after for change in plan.changes[3].diff}
        assert product_diff["recurring_interval_count"] == 1
        assert product_diff["benefits"] == ["tool-call-credits", "beta"]
        assert [
            issue
            for issue in plan.issues
            if issue.severity == ConfigIssueSeverity.error
        ] == []

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_duplicate_product_benefit(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "benefits": [BETA_BENEFIT],
                    "products": [
                        {
                            "external_id": "pack",
                            "name": "Pack",
                            "prices": [{"amount_type": "fixed", "price_amount": 0}],
                            "benefits": ["beta", "beta"],
                        }
                    ],
                }
            ),
        )

        assert [
            issue.loc
            for issue in plan.issues
            if issue.type == ConfigIssueType.duplicate_external_id
        ] == [["body", "products", 0, "benefits", 1]]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_unsupported_prices(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(500, None, None, "usd")],
            external_id="team",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "products": [
                        {
                            "external_id": "team",
                            "name": "Team",
                            "recurring_interval": "month",
                            "prices": [{"amount_type": "fixed", "price_amount": 1000}],
                        }
                    ]
                }
            ),
        )

        assert [(issue.severity, issue.loc) for issue in plan.issues] == [
            (ConfigIssueSeverity.error, ["body", "products", 0, "prices"])
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_unsupported_prices_left_untouched(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1000, "usd"), (500, None, None, "usd")],
            external_id="team",
        )

        config = Config.model_validate(
            {
                "products": [
                    {
                        "external_id": "team",
                        "name": "Team",
                        "description": "Description",
                        "recurring_interval": "month",
                        "prices": [{"amount_type": "fixed", "price_amount": 1000}],
                    }
                ]
            }
        )

        plan = await declarative_config_service.plan(session, auth_subject, config)
        await declarative_config_service.apply(session, redis, auth_subject, config)

        assert [(issue.severity, issue.loc) for issue in plan.issues] == [
            (ConfigIssueSeverity.warning, ["body", "products", 0, "prices"])
        ]
        assert [change.field for change in plan.changes[0].diff] == ["name", "catalog"]
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["team"])
        assert product.name == "Team"
        assert [price.amount_type for price in product.prices] == [
            ProductPriceAmountType.fixed,
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_seat_based_price_unchanged(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            name="Team",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
            external_id="team",
        )

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"products": [TEAM_PRODUCT]})
        )

        assert plan.issues == []
        assert plan.changes[0].action == ConfigAction.unchanged

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_seat_based_price_changed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            name="Team",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
            external_id="team",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "products": [
                        {
                            **TEAM_PRODUCT,
                            "prices": [
                                {
                                    "amount_type": "seat_based",
                                    "tiers": {
                                        "type": "volume",
                                        "tiers": [{"bound": None, "unit_amount": 800}],
                                    },
                                }
                            ],
                        }
                    ]
                }
            ),
        )

        assert plan.changes[0].action == ConfigAction.updated
        assert [change.field for change in plan.changes[0].diff] == [
            "prices",
            "catalog",
        ]

    @pytest.mark.parametrize(
        "update",
        [
            pytest.param({"maximum_units": 5}, id="maximum_units"),
            pytest.param({"tiers": None}, id="no_tiers"),
        ],
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_seat_based_price_unsupported(
        self,
        update: dict[str, Any],
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Team",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
            external_id="team",
        )
        price = product.prices[0]
        for name, value in update.items():
            setattr(price, name, value)
        await save_fixture(price)

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"products": [TEAM_PRODUCT]})
        )

        assert [(issue.severity, issue.loc) for issue in plan.issues] == [
            (ConfigIssueSeverity.error, ["body", "products", 0, "prices"])
        ]

    @pytest.mark.parametrize(
        ("price", "action", "diff"),
        [
            pytest.param(UNIT_BASED_PRICE, ConfigAction.unchanged, [], id="unchanged"),
            pytest.param(
                {
                    **UNIT_BASED_PRICE,
                    "tiers": {
                        "type": "graduated",
                        "tiers": [
                            {"bound": 10, "unit_amount": "1000"},
                            {"bound": None, "unit_amount": "700"},
                        ],
                    },
                },
                ConfigAction.updated,
                ["prices", "catalog"],
                id="tier_rate",
            ),
            pytest.param(
                {**UNIT_BASED_PRICE, "minimum_units": 5},
                ConfigAction.updated,
                ["prices", "catalog"],
                id="minimum_units",
            ),
            pytest.param(
                {
                    **UNIT_BASED_PRICE,
                    "unit_label": {"en": {"=1": "device", "other": "devices"}},
                },
                ConfigAction.updated,
                ["prices", "catalog"],
                id="unit_label",
            ),
        ],
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_unit_based_price(
        self,
        price: dict[str, Any],
        action: ConfigAction,
        diff: list[str],
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Devices",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
            external_id="devices",
        )
        existing_price = await create_product_price_unit_based(
            save_fixture,
            product=product,
            tiers=Tiers.model_validate(UNIT_BASED_PRICE["tiers"]),
        )
        product.prices.append(existing_price)
        product.all_prices.append(existing_price)

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {"products": [{**DEVICES_PRODUCT, "prices": [price]}]}
            ),
        )

        assert plan.issues == []
        assert plan.changes[0].action == action
        assert [change.field for change in plan.changes[0].diff] == diff

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_unit_based_price_unsupported(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Devices",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
            external_id="devices",
        )
        existing_price = await create_product_price_unit_based(
            save_fixture,
            product=product,
            tiers=Tiers.model_validate(UNIT_BASED_PRICE["tiers"]),
        )
        existing_price.maximum_units = 5
        await save_fixture(existing_price)
        product.prices.append(existing_price)
        product.all_prices.append(existing_price)

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate({"products": [DEVICES_PRODUCT]}),
        )

        assert [(issue.severity, issue.loc) for issue in plan.issues] == [
            (ConfigIssueSeverity.error, ["body", "products", 0, "prices"])
        ]

    @pytest.mark.parametrize(
        ("price", "action", "diff"),
        [
            pytest.param(
                METERED_TIERS_PRICE, ConfigAction.unchanged, [], id="unchanged"
            ),
            pytest.param(
                {
                    **METERED_TIERS_PRICE,
                    "tiers": {
                        "type": "graduated",
                        "tiers": [
                            {"bound": 1000, "unit_amount": "0"},
                            {"bound": None, "unit_amount": "0.4"},
                        ],
                    },
                },
                ConfigAction.updated,
                ["prices", "catalog"],
                id="tier_rate",
            ),
        ],
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_metered_tiers_price(
        self,
        price: dict[str, Any],
        action: ConfigAction,
        diff: list[str],
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="sdk-tool-calls"
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            name="Usage",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
            external_id="usage",
        )
        existing_price = await create_product_price_metered_tiers(
            save_fixture,
            product=product,
            meter=meter,
            tiers=Tiers.model_validate(METERED_TIERS_PRICE["tiers"]),
        )
        product.prices.append(existing_price)
        product.all_prices.append(existing_price)

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [TOOL_CALLS_METER],
                    "products": [{**USAGE_PRODUCT, "prices": [price]}],
                }
            ),
        )

        assert [issue for issue in plan.issues if issue.loc[1] == "products"] == []
        [product_change] = [
            change
            for change in plan.changes
            if change.resource == ConfigResource.product
        ]
        assert product_change.action == action
        assert [change.field for change in product_change.diff] == diff

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_metered_price_on_unlisted_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(save_fixture, organization=organization)
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(meter, Decimal(1), None, "usd")],
            external_id="pro",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "products": [
                        {
                            **PRO_PRODUCT,
                            "prices": [{"amount_type": "fixed", "price_amount": 0}],
                            "benefits": [],
                        }
                    ]
                }
            ),
        )

        assert [
            issue.loc
            for issue in plan.issues
            if issue.type == ConfigIssueType.not_supported
        ] == [["body", "products", 0, "prices"]]

    @pytest.mark.parametrize(
        ("interval", "field"),
        [
            ({}, "recurring_interval"),
            (
                {"recurring_interval": "month", "recurring_interval_count": 3},
                "recurring_interval_count",
            ),
        ],
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_interval_changed(
        self,
        interval: dict[str, Any],
        field: str,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "products": [
                        {
                            "external_id": "pro",
                            "name": "Pro",
                            "prices": [{"amount_type": "fixed", "price_amount": 1000}],
                            **interval,
                        }
                    ]
                }
            ),
        )

        assert [
            issue.loc
            for issue in plan.issues
            if issue.type == ConfigIssueType.interval_changed
        ] == [["body", "products", 0, field]]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_trial_changed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
            trial_interval=TrialInterval.day,
            trial_interval_count=14,
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "products": [
                        {
                            "external_id": "pro",
                            "name": "Product",
                            "description": "Description",
                            "recurring_interval": "month",
                            "trial_interval": "day",
                            "trial_interval_count": 7,
                            "prices": [{"amount_type": "fixed", "price_amount": 1000}],
                        }
                    ]
                }
            ),
        )

        [change] = plan.changes
        assert change.action == ConfigAction.updated
        assert [
            (field.field, field.before, field.after)
            for field in change.diff
            if field.field != "catalog"
        ] == [("trial_interval_count", 14, 7)]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_trial_unchanged(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
            trial_interval=TrialInterval.day,
            trial_interval_count=14,
        )

        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "products": [
                        {
                            "external_id": "pro",
                            "name": "Product",
                            "description": "Description",
                            "recurring_interval": "month",
                            "trial_interval": "day",
                            "trial_interval_count": 14,
                            "prices": [{"amount_type": "fixed", "price_amount": 1000}],
                        }
                    ]
                }
            ),
        )

        [change] = plan.changes
        assert change.action == ConfigAction.unchanged
        assert change.diff == []

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unknown_references(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [],
                    "benefits": [CREDITS_BENEFIT],
                    "products": [
                        {
                            **PRO_PRODUCT,
                            "prices": [*PRO_PRODUCT["prices"], METERED_TIERS_PRICE],
                        }
                    ],
                }
            ),
        )

        assert [
            (issue.loc, issue.input)
            for issue in plan.issues
            if issue.type == ConfigIssueType.unknown_reference
        ] == [
            (["body", "benefits", 0, "properties", "meter"], "sdk-tool-calls"),
            (["body", "products", 0, "prices", 1, "meter"], "sdk-tool-calls"),
            (["body", "products", 0, "prices", 2, "meter"], "sdk-tool-calls"),
            (["body", "products", 0, "benefits", 1], "beta"),
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_deprecated_references(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [{**TOOL_CALLS_METER, "deprecated": True}],
                    "benefits": [CREDITS_BENEFIT],
                    "products": [
                        {
                            **PRO_PRODUCT,
                            "prices": [*PRO_PRODUCT["prices"], METERED_TIERS_PRICE],
                        }
                    ],
                }
            ),
        )

        assert [
            (issue.loc, issue.input)
            for issue in plan.issues
            if issue.type == ConfigIssueType.deprecated_reference
        ] == [
            (["body", "benefits", 0, "properties", "meter"], "sdk-tool-calls"),
            (["body", "products", 0, "prices", 1, "meter"], "sdk-tool-calls"),
            (["body", "products", 0, "prices", 2, "meter"], "sdk-tool-calls"),
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_deprecated_benefit_references(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [{**TOOL_CALLS_METER, "deprecated": True}],
                    "benefits": [
                        {**CREDITS_BENEFIT, "deprecated": True},
                        {**BETA_BENEFIT, "deprecated": True},
                    ],
                    "products": [PRO_PRODUCT],
                }
            ),
        )

        assert [
            (issue.loc, issue.input)
            for issue in plan.issues
            if issue.type == ConfigIssueType.deprecated_reference
        ] == [
            (["body", "products", 0, "prices", 1, "meter"], "sdk-tool-calls"),
            (["body", "products", 0, "benefits", 0], "tool-call-credits"),
            (["body", "products", 0, "benefits", 1], "beta"),
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_deprecated_product_references(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [{**TOOL_CALLS_METER, "deprecated": True}],
                    "benefits": [
                        {**CREDITS_BENEFIT, "deprecated": True},
                        {**BETA_BENEFIT, "deprecated": True},
                    ],
                    "products": [{**PRO_PRODUCT, "deprecated": True}],
                }
            ),
        )

        assert [issue for issue in plan.issues if issue.severity == "error"] == []

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_duplicate_external_ids_per_resource(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "webhooks": [ORDERS_WEBHOOK, ORDERS_WEBHOOK],
                    "benefits": [BETA_BENEFIT, BETA_BENEFIT],
                    "products": [
                        {
                            "external_id": "beta",
                            "name": "Beta",
                            "prices": [{"amount_type": "fixed", "price_amount": 0}],
                        }
                    ],
                }
            ),
        )

        assert [
            issue.loc
            for issue in plan.issues
            if issue.type == ConfigIssueType.duplicate_external_id
        ] == [
            ["body", "webhooks", 1, "external_id"],
            ["body", "benefits", 1, "external_id"],
        ]


DEPRECATED_CONFIG = {
    "meters": [{**FIXTURE_METER, "external_id": "apples", "deprecated": True}],
    "benefits": [{**BETA_BENEFIT, "deprecated": True}],
    "products": [
        {
            "external_id": "legacy",
            "name": "Legacy",
            "recurring_interval": "month",
            "prices": [
                {"amount_type": "metered_unit", "meter": "apples", "unit_amount": "1"}
            ],
            "benefits": ["beta"],
            "deprecated": True,
        }
    ],
}


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
class TestPrune:
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unused(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        result = await declarative_config_service.prune(
            session, auth_subject, Config.model_validate(DEPRECATED_CONFIG)
        )

        assert [entry.model_dump() for entry in result.entries] == [
            {
                "resource": ConfigResource.meter,
                "external_id": "apples",
                "in_use": False,
                "referenced_by": [],
            },
            {
                "resource": ConfigResource.benefit,
                "external_id": "beta",
                "in_use": False,
                "referenced_by": [],
            },
            {
                "resource": ConfigResource.product,
                "external_id": "legacy",
                "in_use": False,
                "referenced_by": [],
            },
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.active, SubscriptionStatus.past_due]
    )
    async def test_kept_by_subscribed_product(
        self,
        status: SubscriptionStatus,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="apples"
        )
        beta = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.feature_flag,
            properties={},
            external_id="beta",
        )
        legacy = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="legacy",
        )
        await create_subscription(
            save_fixture,
            product=legacy,
            customer=customer,
            status=status,
        )
        await create_subscription(
            save_fixture,
            product=legacy,
            customer=customer_second,
            revoke=True,
        )
        await create_benefit_grant(save_fixture, customer, beta, granted=True)
        await create_benefit_grant(save_fixture, customer_second, beta, granted=False)

        result = await declarative_config_service.prune(
            session, auth_subject, Config.model_validate(DEPRECATED_CONFIG)
        )

        assert [
            (entry.external_id, entry.in_use, entry.referenced_by)
            for entry in result.entries
        ] == [
            ("apples", False, ["legacy"]),
            ("beta", True, ["legacy"]),
            ("legacy", True, []),
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.active, SubscriptionStatus.past_due]
    )
    async def test_meter_in_use_by_subscription(
        self,
        status: SubscriptionStatus,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="apples"
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=status,
        )
        await save_fixture(SubscriptionMeter(subscription=subscription, meter=meter))

        result = await declarative_config_service.prune(
            session,
            auth_subject,
            Config.model_validate({"meters": DEPRECATED_CONFIG["meters"]}),
        )

        assert [(entry.external_id, entry.in_use) for entry in result.entries] == [
            ("apples", True)
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_meter_in_use_by_credits(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="apples"
        )
        credits = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={"meter_id": str(meter.id), "units": 10, "rollover": False},
        )
        await create_benefit_grant(save_fixture, customer, credits, granted=True)

        result = await declarative_config_service.prune(
            session,
            auth_subject,
            Config.model_validate({"meters": DEPRECATED_CONFIG["meters"]}),
        )

        assert [(entry.external_id, entry.in_use) for entry in result.entries] == [
            ("apples", True)
        ]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.products_read})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_requires_section_scope(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        with pytest.raises(InsufficientScopeError):
            await declarative_config_service.prune(
                session,
                auth_subject,
                Config.model_validate({"meters": DEPRECATED_CONFIG["meters"]}),
            )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_active_entries_are_skipped(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        result = await declarative_config_service.prune(
            session,
            auth_subject,
            Config.model_validate(
                {"meters": [TOOL_CALLS_METER], "benefits": [BETA_BENEFIT]}
            ),
        )

        assert result.entries == []


MONTHLY_PRO = {
    "external_id": "pro",
    "name": "Pro",
    "recurring_interval": "month",
    "prices": [{"amount_type": "fixed", "price_amount": 2000}],
}
MONTHLY_PRO_25 = {
    **MONTHLY_PRO,
    "prices": [{"amount_type": "fixed", "price_amount": 2500}],
}


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
@pytest.mark.usefixtures("config_as_code_enabled")
class TestCatalogVersioning:
    async def test_catalog_name(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        unnamed = Config.model_validate({"products": [MONTHLY_PRO]})
        name_only = Config.model_validate(
            {"products": [MONTHLY_PRO], "catalog_name": "Ignored"}
        )
        named = Config.model_validate(
            {"products": [MONTHLY_PRO_25], "catalog_name": "Spring pricing"}
        )
        catalogs_repo = CatalogRepository.from_session(session)

        await declarative_config_service.apply(session, redis, auth_subject, unnamed)
        first = await catalogs_repo.get_live(organization.id)
        assert first is not None
        assert first.name == "v1"

        await declarative_config_service.apply(session, redis, auth_subject, name_only)
        assert await catalogs_repo.get_live(organization.id) == first
        assert first.name == "v1"

        plan = await declarative_config_service.plan(session, auth_subject, named)
        assert plan.catalog == ConfigCatalogPlan(
            before=ConfigCatalog(id=first.id, name="v1"), name="Spring pricing"
        )
        catalog_diff = plan.changes[0].diff[-1]
        assert (catalog_diff.field, catalog_diff.before, catalog_diff.after) == (
            "catalog",
            "v1",
            "Spring pricing",
        )

        result = await declarative_config_service.apply(
            session, redis, auth_subject, named
        )
        live = await catalogs_repo.get_live(organization.id)
        assert live is not None
        assert live.id != first.id
        assert live.name == "Spring pricing"
        assert result.catalog == ConfigCatalogChange(
            before=ConfigCatalog(id=first.id, name="v1"),
            after=ConfigCatalog(id=live.id, name="Spring pricing"),
        )

        await declarative_config_service.apply(session, redis, auth_subject, unnamed)
        third = await catalogs_repo.get_live(organization.id)
        assert third is not None
        assert third.name == "v3"

    async def test_lifecycle(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
    ) -> None:
        initial_config = Config.model_validate({"products": [MONTHLY_PRO]})
        updated_config = Config.model_validate({"products": [MONTHLY_PRO_25]})
        products_repo = ProductRepository.from_session(session)
        catalogs_repo = CatalogRepository.from_session(session)
        members_repo = CatalogProductRepository.from_session(session)

        create_plan = await declarative_config_service.plan(
            session, auth_subject, initial_config
        )
        assert create_plan.catalog == ConfigCatalogPlan(before=None, name="v1")
        created_catalog = create_plan.changes[0].diff[-1]
        assert (created_catalog.field, created_catalog.before) == ("catalog", None)

        created = await declarative_config_service.apply(
            session, redis, auth_subject, initial_config
        )
        [old_product] = await products_repo.get_all_by_external_ids(
            organization.id, ["pro"]
        )
        first = await catalogs_repo.get_live(organization.id)
        assert first is not None
        assert first.version_hash is not None
        assert (len(first.version_hash), old_product.catalog_id) == (64, first.id)
        assert created.catalog == ConfigCatalogChange(
            before=None, after=ConfigCatalog(id=first.id, name="v1")
        )
        assert [
            m.product_id for m in await members_repo.get_all_by_catalog(first.id)
        ] == [old_product.id]

        unchanged = await declarative_config_service.apply(
            session, redis, auth_subject, initial_config
        )
        assert unchanged.changes[0].action == ConfigAction.unchanged
        assert unchanged.catalog is None
        assert (await catalogs_repo.get_live(organization.id)) == first

        subscription = await create_active_subscription(
            save_fixture, product=old_product, customer=customer
        )
        checkout_link = await create_checkout_link(save_fixture, products=[old_product])
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=1000,
            duration=DiscountDuration.once,
            organization=organization,
            products=[old_product],
        )

        update_plan = await declarative_config_service.plan(
            session, auth_subject, updated_config
        )
        catalog_diff = update_plan.changes[0].diff[-1]
        assert (catalog_diff.field, catalog_diff.before, catalog_diff.after) == (
            "catalog",
            "v1",
            "v2",
        )
        assert update_plan.catalog == ConfigCatalogPlan(
            before=ConfigCatalog(id=first.id, name="v1"), name="v2"
        )

        updated = await declarative_config_service.apply(
            session, redis, auth_subject, updated_config
        )
        [new_product] = await products_repo.get_all_by_external_ids(
            organization.id, ["pro"]
        )
        assert new_product.id != old_product.id
        assert isinstance(new_product.prices[0], ProductPriceFixed)
        assert new_product.prices[0].price_amount == 2500

        await session.refresh(old_product)
        assert (old_product.is_current, old_product.is_archived) == (False, False)
        assert isinstance(old_product.prices[0], ProductPriceFixed)
        assert old_product.prices[0].price_amount == 2000

        live = await catalogs_repo.get_live(organization.id)
        assert live is not None
        assert live.id != first.id
        assert live.version_hash not in (None, first.version_hash)
        assert new_product.catalog_id == live.id
        assert updated.catalog == ConfigCatalogChange(
            before=ConfigCatalog(id=first.id, name="v1"),
            after=ConfigCatalog(id=live.id, name="v2"),
        )
        assert [
            m.product_id for m in await members_repo.get_all_by_catalog(live.id)
        ] == [new_product.id]

        await session.refresh(subscription)
        assert subscription.product_id == old_product.id
        await session.refresh(checkout_link, ["checkout_link_products"])
        assert [p.product_id for p in checkout_link.checkout_link_products] == [
            new_product.id
        ]
        await session.refresh(discount, ["discount_products"])
        assert {p.product_id for p in discount.discount_products} == {
            old_product.id,
            new_product.id,
        }

    async def test_baseline_from_existing_products(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        existing = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
            name="Pro",
            is_tax_applicable=False,
        )
        config = Config.model_validate({"products": [MONTHLY_PRO_25]})

        plan = await declarative_config_service.plan(session, auth_subject, config)
        assert plan.catalog == ConfigCatalogPlan(before=None, name="v2")
        assert plan.changes[0].diff[-1].field == "catalog"

        result = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )

        repository = CatalogRepository.from_session(session)
        live = await repository.get_live(organization.id)
        assert live is not None
        [new_product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pro"])
        assert (new_product.catalog_id, new_product.is_tax_applicable) == (
            live.id,
            False,
        )
        await session.refresh(existing)
        assert existing.is_current is False
        assert existing.catalog_id is not None
        assert existing.catalog_id != live.id
        assert result.catalog == ConfigCatalogChange(
            before=ConfigCatalog(id=existing.catalog_id, name="v1"),
            after=ConfigCatalog(id=live.id, name="v2"),
        )
        assert (await repository.get_version_hashes([existing.catalog_id])) == {
            existing.catalog_id: compute_version_hash(None, {"pro": str(existing.id)})
        }

    async def test_reapply_older_config_takes_next_number(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        initial_config = Config.model_validate({"products": [MONTHLY_PRO]})
        updated_config = Config.model_validate({"products": [MONTHLY_PRO_25]})
        catalogs_repo = CatalogRepository.from_session(session)

        await declarative_config_service.apply(
            session, redis, auth_subject, initial_config
        )
        first = await catalogs_repo.get_live(organization.id)
        assert first is not None
        await declarative_config_service.apply(
            session, redis, auth_subject, updated_config
        )
        await catalogs_repo.soft_delete(first)

        result = await declarative_config_service.apply(
            session, redis, auth_subject, initial_config
        )

        live = await catalogs_repo.get_live(organization.id)
        assert live is not None
        assert live.version_hash != first.version_hash
        assert result.catalog is not None
        assert result.catalog.after == ConfigCatalog(id=live.id, name="v3")

    async def test_archived_product_stays_archived(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
            name="Pro",
            is_archived=True,
        )

        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO_25]}),
        )

        [new_product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pro"])
        assert new_product.is_archived is True
        assert isinstance(new_product.prices[0], ProductPriceFixed)
        assert new_product.prices[0].price_amount == 2500
        assert (
            await CatalogRepository.from_session(session).get_live(organization.id)
            is None
        )


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
@pytest.mark.usefixtures("config_as_code_enabled")
class TestProductRemoval:
    async def test_unlisted_product_without_subscriptions(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO, PACK_PRODUCT]}),
        )
        products_repo = ProductRepository.from_session(session)
        [pack] = await products_repo.get_all_by_external_ids(organization.id, ["pack"])
        config = Config.model_validate({"products": [MONTHLY_PRO]})

        plan = await declarative_config_service.plan(session, auth_subject, config)
        assert [change.external_id for change in plan.changes] == ["pro"]
        assert plan.removed == [
            ConfigRemoval(
                resource=ConfigResource.product,
                external_id="pack",
                reason=ConfigRemovalReason.missing,
            )
        ]
        assert plan.issues == []
        assert plan.catalog is not None

        result = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )
        assert result.removed == plan.removed
        await session.refresh(pack)
        assert pack.is_current is False
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        assert live is not None
        assert result.catalog is not None
        assert (result.catalog.after.id, live.name) == (live.id, plan.catalog.name)
        [pro] = await products_repo.get_all_by_external_ids(organization.id, ["pro"])
        members = await CatalogProductRepository.from_session(
            session
        ).get_all_by_catalog(live.id)
        assert [member.product_id for member in members] == [pro.id]

        again = await declarative_config_service.plan(session, auth_subject, config)
        assert (again.removed, again.catalog) == ([], None)

    async def test_products_section_omitted(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO]}),
        )

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"meters": []})
        )

        assert (plan.removed, plan.catalog) == ([], None)

    async def test_unlisted_product_with_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
    ) -> None:
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO, PACK_PRODUCT]}),
        )
        [old_pro] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["pro"])
        await create_active_subscription(
            save_fixture, product=old_pro, customer=customer
        )
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO_25, PACK_PRODUCT]}),
        )
        config = Config.model_validate({"products": [PACK_PRODUCT]})

        plan = await declarative_config_service.plan(session, auth_subject, config)

        [issue] = plan.issues
        assert (issue.severity, issue.type, issue.loc, issue.input) == (
            ConfigIssueSeverity.error,
            ConfigIssueType.removed_in_use,
            ["body", "products"],
            "pro",
        )
        assert (plan.removed, plan.catalog) == ([], None)
        with pytest.raises(ConfigInvalid) as e:
            await declarative_config_service.apply(session, redis, auth_subject, config)
        assert e.value.errors == [issue]

    async def test_unlisted_product_with_scheduled_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
    ) -> None:
        team = {**MONTHLY_PRO, "external_id": "team", "name": "Team"}
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO, team]}),
        )
        products_repo = ProductRepository.from_session(session)
        [pro] = await products_repo.get_all_by_external_ids(organization.id, ["pro"])
        [team_product] = await products_repo.get_all_by_external_ids(
            organization.id, ["team"]
        )
        subscription = await create_active_subscription(
            save_fixture, product=pro, customer=customer
        )
        await save_fixture(
            SubscriptionUpdate(
                subscription=subscription,
                product=team_product,
                proration_behavior=SubscriptionProrationBehavior.next_period,
                applies_at=utc_now(),
            )
        )

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"products": [MONTHLY_PRO]})
        )

        assert [(issue.type, issue.input) for issue in plan.issues] == [
            (ConfigIssueType.removed_in_use, "team")
        ]

    async def test_unlisted_archived_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO, PACK_PRODUCT]}),
        )
        [pack] = await ProductRepository.from_session(session).get_all_by_external_ids(
            organization.id, ["pack"]
        )
        pack.is_archived = True
        await save_fixture(pack)

        plan = await declarative_config_service.plan(
            session, auth_subject, Config.model_validate({"products": [MONTHLY_PRO]})
        )

        assert (plan.removed, plan.issues, plan.catalog) == ([], [], None)

    async def test_deprecated_product_with_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        customer: Customer,
    ) -> None:
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO, PACK_PRODUCT]}),
        )
        [pro] = await ProductRepository.from_session(session).get_all_by_external_ids(
            organization.id, ["pro"]
        )
        subscription = await create_active_subscription(
            save_fixture, product=pro, customer=customer
        )
        config = Config.model_validate(
            {"products": [{**MONTHLY_PRO_25, "deprecated": True}, PACK_PRODUCT]}
        )

        result = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )

        assert [change.external_id for change in result.changes] == ["pack"]
        assert result.removed == [
            ConfigRemoval(
                resource=ConfigResource.product,
                external_id="pro",
                reason=ConfigRemovalReason.deprecated,
            )
        ]
        assert result.catalog is not None
        await session.refresh(pro)
        assert (pro.is_current, pro.is_archived) == (False, False)
        assert isinstance(pro.prices[0], ProductPriceFixed)
        assert pro.prices[0].price_amount == 2000
        await session.refresh(subscription)
        assert subscription.product_id == pro.id

        again = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )
        assert (again.removed, again.catalog) == ([], None)


ROUND_TRIP_CONFIG: dict[str, Any] = {
    "settings": {"payments": {"currency": "usd", "tax": "inclusive"}},
    "meters": [{**TOOL_CALLS_METER, "metadata": {"team": "billing"}}],
    "benefits": [
        {
            **CREDITS_BENEFIT,
            "properties": {"meter": "sdk-tool-calls", "units": 1000, "rollover": True},
        },
        {**BETA_BENEFIT, "visibility": "private", "metadata": {"tier": 1}},
    ],
    "products": [
        {
            **PRO_PRODUCT,
            "description": "The Pro plan",
            "visibility": "private",
            "recurring_interval_count": 3,
            "trial_interval": "day",
            "trial_interval_count": 14,
            "prices": [
                {"amount_type": "fixed", "price_amount": 2000},
                {
                    "amount_type": "metered_unit",
                    "meter": "sdk-tool-calls",
                    "unit_amount": "0.5",
                    "cap_amount": 10000,
                },
            ],
            "metadata": {"plan": "pro"},
        },
        TEAM_PRODUCT,
        USAGE_PRODUCT,
        {
            "external_id": "devices",
            "name": "Devices",
            "recurring_interval": "month",
            "prices": [
                {
                    **UNIT_BASED_PRICE,
                    "minimum_units": 2,
                    "unit_label": {"en": {"=1": "device", "other": "devices"}},
                }
            ],
        },
        {
            "external_id": "lifetime",
            "name": "Lifetime",
            "prices": [{"amount_type": "fixed", "price_amount": 0}],
            "benefits": ["beta"],
        },
    ],
}


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
class TestExport:
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_round_trips_through_apply(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")
        await declarative_config_service.apply(
            session, redis, auth_subject, Config.model_validate(ROUND_TRIP_CONFIG)
        )

        exported = await declarative_config_service.export(session, auth_subject, None)
        config = Config.model_validate(exported.config.model_dump(mode="json"))
        plan = await declarative_config_service.plan(session, auth_subject, config)
        applied = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )
        again = await declarative_config_service.export(session, auth_subject, None)

        assert set(ROUND_TRIP_CONFIG) == set(ConfigExportDocument.model_fields)
        assert set(ConfigExportDocument.model_fields) == set(Config.model_fields) - {
            "organization_id",
            "webhooks",
            "catalog_name",
        }
        assert {type(benefit) for benefit in config.benefits} == set(
            get_args(get_args(ConfigBenefit)[0])
        )
        assert {
            type(price) for product in config.products for price in product.prices
        } == set(get_args(get_args(ConfigProductPrice)[0]))
        assert exported.skipped == []
        assert config == Config.model_validate(ROUND_TRIP_CONFIG)
        assert [
            issue
            for issue in plan.issues
            if issue.type != ConfigIssueType.unknown_event
        ] == []
        assert {change.action for change in plan.changes} == {ConfigAction.unchanged}
        assert plan.settings is not None
        assert plan.settings.action == ConfigAction.unchanged
        assert {change.action for change in applied.changes} == {ConfigAction.unchanged}
        assert again.config == exported.config

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_exports_only_current_versions(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO]}),
        )
        await declarative_config_service.apply(
            session,
            redis,
            auth_subject,
            Config.model_validate({"products": [MONTHLY_PRO_25]}),
        )

        exported = await declarative_config_service.export(session, auth_subject, None)
        config = Config.model_validate(exported.config.model_dump(mode="json"))
        plan = await declarative_config_service.plan(session, auth_subject, config)

        [product] = exported.config.products
        assert product.external_id == "pro"
        assert isinstance(product.prices[0], ConfigProductPriceFixedRead)
        assert product.prices[0].price_amount == 2500
        assert plan.issues == []
        assert {change.action for change in plan.changes} == {ConfigAction.unchanged}

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_skips_what_config_cannot_express(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        unlisted_meter = await create_meter(save_fixture, organization=organization)
        credits = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={
                "meter_id": str(unlisted_meter.id),
                "units": 10,
                "rollover": False,
            },
            external_id="credits",
        )
        custom_price = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(500, None, None, "usd")],
            external_id="pay-what-you-want",
        )
        archived = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            is_archived=True,
            external_id="archived",
        )
        separate_cycle = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            meter_interval=SubscriptionRecurringInterval.month,
            external_id="separate-cycle",
        )

        exported = await declarative_config_service.export(session, auth_subject, None)

        assert exported.config.meters == []
        assert exported.config.benefits == []
        assert exported.config.products == []
        assert [(skip.id, skip.reason) for skip in exported.skipped] == [
            (unlisted_meter.id, ConfigSkippedReason.missing_external_id),
            (credits.id, ConfigSkippedReason.invalid),
            (custom_price.id, ConfigSkippedReason.invalid),
            (archived.id, ConfigSkippedReason.archived),
            (separate_cycle.id, ConfigSkippedReason.invalid),
        ]

    @pytest.mark.auth(AuthSubjectFixture(subject="agent"))
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_agent(
        self, session: AsyncSession, auth_subject: AuthSubject[Agent]
    ) -> None:
        exported = await declarative_config_service.export(session, auth_subject, None)

        assert exported.skipped == []

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization", scopes={Scope.meters_read, Scope.benefits_read}
        )
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_requires_every_section_scope(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        with pytest.raises(InsufficientScopeError):
            await declarative_config_service.export(session, auth_subject, None)
