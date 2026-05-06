import uuid
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from polar_sdk.models import (
    BenefitGrant,
    CustomerIndividual,
    WebhookBenefitGrantCreatedPayload,
    WebhookBenefitGrantRevokedPayload,
)
from pytest_mock import MockerFixture

from polar.integrations.polar.service import (
    PolarSelfWebhookError,
    SupportBenefitError,
    TransactionFeeBenefitError,
    polar_self,
)
from polar.postgres import AsyncSession

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
    "billing_address": None,
    "tax_id": None,
    "organization_id": "00000000-0000-0000-0000-000000000099",
    "deleted_at": None,
    "avatar_url": "",
    "external_id": str(ORG_A),
}

_BENEFIT_ID = "00000000-0000-0000-0000-0000000000b1"
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
) -> BenefitGrant:
    return _make_grant(
        benefit_id=benefit_id,
        metadata={
            "type": "transaction_fee",
            "fee_percent": fee_percent,
            "fee_fixed": fee_fixed,
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


@pytest.fixture
def session_mock() -> AsyncSession:
    return MagicMock(spec=AsyncSession)


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
            {"fee_percent": "380", "fee_fixed": "35"}, _BENEFIT_ID
        ) == (380, 35)

    def test_native_int_values(self) -> None:
        assert polar_self._extract_transaction_fee(
            {"fee_percent": 380, "fee_fixed": 35}, _BENEFIT_ID
        ) == (380, 35)

    def test_whole_float_values(self) -> None:
        assert polar_self._extract_transaction_fee(
            {"fee_percent": 380.0, "fee_fixed": 35.0}, _BENEFIT_ID
        ) == (380, 35)

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
        ) == (2, True, False)

    def test_native_typed_values(self) -> None:
        assert polar_self._extract_support(
            {"level": 2, "slack": True, "prioritized": False}, _BENEFIT_ID
        ) == (2, True, False)

    def test_whole_float_level(self) -> None:
        assert polar_self._extract_support(
            {"level": 2.0, "slack": True, "prioritized": False}, _BENEFIT_ID
        ) == (2, True, False)

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
            "fee_percent": None,
            "fee_fixed": None,
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
    async def test_active_grant(self, session_mock: AsyncSession) -> None:
        grant = _make_support_grant()

        await polar_self._apply_support(session_mock, ORG_A, grant)

    async def test_no_grant(self, session_mock: AsyncSession) -> None:
        await polar_self._apply_support(session_mock, ORG_A, None)

    async def test_invalid_metadata_raises(self, session_mock: AsyncSession) -> None:
        grant = _make_support_grant(level="two")

        with pytest.raises(SupportBenefitError):
            await polar_self._apply_support(session_mock, ORG_A, grant)


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
            "fee_percent": None,
            "fee_fixed": None,
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
