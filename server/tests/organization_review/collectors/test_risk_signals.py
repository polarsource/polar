from datetime import UTC, datetime

from polar.models.organization_risk_signal import OrganizationRiskSignal
from polar.organization_review.collectors import collect_risk_signal_data


def _make_signal(
    *,
    risk_level: str = "elevated",
    description: str | None = "Indicators: suspicious_content. Probability: 87%",
) -> OrganizationRiskSignal:
    signal = OrganizationRiskSignal(
        source=OrganizationRiskSignal.Source.STRIPE,
        type=OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE,
        risk_level=risk_level,
        description=description,
        payload={"risk_level": risk_level},
    )
    signal.created_at = datetime(2026, 7, 1, tzinfo=UTC)
    return signal


class TestCollectRiskSignalData:
    def test_empty(self) -> None:
        data = collect_risk_signal_data([])
        assert data.entries == []

    def test_maps_fields(self) -> None:
        data = collect_risk_signal_data([_make_signal()])

        assert len(data.entries) == 1
        entry = data.entries[0]
        assert entry.source == "stripe"
        assert entry.type == "fraudulent_website"
        assert entry.risk_level == "elevated"
        assert entry.description == ("Indicators: suspicious_content. Probability: 87%")
        assert entry.created_at == datetime(2026, 7, 1, tzinfo=UTC)

    def test_no_description(self) -> None:
        data = collect_risk_signal_data([_make_signal(description=None)])
        assert data.entries[0].description is None
