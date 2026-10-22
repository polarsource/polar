from uuid import UUID

from sqlalchemy import update
from sqlalchemy.orm import joinedload

from polar.kit.crypto import get_token_hash_candidates
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositoryTokenHashMixin,
)
from polar.models import Agent, Organization


class AgentRepository(
    RepositoryTokenHashMixin[Agent],
    RepositorySoftDeletionIDMixin[Agent, UUID],
    RepositorySoftDeletionMixin[Agent],
    RepositoryBase[Agent],
):
    model = Agent
    token_hash_attribute = "claim_token_hash"

    async def set_organization(
        self, agent: Agent, organization: Organization
    ) -> Agent | None:
        """Atomically link the agent to the organization, unless it already has one.

        Returns ``None`` if the agent already has an organization, so two concurrent
        creations can't both link one.
        """
        statement = (
            update(Agent)
            .where(Agent.id == agent.id, Agent.organization_id.is_(None))
            .values(organization_id=organization.id)
            .returning(Agent)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_claim_token(self, claim_token: str) -> Agent | None:
        statement = (
            self.get_base_statement()
            .where(self.token_hash_clause(get_token_hash_candidates(claim_token)))
            .with_for_update()
        )
        return await self.get_one_or_none(statement)

    async def get_by_claim_link_token(
        self, link_token: str, *, for_update: bool = False
    ) -> Agent | None:
        statement = (
            self.get_base_statement()
            .where(
                self.token_hash_clause(
                    get_token_hash_candidates(link_token),
                    attribute="claim_link_token_hash",
                )
            )
            .options(joinedload(Agent.oauth2_client), joinedload(Agent.organization))
        )
        if for_update:
            statement = statement.with_for_update(of=Agent)
        return await self.get_one_or_none(statement)
