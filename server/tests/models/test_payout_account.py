from typing import Any

import pytest

from polar.enums import PayoutAccountStatus, PayoutAccountType
from polar.models import PayoutAccount


def build_payout_account(
    *,
    type: PayoutAccountType = PayoutAccountType.stripe,
    stripe_id: str | None = "STRIPE_ID",
    is_details_submitted: bool = True,
    is_payouts_enabled: bool = False,
    disabled_reason: str | None = None,
) -> PayoutAccount:
    data: dict[str, Any] = {"requirements": {"disabled_reason": disabled_reason}}
    return PayoutAccount(
        type=type,
        stripe_id=stripe_id,
        country="US",
        currency="usd",
        is_details_submitted=is_details_submitted,
        is_charges_enabled=True,
        is_payouts_enabled=is_payouts_enabled,
        data=data,
    )


class TestStatus:
    def test_ready(self) -> None:
        payout_account = build_payout_account(is_payouts_enabled=True)
        assert payout_account.status == PayoutAccountStatus.ready

    def test_manual_account_is_ready(self) -> None:
        payout_account = build_payout_account(
            type=PayoutAccountType.manual, stripe_id=None
        )
        assert payout_account.status == PayoutAccountStatus.ready

    def test_details_not_submitted(self) -> None:
        payout_account = build_payout_account(is_details_submitted=False)
        assert payout_account.status == PayoutAccountStatus.incomplete

    def test_disconnected_account(self) -> None:
        payout_account = build_payout_account(stripe_id=None)
        assert payout_account.status == PayoutAccountStatus.incomplete

    @pytest.mark.parametrize(
        "disabled_reason",
        ["requirements.past_due", "action_required.requested_capabilities"],
    )
    def test_action_required(self, disabled_reason: str) -> None:
        payout_account = build_payout_account(disabled_reason=disabled_reason)
        assert payout_account.status == PayoutAccountStatus.incomplete

    @pytest.mark.parametrize(
        "disabled_reason",
        [None, "requirements.pending_verification", "under_review"],
    )
    def test_awaiting_stripe(self, disabled_reason: str | None) -> None:
        payout_account = build_payout_account(disabled_reason=disabled_reason)
        assert payout_account.status == PayoutAccountStatus.under_review

    @pytest.mark.parametrize(
        "disabled_reason",
        [
            "listed",
            "rejected.listed",
            "rejected.fraud",
            "rejected.terms_of_service",
            "platform_paused",
            "other",
            "a_reason_stripe_added_after_we_shipped_this",
        ],
    )
    def test_paused(self, disabled_reason: str) -> None:
        payout_account = build_payout_account(disabled_reason=disabled_reason)
        assert payout_account.status == PayoutAccountStatus.paused

    def test_missing_requirements(self) -> None:
        payout_account = PayoutAccount(
            type=PayoutAccountType.stripe,
            stripe_id="STRIPE_ID",
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=False,
            data={},
        )
        assert payout_account.status == PayoutAccountStatus.under_review
