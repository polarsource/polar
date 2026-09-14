from datetime import UTC, datetime

from polar.integrations.stripe.account_risk import (
    StripeAccountRiskLevel,
    is_account_risk_event,
    parse_account_risk_event,
    parse_account_signal,
    parse_merchant_payload,
    parse_website_payload,
    related_object_id,
)
from polar.models import OrganizationRiskSignal

WEBSITE = "v2.core.account_signals.fraudulent_website_ready"
WEBSITE_SIGNALS = "v2.signals.account_signal.fraudulent_website_ready"
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

WEBSITE_PAYLOAD = {
    "account": "acct_456",
    "signal_id": "acctsig_456",
    "evaluation_id": "acctevl_456",
    "evaluated_at": "2026-08-14T13:54:35.801Z",
    "risk_level": "elevated",
    "details": (
        "This merchant is high risk because there is no verifiable identity.\n"
        "\n"
        "NOTES: The site lists no legal name [1]. The terms conflict [2].\n"
        "\n"
        "[1] https://example.com/\n"
        "[2] https://example.com/legal"
    ),
}

# Shape returned by GET /v2/signals/account_signals/:id (2026-08-26.preview).
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
            },
            {
                "indicator": "geolocation",
                "impact": "slight_increase",
                "explanation": "Merchant country and login country do not match.",
            },
        ],
    },
    "livemode": False,
}

WEBSITE_SIGNAL = {
    "id": "acctsig_456",
    "object": "v2.signals.account_signal",
    "type": "fraudulent_website",
    "account_details": {"account": "acct_456"},
    "account_evaluation": "acctevl_456",
    "created": "2026-08-14T13:54:35.801Z",
    "fraudulent_website": {
        "risk_level": "elevated",
        "details": WEBSITE_PAYLOAD["details"],
    },
}


class TestIsAccountRiskEvent:
    def test_website(self) -> None:
        assert is_account_risk_event(WEBSITE)

    def test_merchant(self) -> None:
        assert is_account_risk_event(MERCHANT)

    def test_website_signals_api(self) -> None:
        assert is_account_risk_event(WEBSITE_SIGNALS)

    def test_other(self) -> None:
        assert not is_account_risk_event("charge.succeeded")
        assert not is_account_risk_event("v2.signals.account_evaluation.complete")


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

    def test_merchant_account_signal_snapshot(self) -> None:
        result = parse_account_risk_event({"type": MERCHANT, "data": MERCHANT_SIGNAL})
        assert result is not None
        assert result.account_id == "acct_123"
        assert result.risk_level == StripeAccountRiskLevel.ELEVATED
        assert result.description is not None
        assert "owner_email" in result.description

    def test_website_signals_event_with_nested_details(self) -> None:
        result = parse_account_risk_event(
            {"type": WEBSITE_SIGNALS, "data": WEBSITE_SIGNAL}
        )
        assert result is not None
        assert result.account_id == "acct_456"
        assert result.type == OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE

    def test_empty_data_returns_none(self) -> None:
        assert parse_account_risk_event({"type": MERCHANT, "data": {}}) is None


class TestParseAccountSignal:
    def test_merchant_from_account_signal_resource(self) -> None:
        result = parse_account_signal(MERCHANT_SIGNAL)

        assert result is not None
        assert result.type == OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT
        assert result.account_id == "acct_123"
        assert result.risk_level == StripeAccountRiskLevel.ELEVATED
        assert result.description is not None
        assert "owner_email" in result.description
        assert "53.75%" in result.description
        assert result.payload["id"] == "acctsig_123"

    def test_website_from_account_signal_resource(self) -> None:
        result = parse_account_signal(WEBSITE_SIGNAL)

        assert result is not None
        assert result.type == OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE
        assert result.account_id == "acct_456"
        assert result.risk_level == StripeAccountRiskLevel.ELEVATED
        assert result.description is not None
        assert "no verifiable identity" in result.description

    def test_unknown_type_returns_none(self) -> None:
        assert parse_account_signal({"type": "merchant_delinquency"}) is None

    def test_missing_account_returns_none(self) -> None:
        assert (
            parse_account_signal(
                {"type": "fraudulent_merchant", "fraudulent_merchant": {}}
            )
            is None
        )


class TestRelatedObjectId:
    def test_reads_id(self) -> None:
        assert (
            related_object_id(
                {
                    "related_object": {
                        "id": "acctsig_123",
                        "type": "v2.signals.account_signal",
                        "url": "/v2/signals/account_signals/acctsig_123",
                    }
                }
            )
            == "acctsig_123"
        )

    def test_missing_returns_none(self) -> None:
        assert related_object_id({}) is None
        assert related_object_id({"related_object": "acctsig_123"}) is None


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

    def test_account_signal_resource_uses_explanation_and_account_details(self) -> None:
        payload = parse_merchant_payload(MERCHANT_SIGNAL)

        assert payload is not None
        assert payload.probability == 53.75
        assert payload.account_id == "acct_123"
        assert payload.signal_id == "acctsig_123"
        assert payload.evaluated_at == datetime(2026, 8, 13, 15, 47, 44, tzinfo=UTC)
        assert payload.indicators[0].indicator == "owner_email"
        assert payload.indicators[0].description == (
            "Shares an owner email with a suspicious account."
        )

    def test_missing_inner_object(self) -> None:
        assert parse_merchant_payload({"account": "acct_123"}) is None

    def test_nothing_to_show_returns_none(self) -> None:
        assert parse_merchant_payload({"fraudulent_merchant": {}}) is None

    def test_unparsable_probability(self) -> None:
        assert (
            parse_merchant_payload(
                {"fraudulent_merchant": {"probability": "not a number"}}
            )
            is None
        )

    def test_indicators_without_probability(self) -> None:
        payload = parse_merchant_payload(
            {"fraudulent_merchant": {"indicators": [{"indicator": "geolocation"}]}}
        )

        assert payload is not None
        assert payload.probability is None
        assert payload.evaluated_at is None
        assert payload.indicators[0].indicator == "geolocation"


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

    def test_nested_account_signal_details(self) -> None:
        payload = parse_website_payload(WEBSITE_SIGNAL)

        assert payload is not None
        assert payload.summary == (
            "This merchant is high risk because there is no verifiable identity."
        )
        assert payload.account_id == "acct_456"
        assert payload.signal_id == "acctsig_456"
        assert payload.evaluated_at == datetime(
            2026, 8, 14, 13, 54, 35, 801000, tzinfo=UTC
        )

    def test_missing_details(self) -> None:
        assert parse_website_payload({"account": "acct_456"}) is None
        assert parse_website_payload({"details": "   "}) is None

    def test_details_without_notes_or_references(self) -> None:
        payload = parse_website_payload({"details": "Nothing suspicious."})

        assert payload is not None
        assert payload.summary == "Nothing suspicious."
        assert payload.notes == []
        assert payload.references == {}

    def test_unparsable_evaluated_at(self) -> None:
        payload = parse_website_payload(
            {"details": "Suspicious.", "evaluated_at": "last tuesday"}
        )

        assert payload is not None
        assert payload.evaluated_at is None

    def test_evaluated_at_is_converted_to_utc(self) -> None:
        payload = parse_website_payload(
            {"details": "Suspicious.", "evaluated_at": "2026-08-14T15:54:35+02:00"}
        )

        assert payload is not None
        assert payload.evaluated_at == datetime(2026, 8, 14, 13, 54, 35, tzinfo=UTC)

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
