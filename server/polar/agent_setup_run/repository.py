from datetime import datetime
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from polar.kit.crypto import get_token_hash_candidates
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositoryTokenHashMixin,
)
from polar.models import AgentSetupRun


class AgentSetupRunRepository(
    RepositoryTokenHashMixin[AgentSetupRun],
    RepositorySoftDeletionIDMixin[AgentSetupRun, UUID],
    RepositorySoftDeletionMixin[AgentSetupRun],
    RepositoryBase[AgentSetupRun],
):
    model = AgentSetupRun
    token_hash_attribute = "code_hash"

    async def get_latest_by_organization(
        self, organization_id: UUID, *, for_update: bool = False
    ) -> AgentSetupRun | None:
        """The run with the most recent activity, so a run an agent is
        reporting to wins over a newer one nobody has used yet."""
        statement = (
            self.get_base_statement()
            .where(AgentSetupRun.organization_id == organization_id)
            .order_by(
                func.coalesce(
                    AgentSetupRun.modified_at, AgentSetupRun.created_at
                ).desc()
            )
            .limit(1)
        )
        if for_update:
            statement = statement.with_for_update()
        return await self.get_one_or_none(statement)

    async def get_by_code(
        self, code: str, *, created_after: datetime
    ) -> AgentSetupRun | None:
        statement = (
            self.get_base_statement()
            .where(
                self.token_hash_clause(get_token_hash_candidates(code)),
                AgentSetupRun.created_at > created_after,
            )
            .options(joinedload(AgentSetupRun.organization))
            .with_for_update(of=AgentSetupRun)
        )
        return await self.get_one_or_none(statement)
