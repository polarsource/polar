import uuid
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from polar_sdk.models import (
    BenefitGrant,
    CustomerIndividual,
    Order,
    Product,
    Subscription,
    SubscriptionProrationBehavior,
    WebhookBenefitGrantCreatedPayload,
    WebhookBenefitGrantRevokedPayload,
    WebhookBenefitGrantUpdatedPayload,
    WebhookOrderCreatedPayload,
    WebhookSubscriptionCanceledPayload,
    WebhookSubscriptionPastDuePayload,
    WebhookSubscriptionRevokedPayload,
)
from pytest_mock import MockerFixture

from polar.config import settings
from polar.integrations.polar.exceptions import (
    PolarSelfInvoiceNotReady,
    PolarSelfNoActiveSubscription,
    PolarSelfNotApproved,
    PolarSelfNotConfigured,
    PolarSelfNotPaidOrder,
    PolarSelfOrderNotFound,
    PolarSelfPlanNotFound,
    PolarSelfWebhookError,
    SupportBenefitError,
    TransactionFeeBenefitError,
)
from polar.integrations.polar.service import polar_self
from polar.models.organization import Organization, SupportTier
from polar.postgres import AsyncReadSession, AsyncSession

SELF_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
ORG_A = uuid.UUID("00000000-0000-0000-0000-00000000000a")

_CUSTOMER_DICT: dict[str, Any] = {
    "id": "00000000-0000-0000-0000-000000000002",
    "created_at": "2026-01-01T00:00:00Z",
    "modified_at": None,
    "metadata": {},
    "email": "c@example.com",
    "email_verified": True,
    "type": "individual",
    "name": "c",
    "billing_name": None,
    "billing_address": None,
    "tax_id": None,
    "organization_id": "00000000-0000-0000-0000-000000000099",
    "deleted_at": None,
    "avatar_url": "",
    "external_id": str(ORG_A),
}

_BENEFIT_ID = "00000000-0000-0000-0000-0000000000b1"
_PREVIEW_FLAGS_ENABLED = {
    "reset_proration_behavior_enabled": True,
    "off_session_charges_enabled": True,
    "slack_benefit_enabled": True,
    "preview_access_enabled": True,
}
_PREVIEW_FLAGS_DISABLED = {flag: False for flag in _PREVIEW_FLAGS_ENABLED}
_CUSTOMER_ID = _CUSTOMER_DICT["id"]


def _customer_dict(external_id: object) -> dict[str, Any]:
    customer = {**_CUSTOMER_DICT}
    if external_id is None:
        customer.pop("external_id", None)
    else:
        customer["external_id"] = external_id
    return customer


def _make_customer(*, external_id: object = str(ORG_A)) -> CustomerIndividual:
    return CustomerIndividual.model_validate(_customer_dict(external_id))


def _make_grant(
    *,
    benefit_id: str = _BENEFIT_ID,
    metadata: dict[str, Any] | None = None,
) -> BenefitGrant:
    return BenefitGrant.model_validate(
        {
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": None,
            "id": "00000000-0000-0000-0000-0000000000a1",
            "is_granted": True,
            "is_revoked": False,
            "subscription_id": "00000000-0000-0000-0000-000000000001",
            "order_id": None,
            "customer_id": _CUSTOMER_DICT["id"],
            "benefit_id": benefit_id,
            "customer": _CUSTOMER_DICT,
            "benefit": {
                "id": benefit_id,
                "type": "custom",
                "created_at": "2026-01-01T00:00:00Z",
                "modified_at": None,
                "description": "",
                "selectable": True,
                "deletable": True,
                "is_deleted": False,
                "visibility": "public",
                "visibility_configurable": True,
                "organization_id": _CUSTOMER_DICT["organization_id"],
                "metadata": metadata or {},
                "properties": {"note": None},
            },
            "properties": {},
        }
    )


def _make_fee_grant(
    *,
    benefit_id: str = _BENEFIT_ID,
    fee_percent: str = "380",
    fee_fixed: str = "35",
    subscription_fee_percent: str = "0",
) -> BenefitGrant:
    return _make_grant(
        benefit_id=benefit_id,
        metadata={
            "type": "transaction_fee",
            "fee_percent": fee_percent,
            "fee_fixed": fee_fixed,
            "subscription_fee_percent": subscription_fee_percent,
        },
    )


def _make_support_grant(
    *,
    benefit_id: str = _BENEFIT_ID,
    level: str = "2",
    slack: str = "true",
    prioritized: str = "true",
) -> BenefitGrant:
    return _make_grant(
        benefit_id=benefit_id,
        metadata={
            "type": "support",
            "level": level,
            "slack": slack,
            "prioritized": prioritized,
        },
    )


def _make_preview_grant(*, benefit_id: str = _BENEFIT_ID) -> BenefitGrant:
    return _make_grant(benefit_id=benefit_id, metadata={"type": "preview_access"})


def _make_payload(
    event_type: str,
    *,
    metadata: dict[str, Any] | None = None,
    external_id: object = str(ORG_A),
    benefit_id: str = _BENEFIT_ID,
) -> dict[str, Any]:
    return {
        "type": event_type,
        "timestamp": "2026-01-01T00:00:00Z",
        "data": {
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": None,
            "id": "00000000-0000-0000-0000-0000000000a1",
            "is_granted": event_type != "benefit_grant.revoked",
            "is_revoked": event_type == "benefit_grant.revoked",
            "subscription_id": "00000000-0000-0000-0000-000000000001",
            "order_id": None,
            "customer_id": _CUSTOMER_DICT["id"],
            "benefit_id": benefit_id,
            "customer": _customer_dict(external_id),
            "benefit": {
                "id": benefit_id,
                "type": "custom",
                "created_at": "2026-01-01T00:00:00Z",
                "modified_at": None,
                "description": "",
                "selectable": True,
                "deletable": True,
                "is_deleted": False,
                "visibility": "public",
                "visibility_configurable": True,
                "organization_id": _CUSTOMER_DICT["organization_id"],
                "metadata": metadata or {},
                "properties": {"note": None},
            },
            "properties": {},
        },
    }


@pytest.fixture
def configured(mocker: MockerFixture) -> None:
    settings = mocker.patch("polar.integrations.polar.service.settings")
    settings.POLAR_SELF_ENABLED = True
    settings.POLAR_ORGANIZATION_ID = str(SELF_ORG_ID)
    settings.POLAR_FREE_PRODUCT_ID = "prod_free"


@pytest.fixture
def session_mock() -> AsyncSession:
    return MagicMock(spec=AsyncSession)


@pytest.fixture
def read_session_mock() -> AsyncReadSession:
    return MagicMock(spec=AsyncReadSession)


@pytest.fixture
def organization_repository_mock(mocker: MockerFixture) -> MagicMock:
    repository = MagicMock()
    active_organization = MagicMock(spec=Organization)
    active_organization.is_active.return_value = True
    repository.get_by_id = AsyncMock(return_value=active_organization)
    mocker.patch(
        "polar.integrations.polar.service.OrganizationRepository.from_session",
        return_value=repository,
    )
    return repository


@pytest.fixture
def preview_access_org_repository_mock(mocker: MockerFixture) -> MagicMock:
    """Repository whose loaded organization carries a real feature_settings dict.

    ``organization_repository_mock`` returns a bare ``MagicMock`` whose
    ``feature_settings`` is itself a mock, which can't be dict-unpacked. The
    preview-access path reassigns that dict, so it needs a real one.
    """
    repository = MagicMock()
    organization = MagicMock(spec=Organization)
    organization.feature_settings = {}
    repository.get_by_id = AsyncMock(return_value=organization)
    mocker.patch(
        "polar.integrations.polar.service.OrganizationRepository.from_session",
        return_value=repository,
    )
    return repository


@pytest.fixture
def account_repository_mock(mocker: MockerFixture) -> MagicMock:
    repository = MagicMock()
    repository.get_by_organization = AsyncMock(return_value=MagicMock(id="acc_1"))
    mocker.patch(
        "polar.integrations.polar.service.AccountRepository.from_session",
        return_value=repository,
    )
    return repository


@pytest.fixture
def set_platform_fee_mock(mocker: MockerFixture) -> AsyncMock:
    mock = AsyncMock()
    mocker.patch("polar.account.service.account.set_platform_fee", mock)
    return mock


@pytest.fixture
def plain_update_tenant_tier_mock(mocker: MockerFixture) -> AsyncMock:
    mock = AsyncMock()
    mocker.patch(
        "polar.integrations.polar.service.plain_service.update_tenant_tier",
        mock,
    )
    return mock


@pytest.fixture
def list_grants_mock(mocker: MockerFixture) -> AsyncMock:
    client = MagicMock()
    client.list_customer_benefit_grants = AsyncMock(return_value=[])
    mocker.patch("polar.integrations.polar.service.get_client", return_value=client)
    return client.list_customer_benefit_grants


class TestEnqueueTrackOrganizationReviewUsage:
    def _call(
        self,
        *,
        external_customer_id: str = str(ORG_A),
        cost_usd: Decimal | float | None = Decimal("0.0123"),
    ) -> None:
        polar_self.enqueue_track_organization_review_usage(
            external_customer_id=external_customer_id,
            review_context="submission",
            vendor="openai",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            cost_usd=cost_usd,
        )

    def test_noop_when_not_configured(self, mocker: MockerFixture) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call()

        enqueue.assert_not_called()

    def test_noop_for_self_organization(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(external_customer_id=str(SELF_ORG_ID))

        enqueue.assert_not_called()

    def test_noop_when_cost_is_none(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(cost_usd=None)

        enqueue.assert_not_called()

    def test_noop_when_cost_is_zero(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(cost_usd=Decimal(0))

        enqueue.assert_not_called()

    def test_enqueues_job_with_serialized_cost(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(cost_usd=Decimal("0.0123"))

        enqueue.assert_called_once_with(
            "polar_self.track_organization_review_usage",
            external_customer_id=str(ORG_A),
            review_context="submission",
            vendor="openai",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            cost_usd="0.0123",
        )

    def test_accepts_float_cost(self, configured: None, mocker: MockerFixture) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(cost_usd=0.5)

        assert enqueue.call_count == 1
        assert enqueue.call_args.kwargs["cost_usd"] == "0.5"


@pytest.mark.asyncio
class TestResolveFreePlan:
    async def test_subscribed_org_gets_standard_free(
        self,
        read_session_mock: AsyncReadSession,
        account_repository_mock: MagicMock,
    ) -> None:
        subscription = MagicMock(spec=Subscription)

        plan = await polar_self.resolve_free_plan(
            read_session_mock, ORG_A, subscription=subscription
        )

        assert plan.name == "Free"
        assert plan.transaction_fee is not None
        assert plan.transaction_fee.percent == settings.PLATFORM_FEE_BASIS_POINTS
        assert plan.transaction_fee.fixed == settings.PLATFORM_FEE_FIXED
        account_repository_mock.get_by_organization.assert_not_called()

    async def test_grandfathered_account_gets_early_member(
        self,
        read_session_mock: AsyncReadSession,
        account_repository_mock: MagicMock,
    ) -> None:
        account = MagicMock()
        account.platform_fee = (
            settings.PLATFORM_FEE_BASIS_POINTS_EARLY_ACCESS,
            settings.PLATFORM_FEE_FIXED_EARLY_ACCESS,
            settings.PLATFORM_SUBSCRIPTION_FEE_BASIS_POINTS_EARLY_ACCESS,
        )
        account_repository_mock.get_by_organization.return_value = account

        plan = await polar_self.resolve_free_plan(
            read_session_mock, ORG_A, subscription=None
        )

        assert plan.name == "Early Member"
        assert plan.transaction_fee is not None
        assert (
            plan.transaction_fee.percent
            == settings.PLATFORM_FEE_BASIS_POINTS_EARLY_ACCESS
        )
        assert plan.transaction_fee.fixed == settings.PLATFORM_FEE_FIXED_EARLY_ACCESS

    async def test_non_matching_account_gets_standard_free(
        self,
        read_session_mock: AsyncReadSession,
        account_repository_mock: MagicMock,
    ) -> None:
        account = MagicMock()
        account.platform_fee = (
            settings.PLATFORM_FEE_BASIS_POINTS,
            settings.PLATFORM_FEE_FIXED,
            settings.PLATFORM_SUBSCRIPTION_FEE_BASIS_POINTS,
        )
        account_repository_mock.get_by_organization.return_value = account

        plan = await polar_self.resolve_free_plan(
            read_session_mock, ORG_A, subscription=None
        )

        assert plan.name == "Free"
        assert plan.transaction_fee is not None
        assert plan.transaction_fee.percent == settings.PLATFORM_FEE_BASIS_POINTS
        assert plan.transaction_fee.fixed == settings.PLATFORM_FEE_FIXED

    async def test_no_account_gets_standard_free(
        self,
        read_session_mock: AsyncReadSession,
        account_repository_mock: MagicMock,
    ) -> None:
        account_repository_mock.get_by_organization.return_value = None

        plan = await polar_self.resolve_free_plan(
            read_session_mock, ORG_A, subscription=None
        )

        assert plan.name == "Free"
        assert plan.transaction_fee is not None
        assert plan.transaction_fee.percent == settings.PLATFORM_FEE_BASIS_POINTS
        assert plan.transaction_fee.fixed == settings.PLATFORM_FEE_FIXED


class TestResolveOrganizationId:
    def test_valid_uuid(self) -> None:
        assert (
            polar_self._resolve_organization_id(_make_customer(external_id=str(ORG_A)))
            == ORG_A
        )

    def test_missing_external_id_raises(self) -> None:
        with pytest.raises(PolarSelfWebhookError, match="external_id"):
            polar_self._resolve_organization_id(_make_customer(external_id=None))

    def test_non_uuid_external_id_raises(self) -> None:
        with pytest.raises(PolarSelfWebhookError, match="not-a-uuid"):
            polar_self._resolve_organization_id(
                _make_customer(external_id="not-a-uuid")
            )


class TestExtractTransactionFee:
    def test_valid(self) -> None:
        assert polar_self._extract_transaction_fee(
            {"fee_percent": "380", "fee_fixed": "35", "subscription_fee_percent": "0"},
            _BENEFIT_ID,
        ) == (380, 35, 0)

    def test_native_int_values(self) -> None:
        assert polar_self._extract_transaction_fee(
            {"fee_percent": 380, "fee_fixed": 35, "subscription_fee_percent": 0},
            _BENEFIT_ID,
        ) == (380, 35, 0)

    def test_whole_float_values(self) -> None:
        assert polar_self._extract_transaction_fee(
            {"fee_percent": 380.0, "fee_fixed": 35.0, "subscription_fee_percent": 0.0},
            _BENEFIT_ID,
        ) == (380, 35, 0)

    @pytest.mark.parametrize(
        "metadata",
        [
            {"fee_fixed": "35"},
            {"fee_percent": "abc", "fee_fixed": "35"},
            {"fee_percent": True, "fee_fixed": "35"},
            {"fee_percent": 3.5, "fee_fixed": "35"},
        ],
    )
    def test_invalid_fee_percent_raises(self, metadata: dict[str, Any]) -> None:
        with pytest.raises(TransactionFeeBenefitError, match="fee_percent"):
            polar_self._extract_transaction_fee(metadata, _BENEFIT_ID)

    @pytest.mark.parametrize(
        "metadata",
        [
            {"fee_percent": "380"},
            {"fee_percent": "380", "fee_fixed": "abc"},
            {"fee_percent": "380", "fee_fixed": False},
            {"fee_percent": "380", "fee_fixed": 1.25},
        ],
    )
    def test_invalid_fee_fixed_raises(self, metadata: dict[str, Any]) -> None:
        with pytest.raises(TransactionFeeBenefitError, match="fee_fixed"):
            polar_self._extract_transaction_fee(metadata, _BENEFIT_ID)


class TestExtractSupport:
    def test_valid(self) -> None:
        assert polar_self._extract_support(
            {"level": "2", "slack": "true", "prioritized": "false"}, _BENEFIT_ID
        ) == (2, True, False, None)

    def test_native_typed_values(self) -> None:
        assert polar_self._extract_support(
            {"level": 2, "slack": True, "prioritized": False}, _BENEFIT_ID
        ) == (2, True, False, None)

    def test_whole_float_level(self) -> None:
        assert polar_self._extract_support(
            {"level": 2.0, "slack": True, "prioritized": False}, _BENEFIT_ID
        ) == (2, True, False, None)

    def test_plain_tier_external_id(self) -> None:
        assert polar_self._extract_support(
            {
                "level": "2",
                "slack": "true",
                "prioritized": "false",
                "plain_tier_external_id": "pro",
            },
            _BENEFIT_ID,
        ) == (2, True, False, "pro")

    @pytest.mark.parametrize(
        ("metadata", "match"),
        [
            ({"slack": "true", "prioritized": "true"}, "level"),
            ({"level": "abc", "slack": "true", "prioritized": "true"}, "level"),
            ({"level": True, "slack": "true", "prioritized": "true"}, "level"),
            ({"level": 1.5, "slack": "true", "prioritized": "true"}, "level"),
            ({"level": "1", "prioritized": "true"}, "slack"),
            ({"level": "1", "slack": "yes", "prioritized": "true"}, "slack"),
            ({"level": "1", "slack": 1, "prioritized": "true"}, "slack"),
            ({"level": "1", "slack": "true"}, "prioritized"),
            ({"level": "1", "slack": "true", "prioritized": "yes"}, "prioritized"),
            ({"level": "1", "slack": "true", "prioritized": 0}, "prioritized"),
            (
                {
                    "level": "1",
                    "slack": "true",
                    "prioritized": "true",
                    "plain_tier_external_id": 123,
                },
                "plain_tier_external_id",
            ),
            (
                {
                    "level": "1",
                    "slack": "true",
                    "prioritized": "true",
                    "plain_tier_external_id": 0,
                },
                "plain_tier_external_id",
            ),
            (
                {
                    "level": "1",
                    "slack": "true",
                    "prioritized": "true",
                    "plain_tier_external_id": False,
                },
                "plain_tier_external_id",
            ),
            (
                {
                    "level": "1",
                    "slack": "true",
                    "prioritized": "true",
                    "plain_tier_external_id": "",
                },
                "plain_tier_external_id",
            ),
        ],
    )
    def test_invalid_field_raises(self, metadata: dict[str, Any], match: str) -> None:
        with pytest.raises(SupportBenefitError, match=match):
            polar_self._extract_support(metadata, _BENEFIT_ID)


@pytest.mark.asyncio
class TestApplyTransactionFee:
    async def test_active_grant_applies_fees(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
    ) -> None:
        grant = _make_fee_grant()

        await polar_self._apply_transaction_fee(session_mock, ORG_A, grant)

        account_repository_mock.get_by_organization.assert_awaited_once_with(ORG_A)
        set_platform_fee_mock.assert_awaited_once()
        assert set_platform_fee_mock.await_args is not None
        assert set_platform_fee_mock.await_args.kwargs == {
            "fee_percent": 380,
            "fee_fixed": 35,
            "subscription_fee_percent": 0,
        }

    async def test_no_grant_resets_to_defaults(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
    ) -> None:
        await polar_self._apply_transaction_fee(session_mock, ORG_A, None)

        set_platform_fee_mock.assert_awaited_once()
        assert set_platform_fee_mock.await_args is not None
        assert set_platform_fee_mock.await_args.kwargs == {
            "fee_percent": settings.PLATFORM_FEE_BASIS_POINTS,
            "fee_fixed": settings.PLATFORM_FEE_FIXED,
            "subscription_fee_percent": settings.PLATFORM_SUBSCRIPTION_FEE_BASIS_POINTS,
        }

    async def test_no_account_is_silent_noop(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
    ) -> None:
        account_repository_mock.get_by_organization.return_value = None
        grant = _make_fee_grant()

        await polar_self._apply_transaction_fee(session_mock, ORG_A, grant)

        set_platform_fee_mock.assert_not_awaited()


@pytest.mark.asyncio
class TestApplySupport:
    async def test_active_grant(
        self,
        session_mock: AsyncSession,
        organization_repository_mock: MagicMock,
        plain_update_tenant_tier_mock: AsyncMock,
    ) -> None:
        grant = _make_support_grant()

        await polar_self._apply_support(session_mock, ORG_A, grant)

        plain_update_tenant_tier_mock.assert_awaited_once_with(
            tenant_external_id=str(ORG_A), tier_external_id=None
        )

        assert (
            organization_repository_mock.get_by_id.return_value.support_tier
            == SupportTier.pro
        )

    async def test_active_grant_with_plain_tier(
        self,
        session_mock: AsyncSession,
        organization_repository_mock: MagicMock,
        plain_update_tenant_tier_mock: AsyncMock,
    ) -> None:
        grant = _make_grant(
            metadata={
                "type": "support",
                "level": "2",
                "slack": "true",
                "prioritized": "true",
                "plain_tier_external_id": "pro",
            }
        )

        await polar_self._apply_support(session_mock, ORG_A, grant)

        plain_update_tenant_tier_mock.assert_awaited_once_with(
            tenant_external_id=str(ORG_A), tier_external_id="pro"
        )
        assert (
            organization_repository_mock.get_by_id.return_value.support_tier
            == SupportTier.pro
        )

    async def test_no_grant_unsets_tier(
        self,
        session_mock: AsyncSession,
        organization_repository_mock: MagicMock,
        plain_update_tenant_tier_mock: AsyncMock,
    ) -> None:
        await polar_self._apply_support(session_mock, ORG_A, None)

        plain_update_tenant_tier_mock.assert_awaited_once_with(
            tenant_external_id=str(ORG_A), tier_external_id=None
        )
        # Revocation resets the org tier to NULL (free).
        assert organization_repository_mock.get_by_id.return_value.support_tier is None

    async def test_no_grant_falls_back_to_default_tier(
        self,
        session_mock: AsyncSession,
        organization_repository_mock: MagicMock,
        plain_update_tenant_tier_mock: AsyncMock,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "PLAIN_DEFAULT_TIER_EXTERNAL_ID", "free")

        await polar_self._apply_support(session_mock, ORG_A, None)

        # Plain gets the default tier; the org stays NULL (the two agree).
        plain_update_tenant_tier_mock.assert_awaited_once_with(
            tenant_external_id=str(ORG_A), tier_external_id="free"
        )
        assert organization_repository_mock.get_by_id.return_value.support_tier is None

    async def test_grant_tier_overrides_default(
        self,
        session_mock: AsyncSession,
        organization_repository_mock: MagicMock,
        plain_update_tenant_tier_mock: AsyncMock,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "PLAIN_DEFAULT_TIER_EXTERNAL_ID", "free")
        grant = _make_grant(
            metadata={
                "type": "support",
                "level": "2",
                "slack": "true",
                "prioritized": "true",
                "plain_tier_external_id": "pro",
            }
        )

        await polar_self._apply_support(session_mock, ORG_A, grant)

        plain_update_tenant_tier_mock.assert_awaited_once_with(
            tenant_external_id=str(ORG_A), tier_external_id="pro"
        )
        assert (
            organization_repository_mock.get_by_id.return_value.support_tier
            == SupportTier.pro
        )

    async def test_invalid_metadata_raises(self, session_mock: AsyncSession) -> None:
        grant = _make_support_grant(level="two")

        with pytest.raises(SupportBenefitError):
            await polar_self._apply_support(session_mock, ORG_A, grant)


class TestSupportTier:
    def test_from_level_known(self) -> None:
        assert SupportTier.from_level(2) == SupportTier.pro
        assert SupportTier.from_level(3) == SupportTier.growth
        assert SupportTier.from_level(4) == SupportTier.scale

    @pytest.mark.parametrize("level", [None, 0, 1, 5, 99])
    def test_from_level_unknown_or_none_is_none(self, level: int | None) -> None:
        assert SupportTier.from_level(level) is None


@pytest.mark.asyncio
class TestHandleBenefitGrantEvent:
    async def test_created_with_transaction_fee_applies_current_state(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        list_grants_mock.return_value = [_make_fee_grant()]
        payload = WebhookBenefitGrantCreatedPayload.model_validate(
            _make_payload(
                "benefit_grant.created",
                metadata={"type": "transaction_fee"},
            )
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        set_platform_fee_mock.assert_awaited_once()
        assert set_platform_fee_mock.await_args is not None
        assert set_platform_fee_mock.await_args.kwargs == {
            "fee_percent": 380,
            "fee_fixed": 35,
            "subscription_fee_percent": 0,
        }

    async def test_revoked_with_no_remaining_grant_resets_fees(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        list_grants_mock.return_value = []
        payload = WebhookBenefitGrantRevokedPayload.model_validate(
            _make_payload(
                "benefit_grant.revoked",
                metadata={"type": "transaction_fee"},
            )
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        set_platform_fee_mock.assert_awaited_once()
        assert set_platform_fee_mock.await_args is not None
        assert set_platform_fee_mock.await_args.kwargs == {
            "fee_percent": settings.PLATFORM_FEE_BASIS_POINTS,
            "fee_fixed": settings.PLATFORM_FEE_FIXED,
            "subscription_fee_percent": settings.PLATFORM_SUBSCRIPTION_FEE_BASIS_POINTS,
        }

    async def test_revoked_with_replacement_grant_applies_replacement(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        # Upgrade race: revoke event arrives, replacement grant already active.
        list_grants_mock.return_value = [
            _make_fee_grant(benefit_id="tier_2", fee_percent="340", fee_fixed="30")
        ]
        payload = WebhookBenefitGrantRevokedPayload.model_validate(
            _make_payload(
                "benefit_grant.revoked",
                metadata={"type": "transaction_fee"},
                benefit_id="tier_1",
            )
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        set_platform_fee_mock.assert_awaited_once()
        assert set_platform_fee_mock.await_args is not None
        assert set_platform_fee_mock.await_args.kwargs == {
            "fee_percent": 340,
            "fee_fixed": 30,
            "subscription_fee_percent": 0,
        }

    async def test_unknown_metadata_type_is_noop(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        payload = WebhookBenefitGrantCreatedPayload.model_validate(
            _make_payload("benefit_grant.created", metadata={"type": "something_else"})
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        list_grants_mock.assert_not_awaited()
        set_platform_fee_mock.assert_not_awaited()

    async def test_no_metadata_type_is_noop(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        payload = WebhookBenefitGrantCreatedPayload.model_validate(
            _make_payload("benefit_grant.created", metadata={})
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        list_grants_mock.assert_not_awaited()
        set_platform_fee_mock.assert_not_awaited()

    async def test_missing_external_id_raises(
        self,
        session_mock: AsyncSession,
        account_repository_mock: MagicMock,
        set_platform_fee_mock: AsyncMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        payload = WebhookBenefitGrantCreatedPayload.model_validate(
            _make_payload(
                "benefit_grant.created",
                metadata={"type": "transaction_fee"},
                external_id=None,
            )
        )

        with pytest.raises(PolarSelfWebhookError, match="external_id"):
            await polar_self.handle_benefit_grant_event(session_mock, payload)

        list_grants_mock.assert_not_awaited()
        set_platform_fee_mock.assert_not_awaited()

    async def test_preview_access_created_enables_flags(
        self,
        session_mock: AsyncSession,
        preview_access_org_repository_mock: MagicMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        list_grants_mock.return_value = [_make_preview_grant()]
        payload = WebhookBenefitGrantCreatedPayload.model_validate(
            _make_payload("benefit_grant.created", metadata={"type": "preview_access"})
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        list_grants_mock.assert_awaited_once_with(customer_id=_CUSTOMER_ID)
        organization = preview_access_org_repository_mock.get_by_id.return_value
        assert organization.feature_settings == _PREVIEW_FLAGS_ENABLED

    async def test_preview_access_updated_enables_flags(
        self,
        session_mock: AsyncSession,
        preview_access_org_repository_mock: MagicMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        list_grants_mock.return_value = [_make_preview_grant()]
        payload = WebhookBenefitGrantUpdatedPayload.model_validate(
            _make_payload("benefit_grant.updated", metadata={"type": "preview_access"})
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        organization = preview_access_org_repository_mock.get_by_id.return_value
        assert organization.feature_settings == _PREVIEW_FLAGS_ENABLED

    async def test_preview_access_revoked_disables_flags(
        self,
        session_mock: AsyncSession,
        preview_access_org_repository_mock: MagicMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        list_grants_mock.return_value = []
        payload = WebhookBenefitGrantRevokedPayload.model_validate(
            _make_payload("benefit_grant.revoked", metadata={"type": "preview_access"})
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        organization = preview_access_org_repository_mock.get_by_id.return_value
        assert organization.feature_settings == _PREVIEW_FLAGS_DISABLED

    async def test_preview_access_revoked_with_remaining_grant_keeps_flags(
        self,
        session_mock: AsyncSession,
        preview_access_org_repository_mock: MagicMock,
        list_grants_mock: AsyncMock,
    ) -> None:
        # Overlapping grant still active when the revoke event arrives.
        list_grants_mock.return_value = [_make_preview_grant(benefit_id="other")]
        payload = WebhookBenefitGrantRevokedPayload.model_validate(
            _make_payload("benefit_grant.revoked", metadata={"type": "preview_access"})
        )

        await polar_self.handle_benefit_grant_event(session_mock, payload)

        organization = preview_access_org_repository_mock.get_by_id.return_value
        assert organization.feature_settings == _PREVIEW_FLAGS_ENABLED


@pytest.mark.asyncio
class TestApplyPreviewAccess:
    async def test_active_grant_enables_and_preserves_other_flags(
        self,
        session_mock: AsyncSession,
        preview_access_org_repository_mock: MagicMock,
    ) -> None:
        organization = preview_access_org_repository_mock.get_by_id.return_value
        organization.feature_settings = {"member_model_enabled": True}

        await polar_self._apply_preview_access(
            session_mock, ORG_A, _make_preview_grant()
        )

        preview_access_org_repository_mock.get_by_id.assert_awaited_once_with(
            ORG_A, include_blocked=True
        )
        assert organization.feature_settings == {
            "member_model_enabled": True,
            **_PREVIEW_FLAGS_ENABLED,
        }

    async def test_no_grant_disables_flags(
        self,
        session_mock: AsyncSession,
        preview_access_org_repository_mock: MagicMock,
    ) -> None:
        organization = preview_access_org_repository_mock.get_by_id.return_value
        organization.feature_settings = {**_PREVIEW_FLAGS_ENABLED}

        await polar_self._apply_preview_access(session_mock, ORG_A, None)

        assert organization.feature_settings == _PREVIEW_FLAGS_DISABLED

    async def test_missing_organization_is_silent_noop(
        self,
        session_mock: AsyncSession,
        preview_access_org_repository_mock: MagicMock,
    ) -> None:
        preview_access_org_repository_mock.get_by_id.return_value = None

        await polar_self._apply_preview_access(
            session_mock, ORG_A, _make_preview_grant()
        )


def _make_product(
    *,
    id: str = "prod_1",
    name: str = "Pro",
    metadata: dict[str, Any] | None = None,
    price_amount: int | None = None,
) -> Product:
    prices: list[dict[str, Any]] = []
    if price_amount is not None:
        prices.append(
            {
                "id": f"{id}_price",
                "created_at": "2026-01-01T00:00:00Z",
                "modified_at": None,
                "amount_type": "fixed",
                "source": "catalog",
                "is_archived": False,
                "product_id": id,
                "type": "recurring",
                "recurring_interval": "month",
                "price_currency": "usd",
                "price_amount": price_amount,
                "tax_behavior": "inclusive",
            }
        )
    return Product.model_validate(
        {
            "id": id,
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": None,
            "trial_interval": None,
            "trial_interval_count": None,
            "name": name,
            "description": None,
            "visibility": "public",
            "recurring_interval": "month",
            "recurring_interval_count": 1,
            "is_recurring": True,
            "is_archived": False,
            "organization_id": str(SELF_ORG_ID),
            "metadata": metadata or {},
            "prices": prices,
            "benefits": [],
            "medias": [],
            "attached_custom_fields": [],
        }
    )


def _make_subscription(
    *,
    id: str = "sub_1",
    product_id: str = "prod_1",
    amount: int = 0,
    cancel_at_period_end: bool = False,
    discount_id: str | None = None,
) -> Subscription:
    return Subscription.model_validate(
        {
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": None,
            "id": id,
            "amount": amount,
            "currency": "usd",
            "recurring_interval": "month",
            "recurring_interval_count": 1,
            "status": "active",
            "current_period_start": "2026-01-01T00:00:00Z",
            "current_period_end": "2026-02-01T00:00:00Z",
            "trial_start": None,
            "trial_end": None,
            "cancel_at_period_end": cancel_at_period_end,
            "canceled_at": None,
            "started_at": "2026-01-01T00:00:00Z",
            "ends_at": None,
            "ended_at": None,
            "customer_id": _CUSTOMER_DICT["id"],
            "product_id": product_id,
            "discount_id": discount_id,
            "checkout_id": None,
            "customer_cancellation_reason": None,
            "customer_cancellation_comment": None,
            "metadata": {},
            "customer": _CUSTOMER_DICT,
            "product": _make_product(id=product_id).model_dump(mode="json"),
            "discount": None,
            "prices": [],
            "meters": [],
            "pending_update": None,
        }
    )


@pytest.fixture
def client_mock(mocker: MockerFixture) -> MagicMock:
    client = MagicMock()
    client.list_recurring_products = AsyncMock(return_value=[])
    client.get_active_subscription = AsyncMock(return_value=None)
    client.create_checkout = AsyncMock(return_value=MagicMock(name="checkout"))
    client.update_subscription_product = AsyncMock(
        return_value=_make_subscription(id="sub_2", product_id="prod_2")
    )
    client.cancel_subscription = AsyncMock(
        return_value=_make_subscription(id="sub_existing")
    )
    client.uncancel_subscription = AsyncMock(
        return_value=_make_subscription(id="sub_existing")
    )
    client.update_subscription_discount = AsyncMock(
        return_value=_make_subscription(id="sub_existing", discount_id=None)
    )
    mocker.patch("polar.integrations.polar.service.get_client", return_value=client)
    return client


@pytest.mark.asyncio
class TestCancelSubscription:
    async def test_not_configured_raises(self, mocker: MockerFixture) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False

        with pytest.raises(PolarSelfNotConfigured):
            await polar_self.cancel_subscription(organization_id=ORG_A)

    async def test_no_active_subscription_raises(
        self, configured: None, client_mock: MagicMock
    ) -> None:
        client_mock.get_active_subscription.return_value = None

        with pytest.raises(PolarSelfNoActiveSubscription):
            await polar_self.cancel_subscription(organization_id=ORG_A)

        client_mock.cancel_subscription.assert_not_awaited()

    async def test_cancels_active_subscription(
        self, configured: None, client_mock: MagicMock
    ) -> None:
        active = _make_subscription(id="sub_existing")
        client_mock.get_active_subscription.return_value = active

        await polar_self.cancel_subscription(organization_id=ORG_A)

        client_mock.cancel_subscription.assert_awaited_once_with(
            subscription_id="sub_existing",
        )


@pytest.mark.asyncio
class TestListPlans:
    async def test_not_configured_raises(self, mocker: MockerFixture) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False

        with pytest.raises(PolarSelfNotConfigured):
            await polar_self.list_plans()

    async def test_sorts_by_metadata_order(
        self, configured: None, client_mock: MagicMock
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="p3", metadata={"order": 3}),
            _make_product(id="p1", metadata={"order": 1}),
            _make_product(id="p2", metadata={"order": 2}),
        ]

        plans = await polar_self.list_plans()

        assert [p.id for p in plans] == ["p1", "p2", "p3"]

    async def test_excludes_custom_plans(
        self, configured: None, client_mock: MagicMock
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="self_serve", metadata={"order": 1}),
            _make_product(id="custom_only", metadata={"custom": True}),
        ]

        plans = await polar_self.list_plans()

        assert [p.id for p in plans] == ["self_serve"]

    async def test_missing_order_sorts_last(
        self, configured: None, client_mock: MagicMock
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="no_order", metadata={}),
            _make_product(id="ordered", metadata={"order": 1}),
        ]

        plans = await polar_self.list_plans()

        assert [p.id for p in plans] == ["ordered", "no_order"]


@pytest.mark.asyncio
class TestGetSubscription:
    async def test_not_configured_raises(self, mocker: MockerFixture) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False

        with pytest.raises(PolarSelfNotConfigured):
            await polar_self.get_subscription(ORG_A)

    async def test_returns_none_when_no_active_sub(
        self, configured: None, client_mock: MagicMock
    ) -> None:
        client_mock.get_active_subscription.return_value = None

        result = await polar_self.get_subscription(ORG_A)

        assert result is None
        client_mock.get_active_subscription.assert_awaited_once_with(
            external_customer_id=str(ORG_A)
        )

    async def test_returns_subscription_when_active(
        self, configured: None, client_mock: MagicMock
    ) -> None:
        sub = _make_subscription()
        client_mock.get_active_subscription.return_value = sub

        result = await polar_self.get_subscription(ORG_A)

        assert result is sub


@pytest.mark.asyncio
class TestStartCheckout:
    async def test_not_configured_raises(
        self, mocker: MockerFixture, read_session_mock: AsyncReadSession
    ) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False

        with pytest.raises(PolarSelfNotConfigured):
            await polar_self.start_checkout(
                session=read_session_mock, organization_id=ORG_A, product_id="prod_1"
            )

    async def test_unknown_plan_raises(
        self,
        configured: None,
        client_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="known", metadata={"order": 1}),
        ]

        with pytest.raises(PolarSelfPlanNotFound):
            await polar_self.start_checkout(
                session=read_session_mock, organization_id=ORG_A, product_id="unknown"
            )

        client_mock.create_checkout.assert_not_awaited()

    async def test_custom_plan_rejected(
        self,
        configured: None,
        client_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="custom_only", metadata={"custom": True}),
        ]

        with pytest.raises(PolarSelfPlanNotFound):
            await polar_self.start_checkout(
                session=read_session_mock,
                organization_id=ORG_A,
                product_id="custom_only",
            )

    async def test_unapproved_rejected(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_paid", metadata={"order": 1}),
        ]
        organization_repository_mock.get_by_id.return_value = None

        with pytest.raises(PolarSelfNotApproved):
            await polar_self.start_checkout(
                session=read_session_mock,
                organization_id=ORG_A,
                product_id="prod_paid",
            )

        client_mock.create_checkout.assert_not_awaited()

    async def test_does_not_touch_existing_discount_on_checkout(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        """Discounts are no longer product-scoped, so a checkout that switches
        an existing subscription's product must NOT clear the previous
        discount — the checkout handles its own discount via ``discount_id``."""
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_paid", metadata={"order": 1}),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing",
            product_id="prod_scale",
            discount_id="disc_startup",
        )

        await polar_self.start_checkout(
            session=read_session_mock,
            organization_id=ORG_A,
            product_id="prod_paid",
        )

        client_mock.update_subscription_discount.assert_not_awaited()
        client_mock.create_checkout.assert_awaited_once()

    async def test_does_not_clear_when_no_existing_subscription(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_paid", metadata={"order": 1}),
        ]
        client_mock.get_active_subscription.return_value = None

        await polar_self.start_checkout(
            session=read_session_mock,
            organization_id=ORG_A,
            product_id="prod_paid",
        )

        client_mock.update_subscription_discount.assert_not_awaited()

    async def test_does_not_clear_when_existing_has_no_discount(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_paid", metadata={"order": 1}),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing", product_id="prod_pro", discount_id=None
        )

        await polar_self.start_checkout(
            session=read_session_mock,
            organization_id=ORG_A,
            product_id="prod_paid",
        )

        client_mock.update_subscription_discount.assert_not_awaited()


@pytest.mark.asyncio
class TestChangePlan:
    async def test_not_configured_raises(
        self, mocker: MockerFixture, read_session_mock: AsyncReadSession
    ) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False

        with pytest.raises(PolarSelfNotConfigured):
            await polar_self.change_plan(
                session=read_session_mock, organization_id=ORG_A, product_id="p"
            )

    async def test_unknown_plan_raises(
        self,
        configured: None,
        client_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="known", metadata={"order": 1}),
        ]

        with pytest.raises(PolarSelfPlanNotFound):
            await polar_self.change_plan(
                session=read_session_mock, organization_id=ORG_A, product_id="unknown"
            )

        client_mock.update_subscription_product.assert_not_awaited()

    async def test_no_active_subscription_raises(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_2", metadata={"order": 2}),
        ]
        client_mock.get_active_subscription.return_value = None

        with pytest.raises(PolarSelfNoActiveSubscription):
            await polar_self.change_plan(
                session=read_session_mock, organization_id=ORG_A, product_id="prod_2"
            )

        client_mock.update_subscription_product.assert_not_awaited()

    async def test_upgrade_invoices_immediately(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_2", metadata={"order": 2}, price_amount=10000),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing", product_id="prod_1"
        )

        await polar_self.change_plan(
            session=read_session_mock, organization_id=ORG_A, product_id="prod_2"
        )

        client_mock.update_subscription_product.assert_awaited_once_with(
            subscription_id="sub_existing",
            product_id="prod_2",
            proration_behavior=SubscriptionProrationBehavior.INVOICE,
        )

    async def test_downgrade_defers_to_next_period(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_2", metadata={"order": 2}, price_amount=500),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing", product_id="prod_1", amount=2000
        )

        await polar_self.change_plan(
            session=read_session_mock, organization_id=ORG_A, product_id="prod_2"
        )

        client_mock.update_subscription_product.assert_awaited_once_with(
            subscription_id="sub_existing",
            product_id="prod_2",
            proration_behavior=SubscriptionProrationBehavior.NEXT_PERIOD,
        )
        client_mock.uncancel_subscription.assert_not_awaited()

    async def test_uncancels_before_switching_when_canceling(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_2", metadata={"order": 2}, price_amount=10000),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing",
            product_id="prod_1",
            amount=2000,
            cancel_at_period_end=True,
        )

        await polar_self.change_plan(
            session=read_session_mock, organization_id=ORG_A, product_id="prod_2"
        )

        client_mock.uncancel_subscription.assert_awaited_once_with(
            subscription_id="sub_existing",
        )
        client_mock.update_subscription_product.assert_awaited_once_with(
            subscription_id="sub_existing",
            product_id="prod_2",
            proration_behavior=SubscriptionProrationBehavior.INVOICE,
        )

    async def test_unapproved_rejected(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_2", metadata={"order": 2}),
        ]
        inactive = MagicMock(spec=Organization)
        inactive.is_active.return_value = False
        organization_repository_mock.get_by_id.return_value = inactive

        with pytest.raises(PolarSelfNotApproved):
            await polar_self.change_plan(
                session=read_session_mock, organization_id=ORG_A, product_id="prod_2"
            )

        client_mock.update_subscription_product.assert_not_awaited()

    async def test_clears_existing_discount_when_leaving_scale(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        mocker: MockerFixture,
        read_session_mock: AsyncReadSession,
    ) -> None:
        """Discounts are no longer product-scoped, so switching away from Scale
        to a non-eligible plan must clear the discount — otherwise the Startup
        Program discount would leak onto the new plan."""
        mocker.patch(
            "polar.integrations.polar.service.settings.POLAR_SCALE_PRODUCT_ID",
            "prod_scale",
        )
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_growth", metadata={"order": 2}, price_amount=10000),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing",
            product_id="prod_scale",
            amount=0,  # 100% discount → currently $0
            discount_id="disc_startup",
        )

        await polar_self.change_plan(
            session=read_session_mock,
            organization_id=ORG_A,
            product_id="prod_growth",
        )

        client_mock.update_subscription_discount.assert_awaited_once_with(
            subscription_id="sub_existing",
            discount_id=None,
        )
        # The clear must happen before the product update. ``mock_calls``
        # captures the global call order across all mock attributes.
        method_call_order = [
            call[0] for call in client_mock.mock_calls if "()" not in call[0]
        ]
        clear_index = method_call_order.index("update_subscription_discount")
        update_index = method_call_order.index("update_subscription_product")
        assert clear_index < update_index
        client_mock.update_subscription_product.assert_awaited_once_with(
            subscription_id="sub_existing",
            product_id="prod_growth",
            proration_behavior=SubscriptionProrationBehavior.INVOICE,
        )

    async def test_does_not_clear_when_no_discount(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        read_session_mock: AsyncReadSession,
    ) -> None:
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_2", metadata={"order": 2}, price_amount=10000),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing",
            product_id="prod_1",
            amount=2000,
            discount_id=None,
        )

        await polar_self.change_plan(
            session=read_session_mock, organization_id=ORG_A, product_id="prod_2"
        )

        client_mock.update_subscription_discount.assert_not_awaited()

    async def test_attaches_claimable_discount_before_product_switch(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        mocker: MockerFixture,
        read_session_mock: AsyncReadSession,
    ) -> None:
        """Pro -> Scale via Change Plan: if the org is invited to the
        Startup Program, attach the discount BEFORE switching products so the
        proration computed at the switch reflects the discounted amount.
        Mirrors what ``start_checkout`` does for Free -> Scale."""
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_scale", metadata={"order": 4}, price_amount=40000),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing", product_id="prod_pro", amount=2000
        )
        mocker.patch(
            "polar.integrations.polar.service.settings.POLAR_SCALE_PRODUCT_ID",
            "prod_scale",
        )
        mocker.patch(
            "polar.integrations.polar.service.startup_program_service."
            "resolve_checkout_discount_id",
            AsyncMock(return_value="disc_startup"),
        )

        await polar_self.change_plan(
            session=read_session_mock,
            organization_id=ORG_A,
            product_id="prod_scale",
        )

        # The discount is attached to the current subscription ("sub_existing")
        # before the product switch.
        client_mock.update_subscription_discount.assert_awaited_once_with(
            subscription_id="sub_existing",
            discount_id="disc_startup",
        )
        client_mock.update_subscription_product.assert_awaited_once()
        # The discount must be applied before the product update. ``mock_calls``
        # captures the global call order across all mock attributes.
        method_call_order = [
            call[0] for call in client_mock.mock_calls if "()" not in call[0]
        ]
        discount_index = method_call_order.index("update_subscription_discount")
        update_index = method_call_order.index("update_subscription_product")
        assert discount_index < update_index

    async def test_does_not_attach_when_no_claimable_discount(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        mocker: MockerFixture,
        read_session_mock: AsyncReadSession,
    ) -> None:
        """Pro -> Growth (or org not invited): no discount attached."""
        client_mock.list_recurring_products.return_value = [
            _make_product(id="prod_growth", metadata={"order": 3}, price_amount=10000),
        ]
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing", product_id="prod_pro", amount=2000
        )
        mocker.patch(
            "polar.integrations.polar.service.startup_program_service."
            "resolve_checkout_discount_id",
            AsyncMock(return_value=None),
        )

        await polar_self.change_plan(
            session=read_session_mock,
            organization_id=ORG_A,
            product_id="prod_growth",
        )

        client_mock.update_subscription_product.assert_awaited_once()
        client_mock.update_subscription_discount.assert_not_awaited()


@pytest.mark.asyncio
class TestClaimStartupProgram:
    """``claim_startup_program`` switches an existing paid subscription to
    Scale and attaches the Startup Program discount via PATCH (no checkout).
    """

    async def test_not_configured_raises(
        self, mocker: MockerFixture, read_session_mock: AsyncReadSession
    ) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False

        with pytest.raises(PolarSelfNotConfigured):
            await polar_self.claim_startup_program(
                session=read_session_mock, organization_id=ORG_A
            )

    async def test_free_org_returns_checkout(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        mocker: MockerFixture,
        read_session_mock: AsyncReadSession,
    ) -> None:
        """Free plan → claim creates a checkout (no PATCH path)."""
        mocker.patch(
            "polar.integrations.polar.service.settings.STARTUP_PROGRAM_ENABLED",
            True,
        )
        mocker.patch(
            "polar.integrations.polar.service.settings.POLAR_SCALE_PRODUCT_ID",
            "prod_scale",
        )
        mocker.patch(
            "polar.integrations.polar.service.startup_program_service."
            "resolve_checkout_discount_id",
            AsyncMock(return_value="disc_startup"),
        )
        client_mock.get_active_subscription.return_value = None

        subscription, checkout = await polar_self.claim_startup_program(
            session=read_session_mock,
            organization_id=ORG_A,
            success_url="https://app.example/billing?ok=1",
            return_url="https://app.example/billing?cancel=1",
        )

        assert subscription is None
        assert checkout is not None
        client_mock.create_checkout.assert_awaited_once_with(
            product_id="prod_scale",
            external_customer_id=str(ORG_A),
            subscription_id=None,
            customer_ip_address=None,
            success_url="https://app.example/billing?ok=1",
            return_url="https://app.example/billing?cancel=1",
            embed_origin=None,
            discount_id="disc_startup",
        )
        client_mock.update_subscription_product.assert_not_awaited()
        client_mock.update_subscription_discount.assert_not_awaited()

    async def test_raises_when_not_invited(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        mocker: MockerFixture,
        read_session_mock: AsyncReadSession,
    ) -> None:
        from polar.startup_program.service import StartupProgramError

        mocker.patch(
            "polar.integrations.polar.service.settings.STARTUP_PROGRAM_ENABLED",
            True,
        )
        mocker.patch(
            "polar.integrations.polar.service.settings.POLAR_SCALE_PRODUCT_ID",
            "prod_scale",
        )
        mocker.patch(
            "polar.integrations.polar.service.startup_program_service."
            "resolve_checkout_discount_id",
            AsyncMock(return_value=None),
        )

        with pytest.raises(StartupProgramError, match="claimable"):
            await polar_self.claim_startup_program(
                session=read_session_mock, organization_id=ORG_A
            )

        client_mock.get_active_subscription.assert_not_awaited()
        client_mock.update_subscription_product.assert_not_awaited()
        client_mock.update_subscription_discount.assert_not_awaited()

    async def test_applies_discount_then_switches_product(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        mocker: MockerFixture,
        read_session_mock: AsyncReadSession,
    ) -> None:
        """Org on Growth → applies the Startup Program discount, THEN switches
        product to Scale so the proration at the switch reflects the discount.
        Both calls happen via PATCH; no ``create_checkout``."""
        mocker.patch(
            "polar.integrations.polar.service.settings.STARTUP_PROGRAM_ENABLED",
            True,
        )
        mocker.patch(
            "polar.integrations.polar.service.settings.POLAR_SCALE_PRODUCT_ID",
            "prod_scale",
        )
        mocker.patch(
            "polar.integrations.polar.service.startup_program_service."
            "resolve_checkout_discount_id",
            AsyncMock(return_value="disc_startup"),
        )
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing", product_id="prod_growth", amount=10000
        )

        subscription, checkout = await polar_self.claim_startup_program(
            session=read_session_mock, organization_id=ORG_A
        )

        assert subscription is not None
        assert checkout is None
        # Discount is attached to the current subscription before the switch.
        client_mock.update_subscription_discount.assert_awaited_once_with(
            subscription_id="sub_existing",
            discount_id="disc_startup",
        )
        client_mock.update_subscription_product.assert_awaited_once_with(
            subscription_id="sub_existing",
            product_id="prod_scale",
            proration_behavior=SubscriptionProrationBehavior.INVOICE,
        )
        # The discount must be applied before the product update.
        method_call_order = [
            call[0] for call in client_mock.mock_calls if "()" not in call[0]
        ]
        discount_index = method_call_order.index("update_subscription_discount")
        update_index = method_call_order.index("update_subscription_product")
        assert discount_index < update_index
        client_mock.create_checkout.assert_not_awaited()

    async def test_only_applies_discount_when_already_on_scale(
        self,
        configured: None,
        client_mock: MagicMock,
        organization_repository_mock: MagicMock,
        mocker: MockerFixture,
        read_session_mock: AsyncReadSession,
    ) -> None:
        mocker.patch(
            "polar.integrations.polar.service.settings.STARTUP_PROGRAM_ENABLED",
            True,
        )
        mocker.patch(
            "polar.integrations.polar.service.settings.POLAR_SCALE_PRODUCT_ID",
            "prod_scale",
        )
        mocker.patch(
            "polar.integrations.polar.service.startup_program_service."
            "resolve_checkout_discount_id",
            AsyncMock(return_value="disc_startup"),
        )
        client_mock.get_active_subscription.return_value = _make_subscription(
            id="sub_existing", product_id="prod_scale", amount=40000
        )

        subscription, checkout = await polar_self.claim_startup_program(
            session=read_session_mock, organization_id=ORG_A
        )

        assert subscription is not None
        assert checkout is None
        client_mock.update_subscription_product.assert_not_awaited()
        client_mock.update_subscription_discount.assert_awaited_once_with(
            subscription_id="sub_existing", discount_id="disc_startup"
        )


def _order_dict(
    *,
    id: str = "ord_1",
    customer_id: str = _CUSTOMER_ID,
    product_id: str = "prod_1",
    status: str = "paid",
    net_amount: int = 2000,
    billing_reason: str = "subscription_cycle",
    billing_name: str | None = None,
    billing_address: dict[str, Any] | None = None,
    is_invoice_generated: bool = True,
    discount_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": id,
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "status": status,
        "paid": status == "paid",
        "subtotal_amount": net_amount,
        "discount_amount": 0,
        "net_amount": net_amount,
        "tax_amount": 0,
        "total_amount": net_amount,
        "applied_balance_amount": 0,
        "due_amount": net_amount,
        "refunded_amount": 0,
        "refunded_tax_amount": 0,
        "refundable_amount": net_amount,
        "refundable_tax_amount": 0,
        "receipt_number": None,
        "currency": "usd",
        "billing_reason": billing_reason,
        "billing_name": billing_name,
        "billing_address": billing_address,
        "invoice_number": "POLAR-0001",
        "is_invoice_generated": is_invoice_generated,
        "customer_id": customer_id,
        "product_id": product_id,
        "discount_id": discount_id,
        "subscription_id": "00000000-0000-0000-0000-000000000001",
        "checkout_id": None,
        "metadata": {},
        "platform_fee_amount": 0,
        "platform_fee_currency": None,
        "customer": _CUSTOMER_DICT,
        "product": _make_product(id=product_id).model_dump(mode="json"),
        "discount": None,
        "subscription": None,
        "items": [],
        "description": "Pro subscription",
    }


def _make_order(**kwargs: Any) -> Order:
    return Order.model_validate(_order_dict(**kwargs))


def _make_order_created_payload(**kwargs: Any) -> WebhookOrderCreatedPayload:
    return WebhookOrderCreatedPayload.model_validate(
        {
            "type": "order.created",
            "timestamp": "2026-01-01T00:00:00Z",
            "data": _order_dict(**kwargs),
        }
    )


@pytest.fixture
def orders_client_mock(mocker: MockerFixture) -> MagicMock:
    client = MagicMock()
    client.get_customer_by_external_id_or_none = AsyncMock(
        return_value=_make_customer(external_id=str(ORG_A))
    )
    client.list_customer_orders = AsyncMock(return_value=([], 0))
    client.get_order = AsyncMock(return_value=None)
    client.get_order_invoice = AsyncMock(return_value=None)
    mocker.patch("polar.integrations.polar.service.get_client", return_value=client)
    return client


@pytest.mark.asyncio
class TestListOrders:
    async def test_not_configured_raises(self, mocker: MockerFixture) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False

        with pytest.raises(PolarSelfNotConfigured):
            await polar_self.list_orders(ORG_A)

    async def test_returns_empty_when_customer_not_found(
        self, configured: None, orders_client_mock: MagicMock
    ) -> None:
        orders_client_mock.get_customer_by_external_id_or_none.return_value = None

        items, total = await polar_self.list_orders(ORG_A)

        assert items == []
        assert total == 0
        orders_client_mock.list_customer_orders.assert_not_awaited()

    async def test_lists_orders_for_resolved_customer(
        self, configured: None, orders_client_mock: MagicMock
    ) -> None:
        order = _make_order(id="ord_1")
        orders_client_mock.list_customer_orders.return_value = ([order], 1)

        items, total = await polar_self.list_orders(ORG_A, page=2, limit=20)

        assert items == [order]
        assert total == 1
        orders_client_mock.list_customer_orders.assert_awaited_once_with(
            customer_id=_CUSTOMER_ID,
            page=2,
            limit=20,
        )


@pytest.mark.asyncio
class TestGetOrderInvoiceUrl:
    async def test_not_configured_raises(self, mocker: MockerFixture) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False

        with pytest.raises(PolarSelfNotConfigured):
            await polar_self.get_order_invoice_url(ORG_A, "ord_1")

    async def test_customer_not_found_raises_order_not_found(
        self, configured: None, orders_client_mock: MagicMock
    ) -> None:
        orders_client_mock.get_customer_by_external_id_or_none.return_value = None

        with pytest.raises(PolarSelfOrderNotFound):
            await polar_self.get_order_invoice_url(ORG_A, "ord_1")

        orders_client_mock.get_order.assert_not_awaited()

    async def test_order_not_found(
        self, configured: None, orders_client_mock: MagicMock
    ) -> None:
        orders_client_mock.get_order.return_value = None

        with pytest.raises(PolarSelfOrderNotFound):
            await polar_self.get_order_invoice_url(ORG_A, "ord_1")

        orders_client_mock.get_order_invoice.assert_not_awaited()

    async def test_order_belongs_to_other_customer(
        self, configured: None, orders_client_mock: MagicMock
    ) -> None:
        orders_client_mock.get_order.return_value = _make_order(
            customer_id="some-other-customer"
        )

        with pytest.raises(PolarSelfOrderNotFound):
            await polar_self.get_order_invoice_url(ORG_A, "ord_1")

        orders_client_mock.get_order_invoice.assert_not_awaited()

    async def test_invoice_not_available_raises(
        self, configured: None, orders_client_mock: MagicMock
    ) -> None:
        orders_client_mock.get_order.return_value = _make_order()
        orders_client_mock.get_order_invoice.return_value = None

        with pytest.raises(PolarSelfOrderNotFound):
            await polar_self.get_order_invoice_url(ORG_A, "ord_1")

    async def test_returns_invoice_url(
        self, configured: None, orders_client_mock: MagicMock
    ) -> None:
        orders_client_mock.get_order.return_value = _make_order()
        orders_client_mock.get_order_invoice.return_value = (
            "https://example.com/inv.pdf"
        )

        url = await polar_self.get_order_invoice_url(ORG_A, "ord_1")

        assert url == "https://example.com/inv.pdf"
        orders_client_mock.get_order_invoice.assert_awaited_once_with(order_id="ord_1")


_BILLING_ADDRESS = {
    "country": "US",
    "line1": "1 Market St",
    "line2": None,
    "postal_code": "94105",
    "city": "San Francisco",
    "state": "CA",
}


def _make_contact(email: str) -> MagicMock:
    contact = MagicMock()
    contact.email = email
    return contact


@pytest.fixture
def order_webhook_client_mock(mocker: MockerFixture) -> MagicMock:
    client = MagicMock()
    client.get_order = AsyncMock()
    client.list_billing_contacts = AsyncMock(
        return_value=[_make_contact("billing@example.com")]
    )
    client.trigger_order_invoice_generation = AsyncMock()
    client.get_order_invoice = AsyncMock(return_value="https://example.com/inv.pdf")
    mocker.patch("polar.integrations.polar.service.get_client", return_value=client)
    return client


@pytest.fixture
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.integrations.polar.service.enqueue_email_template")


@pytest.mark.asyncio
class TestHandleOrderCreatedEvent:
    async def test_ignores_non_subscription_billing_reasons(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        order_webhook_client_mock.get_order.return_value = _make_order(
            billing_reason="purchase"
        )
        payload = _make_order_created_payload(billing_reason="purchase")

        await polar_self.handle_order_created_event(payload)

        order_webhook_client_mock.list_billing_contacts.assert_not_awaited()
        enqueue_email_mock.assert_not_called()

    async def test_skips_when_order_not_found(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        order_webhook_client_mock.get_order.return_value = None
        payload = _make_order_created_payload()

        await polar_self.handle_order_created_event(payload)

        order_webhook_client_mock.list_billing_contacts.assert_not_awaited()
        enqueue_email_mock.assert_not_called()

    async def test_skips_when_net_amount_is_zero(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        # Free orders ($0 plans or 100%-discounted) shouldn't notify or attach
        # an invoice — we'd email customers about an order they never paid for.
        order_webhook_client_mock.get_order.return_value = _make_order(net_amount=0)
        payload = _make_order_created_payload(net_amount=0)

        await polar_self.handle_order_created_event(payload)

        order_webhook_client_mock.list_billing_contacts.assert_not_awaited()
        order_webhook_client_mock.trigger_order_invoice_generation.assert_not_awaited()
        enqueue_email_mock.assert_not_called()

    async def test_skips_when_no_billing_contacts(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        order_webhook_client_mock.get_order.return_value = _make_order()
        order_webhook_client_mock.list_billing_contacts.return_value = []
        payload = _make_order_created_payload()

        await polar_self.handle_order_created_event(payload)

        enqueue_email_mock.assert_not_called()

    async def test_sends_email_without_invoice_when_billing_details_missing(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        order_webhook_client_mock.get_order.return_value = _make_order(
            billing_name=None, billing_address=None
        )
        payload = _make_order_created_payload()

        await polar_self.handle_order_created_event(payload)

        order_webhook_client_mock.trigger_order_invoice_generation.assert_not_awaited()
        order_webhook_client_mock.get_order_invoice.assert_not_awaited()
        enqueue_email_mock.assert_called_once()
        assert enqueue_email_mock.call_args.kwargs["attachments"] is None

    async def test_attaches_invoice_when_already_generated(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        order_webhook_client_mock.get_order.return_value = _make_order(
            billing_name="Acme Inc",
            billing_address=_BILLING_ADDRESS,
            is_invoice_generated=True,
        )
        payload = _make_order_created_payload()

        await polar_self.handle_order_created_event(payload)

        order_webhook_client_mock.trigger_order_invoice_generation.assert_not_awaited()
        order_webhook_client_mock.get_order_invoice.assert_awaited_once_with(
            order_id="ord_1"
        )
        enqueue_email_mock.assert_called_once()
        attachments = enqueue_email_mock.call_args.kwargs["attachments"]
        assert attachments == [
            {
                "remote_url": "https://example.com/inv.pdf",
                "filename": "POLAR-0001.pdf",
            }
        ]

    async def test_triggers_generation_and_retries_when_not_yet_generated(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        order_webhook_client_mock.get_order.return_value = _make_order(
            billing_name="Acme Inc",
            billing_address=_BILLING_ADDRESS,
            is_invoice_generated=False,
        )
        payload = _make_order_created_payload()

        with pytest.raises(PolarSelfInvoiceNotReady):
            await polar_self.handle_order_created_event(payload)

        order_webhook_client_mock.trigger_order_invoice_generation.assert_awaited_once_with(
            order_id="ord_1"
        )
        enqueue_email_mock.assert_not_called()

    async def test_retries_when_invoice_generation_returns_not_paid(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        # NotPaidOrder (422) means payment hasn't settled yet — retry rather
        # than silently sending the email without an invoice attached.
        order_webhook_client_mock.get_order.return_value = _make_order(
            billing_name="Acme Inc",
            billing_address=_BILLING_ADDRESS,
            is_invoice_generated=False,
        )
        order_webhook_client_mock.trigger_order_invoice_generation.side_effect = (
            PolarSelfNotPaidOrder("ord_1")
        )
        payload = _make_order_created_payload()

        with pytest.raises(PolarSelfInvoiceNotReady):
            await polar_self.handle_order_created_event(payload)

        enqueue_email_mock.assert_not_called()

    async def test_retries_when_invoice_url_is_none(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        order_webhook_client_mock.get_order.return_value = _make_order(
            billing_name="Acme Inc",
            billing_address=_BILLING_ADDRESS,
            is_invoice_generated=True,
        )
        order_webhook_client_mock.get_order_invoice.return_value = None
        payload = _make_order_created_payload()

        with pytest.raises(PolarSelfInvoiceNotReady):
            await polar_self.handle_order_created_event(payload)

        enqueue_email_mock.assert_not_called()

    async def test_uses_fresh_order_payload_from_api(
        self,
        order_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        # The webhook payload's net_amount could be stale; the fresh fetch is
        # the source of truth — here, the fresh order is free, so we skip.
        order_webhook_client_mock.get_order.return_value = _make_order(net_amount=0)
        payload = _make_order_created_payload(net_amount=2000)

        await polar_self.handle_order_created_event(payload)

        order_webhook_client_mock.get_order.assert_awaited_once_with(order_id="ord_1")
        enqueue_email_mock.assert_not_called()


def _make_subscription_canceled_payload(
    *, ends_at: str | None = "2026-02-01T00:00:00Z", **kwargs: Any
) -> WebhookSubscriptionCanceledPayload:
    data = _make_subscription(**kwargs).model_dump(mode="json")
    data["ends_at"] = ends_at
    return WebhookSubscriptionCanceledPayload.model_validate(
        {
            "type": "subscription.canceled",
            "timestamp": "2026-01-01T00:00:00Z",
            "data": data,
        }
    )


def _make_subscription_past_due_payload(
    **kwargs: Any,
) -> WebhookSubscriptionPastDuePayload:
    return WebhookSubscriptionPastDuePayload.model_validate(
        {
            "type": "subscription.past_due",
            "timestamp": "2026-01-01T00:00:00Z",
            "data": _make_subscription(**kwargs).model_dump(mode="json"),
        }
    )


def _make_subscription_revoked_payload(
    **kwargs: Any,
) -> WebhookSubscriptionRevokedPayload:
    return WebhookSubscriptionRevokedPayload.model_validate(
        {
            "type": "subscription.revoked",
            "timestamp": "2026-01-01T00:00:00Z",
            "data": _make_subscription(**kwargs).model_dump(mode="json"),
        }
    )


@pytest.fixture
def subscription_webhook_client_mock(mocker: MockerFixture) -> MagicMock:
    client = MagicMock()
    client.list_billing_contacts = AsyncMock(
        return_value=[_make_contact("billing@example.com")]
    )
    mocker.patch("polar.integrations.polar.service.get_client", return_value=client)
    return client


@pytest.mark.asyncio
class TestHandleSubscriptionCanceledEvent:
    async def test_skips_free_subscription(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        payload = _make_subscription_canceled_payload(amount=0)

        await polar_self.handle_subscription_canceled_event(payload)

        subscription_webhook_client_mock.list_billing_contacts.assert_not_awaited()
        enqueue_email_mock.assert_not_called()

    async def test_skips_when_no_billing_contacts(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        subscription_webhook_client_mock.list_billing_contacts.return_value = []
        payload = _make_subscription_canceled_payload(amount=2000)

        await polar_self.handle_subscription_canceled_event(payload)

        enqueue_email_mock.assert_not_called()

    async def test_sends_email_with_end_date(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        payload = _make_subscription_canceled_payload(
            amount=2000, ends_at="2026-02-01T00:00:00Z"
        )

        await polar_self.handle_subscription_canceled_event(payload)

        subscription_webhook_client_mock.list_billing_contacts.assert_awaited_once_with(
            customer_id=_CUSTOMER_ID
        )
        enqueue_email_mock.assert_called_once()
        email = enqueue_email_mock.call_args.args[0]
        assert email.template == "polar_self_subscription_cancellation"
        assert email.props.product_name == "Pro"
        assert email.props.ends_at is not None
        assert email.props.ends_at.startswith("2026-02-01")
        kwargs = enqueue_email_mock.call_args.kwargs
        assert kwargs["to_email_addr"] == "billing@example.com"
        assert kwargs["subject"] == "Your Pro subscription has been canceled"

    async def test_sends_email_without_end_date(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        payload = _make_subscription_canceled_payload(amount=2000, ends_at=None)

        await polar_self.handle_subscription_canceled_event(payload)

        enqueue_email_mock.assert_called_once()
        email = enqueue_email_mock.call_args.args[0]
        assert email.props.ends_at is None


@pytest.mark.asyncio
class TestHandleSubscriptionPastDueEvent:
    async def test_skips_free_subscription(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        # A $0 subscription has no payment to fail, so there's nothing to notify.
        payload = _make_subscription_past_due_payload(amount=0)

        await polar_self.handle_subscription_past_due_event(payload)

        subscription_webhook_client_mock.list_billing_contacts.assert_not_awaited()
        enqueue_email_mock.assert_not_called()

    async def test_skips_when_no_billing_contacts(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        subscription_webhook_client_mock.list_billing_contacts.return_value = []
        payload = _make_subscription_past_due_payload(amount=2000)

        await polar_self.handle_subscription_past_due_event(payload)

        enqueue_email_mock.assert_not_called()

    async def test_sends_email_to_billing_contacts(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        payload = _make_subscription_past_due_payload(amount=2000)

        await polar_self.handle_subscription_past_due_event(payload)

        subscription_webhook_client_mock.list_billing_contacts.assert_awaited_once_with(
            customer_id=_CUSTOMER_ID
        )
        enqueue_email_mock.assert_called_once()
        email = enqueue_email_mock.call_args.args[0]
        assert email.template == "polar_self_subscription_past_due"
        assert email.props.product_name == "Pro"
        kwargs = enqueue_email_mock.call_args.kwargs
        assert kwargs["to_email_addr"] == "billing@example.com"
        assert kwargs["subject"] == "Your Pro subscription payment failed"


@pytest.mark.asyncio
class TestHandleSubscriptionRevokedEvent:
    async def test_skips_free_subscription(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        payload = _make_subscription_revoked_payload(amount=0)

        await polar_self.handle_subscription_revoked_event(payload)

        subscription_webhook_client_mock.list_billing_contacts.assert_not_awaited()
        enqueue_email_mock.assert_not_called()

    async def test_skips_when_no_billing_contacts(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        subscription_webhook_client_mock.list_billing_contacts.return_value = []
        payload = _make_subscription_revoked_payload(amount=2000)

        await polar_self.handle_subscription_revoked_event(payload)

        enqueue_email_mock.assert_not_called()

    async def test_sends_email_to_billing_contacts(
        self,
        subscription_webhook_client_mock: MagicMock,
        enqueue_email_mock: MagicMock,
    ) -> None:
        payload = _make_subscription_revoked_payload(amount=2000)

        await polar_self.handle_subscription_revoked_event(payload)

        subscription_webhook_client_mock.list_billing_contacts.assert_awaited_once_with(
            customer_id=_CUSTOMER_ID
        )
        enqueue_email_mock.assert_called_once()
        email = enqueue_email_mock.call_args.args[0]
        assert email.template == "polar_self_subscription_revoked"
        assert email.props.product_name == "Pro"
        kwargs = enqueue_email_mock.call_args.kwargs
        assert kwargs["to_email_addr"] == "billing@example.com"
        assert kwargs["subject"] == "Your Pro subscription has ended"
