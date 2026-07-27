from polar.integrations.stripe.account_risk import (
    StripeAccountRiskLevel,
    is_account_risk_event,
    parse_account_risk_event,
)
from polar.models import OrganizationRiskSignal

WEBSITE = "v2.core.account_signals.fraudulent_website_ready"
MERCHANT = "v2.signals.account_signal.fraudulent_merchant_ready"


class TestIsAccountRiskEvent:
    def test_website(self) -> None:
        assert is_account_risk_event(WEBSITE)

    def test_merchant(self) -> None:
        assert is_account_risk_event(MERCHANT)

    def test_other(self) -> None:
        assert not is_account_risk_event("charge.succeeded")


class TestParseAccountRiskEvent:
    def test_website(self) -> None:
        event = {
            "type": WEBSITE,
            "data": {
                "account": "acct_1",
                "risk_level": "elevated",
                "details": "Deceptive website",
            },
        }
        result = parse_account_risk_event(event)
        assert result is not None
        assert result.type == OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE
        assert result.account_id == "acct_1"
        assert result.risk_level == StripeAccountRiskLevel.ELEVATED
        assert result.description == "Deceptive website"
        assert result.payload == event["data"]

    def test_merchant_nested(self) -> None:
        event = {
            "type": MERCHANT,
            "data": {
                "account": "acct_2",
                "fraudulent_merchant": {
                    "risk_level": "highest",
                    "probability": "90",
                    "indicators": ["disputes", "failures"],
                },
            },
        }
        result = parse_account_risk_event(event)
        assert result is not None
        assert result.type == OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT
        assert result.account_id == "acct_2"
        assert result.risk_level == StripeAccountRiskLevel.HIGHEST
        assert result.description is not None
        assert "disputes" in result.description
        assert "90%" in result.description

    def test_wrong_type_returns_none(self) -> None:
        assert (
            parse_account_risk_event({"type": "charge.succeeded", "data": {}}) is None
        )

    def test_missing_account_returns_none(self) -> None:
        assert parse_account_risk_event({"type": WEBSITE, "data": {}}) is None

    def test_non_mapping_data_returns_none(self) -> None:
        assert parse_account_risk_event({"type": WEBSITE, "data": "garbage"}) is None

    def test_unknown_risk_level_falls_back(self) -> None:
        result = parse_account_risk_event(
            {"type": WEBSITE, "data": {"account": "a", "risk_level": "weird"}}
        )
        assert result is not None
        assert result.risk_level == StripeAccountRiskLevel.UNKNOWN

    def test_merchant_non_mapping_inner_is_unknown(self) -> None:
        result = parse_account_risk_event(
            {"type": MERCHANT, "data": {"account": "a", "fraudulent_merchant": "x"}}
        )
        assert result is not None
        assert result.risk_level == StripeAccountRiskLevel.UNKNOWN
