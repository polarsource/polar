from typing import Any

from polar.models import Organization, OrganizationRiskSignal
from polar.postgres import AsyncSession

from .repository import OrganizationRiskSignalRepository


class RiskSignalService:
    async def record(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        source: OrganizationRiskSignal.Source,
        type: OrganizationRiskSignal.Type,
        risk_level: str,
        description: str | None = None,
        account_evaluation_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> OrganizationRiskSignal:
        repository = OrganizationRiskSignalRepository.from_session(session)
        return await repository.create(
            OrganizationRiskSignal(
                organization=organization,
                source=source,
                type=type,
                risk_level=risk_level,
                description=description,
                account_evaluation_id=account_evaluation_id,
                payload=payload or {},
            )
        )


risk_signal = RiskSignalService()
