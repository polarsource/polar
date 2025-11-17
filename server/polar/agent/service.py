"""Service layer for Agent Core - business logic."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent.enums import AgentType
from polar.agent.repository import (
    AgentRepository,
    ConversationRepository,
    MessageRepository,
)
from polar.agent.schemas import (
    AgentCreate,
    AgentUpdate,
    ConversationCreate,
    MessageCreate,
)
from polar.models import Agent, Conversation, Message


class AgentService:
    """Service for managing AI agents."""

    async def create(
        self, session: AsyncSession, create_schema: AgentCreate
    ) -> Agent:
        """Create a new agent."""
        agent = Agent(
            organization_id=create_schema.organization_id,
            name=create_schema.name,
            agent_type=create_schema.agent_type,
            personality=create_schema.personality,
            tools=create_schema.tools,
            rules=create_schema.rules,
            config=create_schema.config,
            status="active",
        )

        session.add(agent)
        await session.flush()

        return agent

    async def get(self, session: AsyncSession, agent_id: UUID) -> Agent | None:
        """Get agent by ID."""
        repo = AgentRepository.from_session(session)
        return await repo.get_by_id(agent_id)

    async def update(
        self,
        session: AsyncSession,
        agent: Agent,
        update_schema: AgentUpdate,
    ) -> Agent:
        """Update agent."""
        if update_schema.name is not None:
            agent.name = update_schema.name
        if update_schema.agent_type is not None:
            agent.agent_type = update_schema.agent_type
        if update_schema.personality is not None:
            agent.personality = update_schema.personality
        if update_schema.system_prompt is not None:
            agent.system_prompt = update_schema.system_prompt
        if update_schema.tools is not None:
            agent.tools = update_schema.tools
        if update_schema.rules is not None:
            agent.rules = update_schema.rules
        if update_schema.config is not None:
            agent.config = update_schema.config
        if update_schema.status is not None:
            agent.status = update_schema.status

        session.add(agent)
        await session.flush()

        return agent

    async def list_by_organization(
        self, session: AsyncSession, organization_id: UUID
    ) -> list[Agent]:
        """List agents for organization."""
        repo = AgentRepository.from_session(session)
        return await repo.get_by_organization(organization_id)

    async def get_default_agent(
        self,
        session: AsyncSession,
        organization_id: UUID,
        agent_type: AgentType = AgentType.SALES,
    ) -> Agent | None:
        """Get or create default agent for organization."""
        repo = AgentRepository.from_session(session)
        agent = await repo.get_default_agent(organization_id, agent_type)

        if not agent:
            # Create default agent if none exists
            agent = await self.create(
                session,
                AgentCreate(
                    organization_id=organization_id,
                    name=f"{agent_type.title()} Agent",
                    agent_type=agent_type,
                    personality={
                        "tone": "friendly",
                        "verbosity": "medium",
                        "proactive": True,
                        "greeting": "Hi! How can I help you today?",
                    },
                    tools={
                        "product_lookup": True,
                        "payment_link": True,
                        "shipping_calculator": True,
                        "inventory_checker": True,
                    },
                    rules={
                        "max_discount_percent": 15,
                        "require_approval_above": 15,
                        "allow_dynamic_pricing": True,
                        "price_bounds": {"min": 0.7, "max": 1.0},
                    },
                    config={
                        "llm_provider": "anthropic",
                        "llm_model": "claude-3-5-sonnet-20250219",
                        "temperature": 0.7,
                        "max_tokens": 500,
                    },
                ),
            )

        return agent


class ConversationService:
    """Service for managing conversations."""

    async def create(
        self, session: AsyncSession, create_schema: ConversationCreate
    ) -> Conversation:
        """Create a new conversation."""
        # Get or create default agent if not specified
        agent_id = create_schema.agent_id
        if not agent_id:
            agent_service = AgentService()
            agent = await agent_service.get_default_agent(
                session, create_schema.organization_id
            )
            if not agent:
                raise ValueError("No agent available")
            agent_id = agent.id

        conversation = Conversation(
            organization_id=create_schema.organization_id,
            agent_id=agent_id,
            customer_id=create_schema.customer_id,
            session_id=create_schema.session_id,
            channel=create_schema.channel,
            status="active",
            stage="discovery",
            message_count=0,
            customer_message_count=0,
            agent_message_count=0,
            hesitation_signals=0,
            context=create_schema.metadata,
            agent_state={},
            negotiation_history=[],
            metadata=create_schema.metadata,
        )

        session.add(conversation)
        await session.flush()

        return conversation

    async def get(
        self, session: AsyncSession, conversation_id: UUID
    ) -> Conversation | None:
        """Get conversation by ID."""
        repo = ConversationRepository.from_session(session)
        return await repo.get_by_id(conversation_id)

    async def get_by_session(
        self, session: AsyncSession, session_id: str
    ) -> Conversation | None:
        """Get conversation by session ID."""
        repo = ConversationRepository.from_session(session)
        return await repo.get_by_session(session_id)

    async def get_or_create(
        self, session: AsyncSession, session_id: str, organization_id: UUID
    ) -> Conversation:
        """Get existing conversation or create new one."""
        conversation = await self.get_by_session(session, session_id)

        if not conversation:
            conversation = await self.create(
                session,
                ConversationCreate(
                    organization_id=organization_id,
                    session_id=session_id,
                    channel="web",
                ),
            )

        return conversation

    async def update_context(
        self,
        session: AsyncSession,
        conversation: Conversation,
        context_update: dict,
    ) -> Conversation:
        """Update conversation context."""
        conversation.context = {**conversation.context, **context_update}
        conversation.modified_at = datetime.utcnow()

        session.add(conversation)
        await session.flush()

        return conversation

    async def update_stage(
        self,
        session: AsyncSession,
        conversation: Conversation,
        stage: str,
    ) -> Conversation:
        """Update conversation stage."""
        conversation.stage = stage
        conversation.modified_at = datetime.utcnow()

        session.add(conversation)
        await session.flush()

        return conversation

    async def increment_hesitation(
        self, session: AsyncSession, conversation: Conversation
    ) -> Conversation:
        """Increment hesitation signal counter (for dynamic pricing)."""
        conversation.hesitation_signals += 1
        conversation.modified_at = datetime.utcnow()

        session.add(conversation)
        await session.flush()

        return conversation

    async def close(
        self, session: AsyncSession, conversation: Conversation
    ) -> Conversation:
        """Close conversation."""
        conversation.status = "closed"
        conversation.modified_at = datetime.utcnow()

        session.add(conversation)
        await session.flush()

        return conversation


class MessageService:
    """Service for managing messages."""

    async def create_user_message(
        self,
        session: AsyncSession,
        conversation: Conversation,
        message: MessageCreate,
    ) -> Message:
        """Create user message."""
        msg = Message(
            conversation_id=conversation.id,
            role="user",
            content=message.content,
            entities={},
            tool_calls=[],
            attachments=[],
            metadata=message.context,
        )

        session.add(msg)

        # Update conversation
        conversation.message_count += 1
        conversation.customer_message_count += 1
        conversation.last_message_at = datetime.utcnow()
        conversation.last_customer_message_at = datetime.utcnow()
        session.add(conversation)

        await session.flush()

        return msg

    async def create_agent_message(
        self,
        session: AsyncSession,
        conversation: Conversation,
        content: str,
        action: str | None = None,
        tool_calls: list | None = None,
        attachments: list | None = None,
        llm_provider: str | None = None,
        llm_model: str | None = None,
        response_time_ms: int | None = None,
    ) -> Message:
        """Create agent message."""
        msg = Message(
            conversation_id=conversation.id,
            role="agent",
            content=content,
            action=action,
            tool_calls=tool_calls or [],
            attachments=attachments or [],
            llm_provider=llm_provider,
            llm_model=llm_model,
            response_time_ms=response_time_ms,
            entities={},
            metadata={},
        )

        session.add(msg)

        # Update conversation
        conversation.message_count += 1
        conversation.agent_message_count += 1
        conversation.last_message_at = datetime.utcnow()
        session.add(conversation)

        await session.flush()

        return msg

    async def get_conversation_messages(
        self,
        session: AsyncSession,
        conversation_id: UUID,
        limit: int = 100,
    ) -> list[Message]:
        """Get all messages for a conversation."""
        repo = MessageRepository.from_session(session)
        return await repo.get_by_conversation(conversation_id, limit=limit)

    async def get_recent_for_context(
        self, session: AsyncSession, conversation_id: UUID, limit: int = 10
    ) -> list[Message]:
        """Get recent messages for LLM context window."""
        repo = MessageRepository.from_session(session)
        return await repo.get_recent_for_context(conversation_id, limit=limit)


# Service instances
agent_service = AgentService()
conversation_service = ConversationService()
message_service = MessageService()
