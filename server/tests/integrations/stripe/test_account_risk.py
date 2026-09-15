from datetime import UTC, datetime

from polar.integrations.stripe.account_risk import (
    MerchantRiskSignal,
    StripeAccountRiskLevel,
    WebsiteRiskSignal,
    is_account_risk_event,
    parse_account_signal,
    parse_merchant_payload,
    parse_website_payload,
)

WEBSITE = "v2.signals.account_signal.fraudulent_website_ready"
MERCHANT = "v2.signals.account_signal.fraudulent_merchant_ready"

MERCHANT_PAYLOAD = {
    "id": "acctsig_123",
    "type": "fraudulent_merchant",
    "account": "acct_123",
    "evaluated_at": "2026-08-13T15:47:44.000Z",
    "fraudulent_merchant": {
        "risk_level": "elevated",
        "probability": "52.81",
        "indicators": [
            {
                "impact": "strong_increase",
                "indicator": "business_information_and_account_activity",
                "description": "The domain was created days before the application.",
            },
            {
                "impact": "neutral",
                "indicator": "other_related_accounts",
                "description": "No related accounts.",
            },
        ],
    },
}

WEBSITE_DETAILS = (
    "This merchant is high risk because there is no verifiable identity.\n"
    "\n"
    "NOTES: The site lists no legal name [1]. The terms conflict [2].\n"
    "\n"
    "[1] https://example.com/\n"
    "[2] https://example.com/legal"
)

WEBSITE_PAYLOAD = {
    "account": "acct_456",
    "signal_id": "acctsig_456",
    "evaluation_id": "acctevl_456",
    "evaluated_at": "2026-08-14T13:54:35.801Z",
    "risk_level": "elevated",
    "details": WEBSITE_DETAILS,
}

MERCHANT_SIGNAL = {
    "id": "acctsig_123",
    "object": "v2.signals.account_signal",
    "created": "2026-08-13T15:47:44.000Z",
    "type": "fraudulent_merchant",
    "account_details": {"account": "acct_123"},
    "fraudulent_merchant": {
        "risk_level": "elevated",
        "probability": "53.75",
        "indicators": [
            {
                "indicator": "owner_email",
                "impact": "slight_increase",
                "explanation": "Shares an owner email with a suspicious account.",
            }
        ],
    },
}

WEBSITE_SIGNAL = {
    "id": "acctsig_456",
    "object": "v2.signals.account_signal",
    "type": "fraudulent_website",
    "account_evaluation": "acctevl_456",
    "account_details": {
        "data": {"defaults": {"profile": {"business_url": "https://example.com"}}},
    },
    "created": "2026-08-14T13:54:35.801Z",
    "fraudulent_website": {
        "risk_level": "elevated",
        "details": WEBSITE_DETAILS,
    },
}


class TestIsAccountRiskEvent:
    def test_known_events(self) -> None:
        assert is_account_risk_event(WEBSITE)
        assert is_account_risk_event(MERCHANT)

    def test_other(self) -> None:
        assert not is_account_risk_event("charge.succeeded")
        assert not is_account_risk_event(
            "v2.core.account_signals.fraudulent_website_ready"
        )


class TestParseAccountSignal:
    def test_merchant(self) -> None:
        result = parse_account_signal(MERCHANT_SIGNAL)

        assert isinstance(result, MerchantRiskSignal)
        assert result.account_id == "acct_123"
        assert result.risk_level == StripeAccountRiskLevel.ELEVATED
        assert result.description is not None
        assert "owner_email" in result.description

    def test_website(self) -> None:
        result = parse_account_signal(WEBSITE_SIGNAL)

        assert isinstance(result, WebsiteRiskSignal)
        assert result.evaluation_id == "acctevl_456"
        assert result.risk_level == StripeAccountRiskLevel.ELEVATED
        assert result.description is not None
        assert "no verifiable identity" in result.description

    def test_unknown_type_returns_none(self) -> None:
        assert parse_account_signal({"type": "merchant_delinquency"}) is None

    def test_merchant_without_account_returns_none(self) -> None:
        assert parse_account_signal({"type": "fraudulent_merchant"}) is None

    def test_website_without_evaluation_id_returns_none(self) -> None:
        assert parse_account_signal({"type": "fraudulent_website"}) is None


class TestParseMerchantPayload:
    def test_valid(self) -> None:
        payload = parse_merchant_payload(MERCHANT_PAYLOAD)

        assert payload is not None
        assert payload.probability == 52.81
        assert payload.account_id == "acct_123"
        assert payload.signal_id == "acctsig_123"
        assert payload.evaluated_at == datetime(2026, 8, 13, 15, 47, 44, tzinfo=UTC)
        assert [indicator.indicator for indicator in payload.indicators] == [
            "business_information_and_account_activity",
            "other_related_accounts",
        ]

        later = parse_merchant_payload(MERCHANT_SIGNAL)
        assert later is not None
        assert later.indicators[0].description == (
            "Shares an owner email with a suspicious account."
        )


class TestParseWebsitePayload:
    def test_valid(self) -> None:
        payload = parse_website_payload(WEBSITE_PAYLOAD)

        assert payload is not None
        assert payload.summary == (
            "This merchant is high risk because there is no verifiable identity."
        )
        assert payload.notes == [
            "The site lists no legal name [1]. The terms conflict [2]."
        ]
        assert payload.references == {
            1: "https://example.com/",
            2: "https://example.com/legal",
        }
        assert payload.account_id == "acct_456"
        assert payload.signal_id == "acctsig_456"

        nested = parse_website_payload(WEBSITE_SIGNAL)
        assert nested is not None
        assert nested.summary == payload.summary

    def test_non_web_source_stays_in_the_text(self) -> None:
        payload = parse_website_payload(
            {
                "details": (
                    "Suspicious.\n"
                    "\n"
                    "NOTES: See [1] and [2].\n"
                    "\n"
                    "[1] javascript:alert(1)\n"
                    "[2] https://example.com/legal"
                )
            }
        )

        assert payload is not None
        assert payload.references == {2: "https://example.com/legal"}
        assert "[1] javascript:alert(1)" in payload.notes[-1]
