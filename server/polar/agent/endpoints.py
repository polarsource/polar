"""API endpoints for Agent Core."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent import auth
from polar.agent.schemas import (
    AgentCreate,
    AgentPublic,
    AgentResponse,
    AgentUpdate,
    ConversationCreate,
    ConversationPublic,
    MessageCreate,
    MessagePublic,
)
from polar.agent.service import (
    agent_service,
    conversation_service,
    message_service,
)
from polar.postgres import AsyncReadSession, get_db_read_session, get_db_session

router = APIRouter(prefix="/agent", tags=["agent"])

# ==============================================================================
# AGENT MANAGEMENT ENDPOINTS (Merchant/Admin)
# ==============================================================================


@router.post("/agents", response_model=AgentPublic, status_code=201)
async def create_agent(
    agent_create: AgentCreate,
    auth_subject: auth.AgentWrite,
    session: AsyncSession = Depends(get_db_session),
) -> AgentPublic:
    """
    Create a new AI agent.

    Requires: Organization or User authentication
    """
    agent = await agent_service.create(session, agent_create)
    return AgentPublic.model_validate(agent)


@router.get("/agents", response_model=list[AgentPublic])
async def list_agents(
    organization_id: Annotated[UUID, Query()],
    auth_subject: auth.AgentRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[AgentPublic]:
    """
    List all agents for an organization.

    Requires: Organization or User authentication
    """
    agents = await agent_service.list_by_organization(session, organization_id)
    return [AgentPublic.model_validate(a) for a in agents]


@router.get("/agents/{id}", response_model=AgentPublic)
async def get_agent(
    id: Annotated[UUID, Path()],
    auth_subject: auth.AgentRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> AgentPublic:
    """
    Get agent by ID.

    Requires: Organization or User authentication
    """
    agent = await agent_service.get(session, id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return AgentPublic.model_validate(agent)


@router.patch("/agents/{id}", response_model=AgentPublic)
async def update_agent(
    id: Annotated[UUID, Path()],
    agent_update: AgentUpdate,
    auth_subject: auth.AgentWrite,
    session: AsyncSession = Depends(get_db_session),
) -> AgentPublic:
    """
    Update agent configuration.

    Requires: Organization or User authentication
    """
    agent = await agent_service.get(session, id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = await agent_service.update(session, agent, agent_update)
    return AgentPublic.model_validate(agent)


# ==============================================================================
# CONVERSATION ENDPOINTS (Public - embedded chat widget)
# ==============================================================================


@router.post("/conversations", response_model=ConversationPublic, status_code=201)
async def create_conversation(
    conversation_create: ConversationCreate,
    session: AsyncSession = Depends(get_db_session),
) -> ConversationPublic:
    """
    Create a new conversation.

    This is called when a customer opens the chat widget.
    No authentication required (public endpoint).
    """
    conversation = await conversation_service.create(session, conversation_create)
    return ConversationPublic.model_validate(conversation)


@router.get("/conversations/{id}", response_model=ConversationPublic)
async def get_conversation(
    id: Annotated[UUID, Path()],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ConversationPublic:
    """
    Get conversation by ID.

    No authentication required (uses conversation ID as secret).
    """
    conversation = await conversation_service.get(session, id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationPublic.model_validate(conversation)


@router.get("/conversations/session/{session_id}", response_model=ConversationPublic)
async def get_conversation_by_session(
    session_id: Annotated[str, Path()],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ConversationPublic:
    """
    Get conversation by session ID.

    No authentication required (uses session ID as secret).
    """
    conversation = await conversation_service.get_by_session(session, session_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationPublic.model_validate(conversation)


@router.post("/conversations/{id}/messages", response_model=AgentResponse)
async def send_message(
    id: Annotated[UUID, Path()],
    message: MessageCreate,
    session: AsyncSession = Depends(get_db_session),
) -> AgentResponse:
    """
    Send a message to the agent and get response.

    This is the main endpoint for chat interaction.
    No authentication required (public endpoint).

    Flow:
    1. Customer sends message
    2. Agent Core processes (intent → context → decision → tools → response)
    3. Returns agent message + updated conversation state
    """
    # Get conversation
    conversation = await conversation_service.get(session, id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Create user message
    user_message = await message_service.create_user_message(
        session, conversation, message
    )

    # Process with Agent Core (6-layer orchestration)
    from polar.agent_core import agent_orchestrator

    agent_message = await agent_orchestrator.process_message(
        session, conversation, user_message
    )

    # Commit changes
    await session.commit()

    # Return response
    return AgentResponse(
        message=MessagePublic.model_validate(agent_message),
        conversation=ConversationPublic.model_validate(conversation),
    )


@router.get("/conversations/{id}/messages", response_model=list[MessagePublic])
async def get_conversation_messages(
    id: Annotated[UUID, Path()],
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[MessagePublic]:
    """
    Get message history for a conversation.

    No authentication required.
    """
    messages = await message_service.get_conversation_messages(
        session, id, limit=limit
    )
    return [MessagePublic.model_validate(m) for m in messages]


# ==============================================================================
# WEBSOCKET ENDPOINT (Real-time chat)
# ==============================================================================


@router.websocket("/conversations/{id}/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    id: Annotated[UUID, Path()],
) -> None:
    """
    WebSocket endpoint for real-time chat.

    Connect using:
    ws://localhost:8000/v1/agent/conversations/{id}/ws

    Message format:
    {
        "type": "message",
        "content": "Hello",
        "context": {}
    }

    Response format:
    {
        "type": "agent_message",
        "message": {...}
    }
    """
    from polar.agent.websocket import websocket_handler

    await websocket_handler.handle_connection(websocket, id)


# ==============================================================================
# STREAMING ENDPOINT (Server-Sent Events)
# ==============================================================================


@router.post("/conversations/{id}/messages/stream")
async def send_message_stream(
    id: Annotated[UUID, Path()],
    message: MessageCreate,
    session: AsyncSession = Depends(get_db_session),
):
    """
    Send a message and stream agent response (Server-Sent Events).

    Use this for streaming responses in web clients.

    Response format (SSE):
    data: {"type": "thinking", "content": "Understanding..."}

    data: {"type": "intent", "content": "product_query"}

    data: {"type": "content", "chunk": "I'd be happy..."}

    data: {"type": "done", "message_id": "..."}

    """
    from fastapi.responses import StreamingResponse
    from polar.agent.streaming import streaming_handler

    # Get conversation
    conversation = await conversation_service.get(session, id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Create user message
    user_message = await message_service.create_user_message(
        session, conversation, message
    )

    # Stream response
    return StreamingResponse(
        streaming_handler.stream_to_sse(session, conversation, user_message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
