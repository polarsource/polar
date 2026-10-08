from decimal import Decimal
from typing import Any

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.benefit.repository import BenefitRepository
from polar.declarative_config.schemas import (
    Config,
    ConfigAction,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigResource,
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
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.kit.trial import TrialInterval
from polar.meter.repository import MeterRepository
from polar.meter.unit import MeterUnit
from polar.models import Organization, User, UserOrganization
from polar.models.benefit import BenefitType
from polar.models.product_price import ProductPriceAmountType
from polar.models.user_organization import OrganizationRole
from polar.oauth2.exceptions import InsufficientScopeError
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository
from polar.redis import Redis
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_benefit,
    create_event,
    create_meter,
    create_product,
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
        enqueue_job_mock.assert_called_once_with("meter.backfill_events", meter.id)

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
        benefit = await create_benefit(
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

        result = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )
        rerun = await declarative_config_service.apply(
            session, redis, auth_subject, config
        )

        assert result.changes[1].action == ConfigAction.updated
        assert dict(benefit.properties)["units"] == 1000
        assert rerun.changes[1].action == ConfigAction.unchanged

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
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_write})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_benefits_require_benefits_scope(
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
                Config.model_validate({"benefits": [BETA_BENEFIT]}),
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
        await session.refresh(product)
        assert product.name == "Pro Plus"
        assert product.description is None
        assert [price.amount_type for price in product.prices] == [
            ProductPriceAmountType.fixed,
            ProductPriceAmountType.metered_unit,
        ]
        assert product.prices[1].id == metered_price.id
        assert [benefit.description for benefit in product.benefits] == ["Beta access"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_product_trial(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        product_config = {
            "external_id": "team",
            "name": "Team",
            "recurring_interval": "month",
            "prices": [{"amount_type": "fixed", "price_amount": 1000}],
        }

        async def apply(**fields: Any) -> ConfigAction:
            result = await declarative_config_service.apply(
                session,
                redis,
                auth_subject,
                Config.model_validate({"products": [{**product_config, **fields}]}),
            )
            return result.changes[0].action

        trial = {"trial_interval": "day", "trial_interval_count": 7}
        assert await apply(**trial) == ConfigAction.created
        [product] = await ProductRepository.from_session(
            session
        ).get_all_by_external_ids(organization.id, ["team"])
        assert (product.trial_interval, product.trial_interval_count) == (
            TrialInterval.day,
            7,
        )

        assert await apply(**trial) == ConfigAction.unchanged
        assert await apply(**{**trial, "trial_interval_count": 14}) == (
            ConfigAction.updated
        )
        await session.refresh(product)
        assert product.trial_interval_count == 14

        assert await apply() == ConfigAction.updated
        await session.refresh(product)
        assert (product.trial_interval, product.trial_interval_count) == (None, None)

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


@pytest.mark.anyio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
class TestPlan:
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

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_read})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_empty_sections_need_no_scope(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate({"benefits": [], "products": []}),
        )

        assert plan.changes == []

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
            prices=[(1000, "usd"), ("seat", 500, "usd")],
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
        assert [change.field for change in plan.changes[0].diff] == ["name"]
        await session.refresh(product)
        assert product.name == "Team"
        assert [price.amount_type for price in product.prices] == [
            ProductPriceAmountType.fixed,
            ProductPriceAmountType.seat_based,
        ]

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
            (
                {"recurring_interval": "month", "meter_interval": "month"},
                "meter_interval",
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
    async def test_unknown_references(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {"meters": [], "benefits": [CREDITS_BENEFIT], "products": [PRO_PRODUCT]}
            ),
        )

        assert [
            (issue.loc, issue.input)
            for issue in plan.issues
            if issue.type == ConfigIssueType.unknown_reference
        ] == [
            (["body", "benefits", 0, "properties", "meter"], "sdk-tool-calls"),
            (["body", "products", 0, "prices", 1, "meter"], "sdk-tool-calls"),
            (["body", "products", 0, "benefits", 1], "beta"),
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_not_supported_yet(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "benefits": [
                        {**BETA_BENEFIT, "visibility": "private"},
                        {
                            "external_id": "support",
                            "type": "custom",
                            "description": "Priority support",
                        },
                    ],
                    "products": [
                        {
                            "external_id": "team",
                            "name": "Team",
                            "recurring_interval": "month",
                            "trial_interval": "day",
                            "trial_interval_count": 14,
                            "custom_fields": [{"slug": "company"}],
                            "prices": [
                                {"amount_type": "fixed", "price_amount": 1000},
                                {"amount_type": "custom", "minimum_amount": 500},
                            ],
                        }
                    ],
                }
            ),
        )

        assert [
            issue.loc
            for issue in plan.issues
            if issue.type == ConfigIssueType.not_supported
        ] == [
            ["body", "benefits", 0, "visibility"],
            ["body", "benefits", 1, "type"],
            ["body", "products", 0, "custom_fields"],
            ["body", "products", 0, "prices", 1, "amount_type"],
        ]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_duplicate_external_ids_per_resource(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        plan = await declarative_config_service.plan(
            session,
            auth_subject,
            Config.model_validate(
                {
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
        ] == [["body", "benefits", 1, "external_id"]]
