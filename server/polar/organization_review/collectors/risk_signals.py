from polar.models.organization_risk_signal import OrganizationRiskSignal

from ..schemas import RiskSignalData, RiskSignalEntry


def collect_risk_signal_data(
    signals: list[OrganizationRiskSignal],
) -> RiskSignalData:
    return RiskSignalData(
        entries=[
            RiskSignalEntry(
                source=signal.source,
                type=signal.type,
                risk_level=signal.risk_level,
                description=signal.description,
                created_at=signal.created_at,
            )
            for signal in signals
        ]
    )
