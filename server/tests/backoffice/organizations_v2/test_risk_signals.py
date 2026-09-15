from datetime import UTC, datetime
from typing import Any

from tagflow import document

from polar.backoffice.organizations_v2.views.sections.risk_signals import (
    render_risk_signals_card,
)
from polar.models import OrganizationRiskSignal


def build_signal(
    type: OrganizationRiskSignal.Type,
    payload: dict[str, Any],
    description: str | None = None,
) -> OrganizationRiskSignal:
    signal = OrganizationRiskSignal(
        source=OrganizationRiskSignal.Source.STRIPE,
        type=type,
        risk_level="elevated",
        description=description,
        payload=payload,
    )
    signal.created_at = datetime(2026, 8, 13, 15, 48, tzinfo=UTC)
    return signal


def render(signal: OrganizationRiskSignal) -> str:
    with document() as doc:
        render_risk_signals_card([signal])
    return doc.to_html()


class TestRenderRiskSignalsCard:
    def test_website_citations_link_to_their_source(self) -> None:
        html = render(
            build_signal(
                OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE,
                {
                    "details": (
                        "No verifiable identity.\n"
                        "\n"
                        "NOTES: The contact page is empty [2].\n"
                        "\n"
                        "[1] https://example.com/\n"
                        "[2] https://example.com/contact"
                    )
                },
            )
        )

        assert 'href="https://example.com/contact"' in html
        assert "The contact page is empty" in html

    def test_website_citation_without_a_source_stays_as_text(self) -> None:
        html = render(
            build_signal(
                OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE,
                {"details": "Risky.\n\nNOTES: Nothing to see [7]."},
            )
        )

        assert "Nothing to see [7]." in html
        assert "<a" not in html

    def test_non_web_source_is_not_linked(self) -> None:
        html = render(
            build_signal(
                OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE,
                {"details": ("Risky.\n\nNOTES: See [1].\n\n[1] javascript:alert(1)")},
            )
        )

        assert "javascript:alert(1)" in html
        assert "href=" not in html

    def test_merchant_indicators_are_labelled(self) -> None:
        html = render(
            build_signal(
                OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT,
                {
                    "fraudulent_merchant": {
                        "probability": "52.81",
                        "indicators": [
                            {
                                "indicator": "geolocation",
                                "impact": "strong_increase",
                                "description": "Login country mismatch.",
                            }
                        ],
                    }
                },
            )
        )

        assert "Fraud probability: 52.81%" in html
        assert "Geolocation" in html
        assert "Strong increase" in html
        assert "Login country mismatch." in html

    def test_unparsable_payload_falls_back_to_the_description(self) -> None:
        html = render(
            build_signal(
                OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT,
                {"unexpected": "shape"},
                description="Stored description.",
            )
        )

        assert "Stored description." in html
