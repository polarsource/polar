"""WebSocket handler for real-time agent chat."""

import json
import logging
from typing import Any
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent.schemas import MessageCreate, MessagePublic
from polar.agent.service import conversation_service, message_service
from polar.postgres import async_session_maker

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time chat.

    Features:
    - Connection pooling per conversation
    - Broadcast to multiple clients
    - Automatic reconnection handling
    """

    def __init__(self):
        """Initialize connection manager."""
        # conversation_id -> list of WebSocket connections
        self.active_connections: dict[UUID, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, conversation_id: UUID) -> None:
        """
        Accept WebSocket connection and add to pool.

        Args:
            websocket: WebSocket connection
            conversation_id: Conversation ID
        """
        await websocket.accept()

        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []

        self.active_connections[conversation_id].append(websocket)
        logger.info(f"WebSocket connected: conversation={conversation_id}")

    def disconnect(self, websocket: WebSocket, conversation_id: UUID) -> None:
        """
        Remove WebSocket from pool.

        Args:
            websocket: WebSocket connection
            conversation_id: Conversation ID
        """
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].remove(websocket)

            # Clean up empty pools
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]

        logger.info(f"WebSocket disconnected: conversation={conversation_id}")

    async def send_message(
        self, message: dict[str, Any], conversation_id: UUID
    ) -> None:
        """
        Send message to specific conversation.

        Args:
            message: Message data
            conversation_id: Conversation ID
        """
        if conversation_id not in self.active_connections:
            return

        for connection in self.active_connections[conversation_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message: {e}")
                # Don't disconnect here, let the main loop handle it

    async def broadcast(
        self, message: dict[str, Any], conversation_id: UUID
    ) -> None:
        """
        Broadcast message to all clients in conversation.

        Args:
            message: Message data
            conversation_id: Conversation ID
        """
        await self.send_message(message, conversation_id)


# Global connection manager
manager = ConnectionManager()


class WebSocketHandler:
    """
    Handles WebSocket messages for agent chat.

    Message format:
    {
        "type": "message",
        "content": "Hello",
        "context": {}
    }

    Response format:
    {
        "type": "agent_message",
        "message": {...},
        "conversation": {...}
    }
    """

    def __init__(self, session_maker):
        """Initialize WebSocket handler."""
        self.session_maker = session_maker

    async def handle_connection(
        self, websocket: WebSocket, conversation_id: UUID
    ) -> None:
        """
        Handle WebSocket connection lifecycle.

        Args:
            websocket: WebSocket connection
            conversation_id: Conversation ID
        """
        async with self.session_maker() as session:
            # Validate conversation exists
            conversation = await conversation_service.get(session, conversation_id)
            if not conversation:
                await websocket.close(code=4004, reason="Conversation not found")
                return

            # Accept connection
            await manager.connect(websocket, conversation_id)

            try:
                # Send connection acknowledgment
                await websocket.send_json(
                    {
                        "type": "connected",
                        "conversation_id": str(conversation_id),
                        "message": "Connected to agent",
                    }
                )

                # Message loop
                while True:
                    # Receive message
                    data = await websocket.receive_text()
                    message_data = json.loads(data)

                    # Handle message
                    await self.handle_message(
                        session, websocket, conversation_id, message_data
                    )

            except WebSocketDisconnect:
                logger.info(f"Client disconnected: conversation={conversation_id}")
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                await websocket.close(code=1011, reason="Internal error")
            finally:
                manager.disconnect(websocket, conversation_id)

    async def handle_message(
        self,
        session: AsyncSession,
        websocket: WebSocket,
        conversation_id: UUID,
        message_data: dict[str, Any],
    ) -> None:
        """
        Handle incoming WebSocket message.

        Args:
            session: Database session
            websocket: WebSocket connection
            conversation_id: Conversation ID
            message_data: Message data
        """
        message_type = message_data.get("type", "message")

        if message_type == "message":
            await self.handle_user_message(
                session, websocket, conversation_id, message_data
            )
        elif message_type == "ping":
            # Heartbeat
            await websocket.send_json({"type": "pong"})
        elif message_type == "typing":
            # Broadcast typing indicator
            await manager.broadcast(
                {
                    "type": "typing",
                    "conversation_id": str(conversation_id),
                    "is_typing": message_data.get("is_typing", True),
                },
                conversation_id,
            )
        else:
            await websocket.send_json(
                {"type": "error", "error": f"Unknown message type: {message_type}"}
            )

    async def handle_user_message(
        self,
        session: AsyncSession,
        websocket: WebSocket,
        conversation_id: UUID,
        message_data: dict[str, Any],
    ) -> None:
        """
        Handle user message and generate agent response.

        Args:
            session: Database session
            websocket: WebSocket connection
            conversation_id: Conversation ID
            message_data: Message data
        """
        try:
            # Get conversation
            conversation = await conversation_service.get(session, conversation_id)
            if not conversation:
                await websocket.send_json(
                    {"type": "error", "error": "Conversation not found"}
                )
                return

            # Create user message
            message_create = MessageCreate(
                content=message_data.get("content", ""),
                context=message_data.get("context", {}),
            )

            user_message = await message_service.create_user_message(
                session, conversation, message_create
            )

            # Broadcast user message to all clients
            await manager.broadcast(
                {
                    "type": "user_message",
                    "message": MessagePublic.model_validate(user_message).model_dump(
                        mode="json"
                    ),
                },
                conversation_id,
            )

            # Process with Agent Core (6-layer orchestration)
            from polar.agent_core import agent_orchestrator

            agent_message = await agent_orchestrator.process_message(
                session, conversation, user_message
            )

            # Broadcast agent response
            await manager.broadcast(
                {
                    "type": "agent_message",
                    "message": MessagePublic.model_validate(agent_message).model_dump(
                        mode="json"
                    ),
                },
                conversation_id,
            )

            await session.commit()

        except Exception as e:
            logger.error(f"Error handling user message: {e}")
            await websocket.send_json(
                {"type": "error", "error": "Failed to process message"}
            )


# Global WebSocket handler
websocket_handler = WebSocketHandler(async_session_maker)
