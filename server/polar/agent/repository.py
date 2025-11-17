"""Repository for Agent Core - data access layer."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.kit.db.repository import RepositoryBase
from polar.models import Agent, Conversation, Message


class AgentRepository(RepositoryBase[Agent]):
    """Repository for Agent model."""

    model = Agent

    async def get_by_organization(
        self, organization_id: UUID, agent_type: str | None = None
    ) -> list[Agent]:
        """Get all agents for an organization."""
        statement = select(Agent).where(
            Agent.organization_id == organization_id,
            Agent.deleted_at.is_(None),
        )

        if agent_type:
            statement = statement.where(Agent.agent_type == agent_type)

        statement = statement.where(Agent.status == "active")

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_default_agent(
        self, organization_id: UUID, agent_type: str = "sales"
    ) -> Agent | None:
        """Get default agent for organization."""
        agents = await self.get_by_organization(organization_id, agent_type)
        return agents[0] if agents else None


class ConversationRepository(RepositoryBase[Conversation]):
    """Repository for Conversation model."""

    model = Conversation

    async def get_by_session(self, session_id: str) -> Conversation | None:
        """Get conversation by session ID."""
        statement = (
            select(Conversation)
            .where(
                Conversation.session_id == session_id,
                Conversation.deleted_at.is_(None),
            )
            .options(
                joinedload(Conversation.agent),
                joinedload(Conversation.customer),
            )
        )

        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_by_customer(
        self,
        customer_id: UUID,
        organization_id: UUID,
        status: str | None = None,
    ) -> list[Conversation]:
        """Get all conversations for a customer."""
        statement = select(Conversation).where(
            Conversation.customer_id == customer_id,
            Conversation.organization_id == organization_id,
            Conversation.deleted_at.is_(None),
        )

        if status:
            statement = statement.where(Conversation.status == status)

        statement = statement.order_by(Conversation.created_at.desc())

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_active_by_organization(
        self, organization_id: UUID, limit: int = 100
    ) -> list[Conversation]:
        """Get active conversations for organization (merchant dashboard)."""
        statement = (
            select(Conversation)
            .where(
                Conversation.organization_id == organization_id,
                Conversation.status == "active",
                Conversation.deleted_at.is_(None),
            )
            .order_by(Conversation.last_message_at.desc())
            .limit(limit)
        )

        result = await self.session.execute(statement)
        return list(result.scalars().all())


class MessageRepository(RepositoryBase[Message]):
    """Repository for Message model."""

    model = Message

    async def get_by_conversation(
        self,
        conversation_id: UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Message]:
        """Get messages for a conversation."""
        statement = (
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
            )
            .order_by(Message.created_at.asc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_recent_for_context(
        self, conversation_id: UUID, limit: int = 10
    ) -> list[Message]:
        """Get recent messages for LLM context."""
        return await self.get_by_conversation(
            conversation_id, limit=limit, offset=0
        )

    async def count_by_conversation(self, conversation_id: UUID) -> int:
        """Count messages in a conversation."""
        statement = select(Message).where(
            Message.conversation_id == conversation_id,
            Message.deleted_at.is_(None),
        )

        result = await self.session.execute(statement)
        return len(list(result.scalars().all()))
