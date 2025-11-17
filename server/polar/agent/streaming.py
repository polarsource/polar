"""Streaming response handler for agent chat."""

import asyncio
import json
import logging
from typing import AsyncIterator, Any
from uuid import UUID

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent.service import conversation_service, message_service
from polar.agent_core.orchestrator import agent_orchestrator
from polar.agent_llm.base import LLMMessage
from polar.models import Conversation, Message

logger = logging.getLogger(__name__)


class StreamingHandler:
    """
    Handles streaming responses for agent chat.

    Features:
    - Server-Sent Events (SSE) for HTTP streaming
    - WebSocket streaming with chunks
    - Progress indicators
    - Partial response updates
    """

    async def stream_agent_response(
        self,
        session: AsyncSession,
        conversation: Conversation,
        user_message: Message,
    ) -> AsyncIterator[str]:
        """
        Stream agent response generation.

        Yields:
            JSON-encoded chunks as they're generated

        Flow:
            1. Understanding → {"type": "thinking", "content": "Understanding your message..."}
            2. Context enrichment → {"type": "thinking", "content": "Gathering context..."}
            3. Tool execution → {"type": "tool", "tool": "product_lookup", "status": "running"}
            4. Response streaming → {"type": "content", "chunk": "I'd be happy..."}
            5. Complete → {"type": "done", "message_id": "..."}
        """
        try:
            # Step 1: Understanding
            yield self._format_chunk("thinking", "Understanding your message...")

            understanding = await agent_orchestrator._understand_conversation(
                session, conversation, user_message
            )

            yield self._format_chunk(
                "intent",
                understanding["intent"].value,
                {
                    "confidence": understanding["confidence"],
                    "entities": understanding["entities"],
                },
            )

            # Step 2: Context Enrichment
            yield self._format_chunk("thinking", "Gathering relevant context...")

            enriched_context = await agent_orchestrator._enrich_context(
                session, conversation, understanding
            )

            # Step 3: Decision
            decision = await agent_orchestrator._make_decision(
                session, conversation, understanding, enriched_context
            )

            yield self._format_chunk(
                "action",
                decision["action"].value,
                {"parameters": decision["parameters"]},
            )

            # Step 4: Tool Invocation
            if decision["action"] != "general_response":
                yield self._format_chunk(
                    "tool",
                    f"Executing {decision['action']}...",
                    {"action": decision["action"].value},
                )

            tool_results = await agent_orchestrator._invoke_tools(session, decision)

            if tool_results:
                yield self._format_chunk(
                    "tool_result",
                    "Tools executed",
                    {"results": [r["tool"] for r in tool_results]},
                )

            # Step 5: Stream Response Generation
            yield self._format_chunk("generating", "Generating response...")

            # Build system prompt
            system_prompt = agent_orchestrator._build_system_prompt(
                conversation.agent, enriched_context
            )

            # Build conversation history
            llm_messages = [LLMMessage(role="system", content=system_prompt)]

            # Add recent history
            for msg in enriched_context["history"][-5:]:
                llm_messages.append(
                    LLMMessage(role=msg["role"], content=msg["content"])
                )

            # Add tool results context
            if tool_results:
                tool_context = agent_orchestrator._format_tool_results(tool_results)
                llm_messages.append(
                    LLMMessage(
                        role="system",
                        content=f"Tool execution results:\n{tool_context}",
                    )
                )

            # Stream from LLM
            full_content = ""
            async for chunk in agent_orchestrator.llm_client.chat(
                messages=llm_messages,
                model=conversation.agent.config.get(
                    "llm_model", "claude-3-5-sonnet-20241022"
                ),
                temperature=conversation.agent.personality.get("temperature", 0.7),
                max_tokens=conversation.agent.config.get("max_tokens", 1024),
                stream=True,
            ):
                full_content += chunk
                yield self._format_chunk("content", chunk)

            # Step 6: Update State
            await agent_orchestrator._update_state(
                session, conversation, understanding, decision
            )

            # Create agent message
            agent_message = await message_service.create_agent_message(
                session=session,
                conversation=conversation,
                content=full_content,
                intent=understanding["intent"].value,
                action=decision["action"].value,
                llm_provider="anthropic",
                llm_model=conversation.agent.config.get(
                    "llm_model", "claude-3-5-sonnet-20241022"
                ),
                tool_calls=tool_results,
            )

            # Final chunk with complete message
            yield self._format_chunk(
                "done",
                "Complete",
                {
                    "message_id": str(agent_message.id),
                    "conversation": {
                        "stage": conversation.stage,
                        "hesitation_signals": conversation.hesitation_signals,
                    },
                },
            )

        except Exception as e:
            logger.error(f"Error in streaming response: {e}", exc_info=True)
            yield self._format_chunk("error", str(e))

    async def stream_to_websocket(
        self,
        websocket: WebSocket,
        session: AsyncSession,
        conversation: Conversation,
        user_message: Message,
    ) -> None:
        """
        Stream agent response to WebSocket.

        Args:
            websocket: WebSocket connection
            session: Database session
            conversation: Conversation
            user_message: User's message
        """
        try:
            async for chunk in self.stream_agent_response(
                session, conversation, user_message
            ):
                await websocket.send_text(chunk)

        except Exception as e:
            logger.error(f"WebSocket streaming error: {e}", exc_info=True)
            await websocket.send_json({"type": "error", "error": str(e)})

    async def stream_to_sse(
        self,
        session: AsyncSession,
        conversation: Conversation,
        user_message: Message,
    ) -> AsyncIterator[str]:
        """
        Stream agent response as Server-Sent Events.

        Yields:
            SSE-formatted chunks

        Format:
            data: {"type": "content", "chunk": "Hello"}

            data: {"type": "done"}

        """
        async for chunk in self.stream_agent_response(
            session, conversation, user_message
        ):
            # Format as SSE
            yield f"data: {chunk}\n\n"

        # Send final SSE event
        yield "data: [DONE]\n\n"

    def _format_chunk(
        self, chunk_type: str, content: str, metadata: dict[str, Any] | None = None
    ) -> str:
        """Format chunk as JSON string."""
        chunk = {
            "type": chunk_type,
            "content": content,
        }

        if metadata:
            chunk.update(metadata)

        return json.dumps(chunk)


# Global streaming handler
streaming_handler = StreamingHandler()
