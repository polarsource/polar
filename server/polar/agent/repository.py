from uuid import UUID

from sqlalchemy import update

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Agent, Organization


class AgentRepository(
    RepositorySoftDeletionIDMixin[Agent, UUID],
    RepositorySoftDeletionMixin[Agent],
    RepositoryBase[Agent],
):
    model = Agent

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
