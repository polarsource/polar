"""Agent Core Orchestrator - 6-layer system for conversational commerce."""

import logging
import time
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent.enums import Action, Intent
from polar.agent.service import conversation_service, message_service
from polar.agent_conversation.intent_classifier import intent_classifier
from polar.agent_llm.anthropic_client import AnthropicClient
from polar.agent_llm.base import LLMMessage, LLMTool
from polar.agent_tools.registry import tool_registry
from polar.models import Agent, Conversation, Message

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """
    Agent Core Orchestrator - 6-layer system.

    Layer 1: Conversation Understanding (intent + entities)
    Layer 2: Context Enrichment (history + profile + knowledge)
    Layer 3: Decision Engine (action selection)
    Layer 4: Tool Invocation (execute tools)
    Layer 5: Response Generation (LLM response)
    Layer 6: State Memory (update conversation state)

    Flow:
    User Message → Understand → Enrich → Decide → Execute Tools → Generate Response → Update State → Agent Response
    """

    def __init__(self):
        """Initialize orchestrator."""
        self.llm_client = AnthropicClient()
        self.intent_classifier = intent_classifier
        self.tool_registry = tool_registry

    async def process_message(
        self,
        session: AsyncSession,
        conversation: Conversation,
        user_message: Message,
    ) -> Message:
        """
        Process user message through 6-layer system.

        Args:
            session: Database session
            conversation: Current conversation
            user_message: User's message

        Returns:
            Agent's response message
        """
        start_time = time.time()
        logger.info(
            f"Processing message: conversation={conversation.id}, message={user_message.id}"
        )

        try:
            # Layer 1: Conversation Understanding
            understanding = await self._understand_conversation(
                session, conversation, user_message
            )

            # Layer 2: Context Enrichment
            enriched_context = await self._enrich_context(
                session, conversation, understanding
            )

            # Layer 3: Decision Engine
            decision = await self._make_decision(
                session, conversation, understanding, enriched_context
            )

            # Layer 4: Tool Invocation
            tool_results = await self._invoke_tools(session, decision)

            # Layer 5: Response Generation
            response_content = await self._generate_response(
                session,
                conversation,
                understanding,
                enriched_context,
                decision,
                tool_results,
            )

            # Layer 6: State Memory
            await self._update_state(session, conversation, understanding, decision)

            # Create agent message
            agent_message = await message_service.create_agent_message(
                session=session,
                conversation=conversation,
                content=response_content,
                intent=understanding["intent"].value,
                action=decision["action"].value,
                llm_provider="anthropic",
                llm_model="claude-3-5-sonnet-20241022",
                tool_calls=tool_results,
            )

            processing_time = int((time.time() - start_time) * 1000)
            logger.info(
                f"Message processed: {processing_time}ms, intent={understanding['intent']}, action={decision['action']}"
            )

            return agent_message

        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)

            # Create error response
            agent_message = await message_service.create_agent_message(
                session=session,
                conversation=conversation,
                content="I apologize, but I encountered an error processing your message. Please try again.",
                intent=Intent.UNKNOWN.value,
                action=Action.ERROR_RESPONSE.value,
                llm_provider="system",
            )

            return agent_message

    async def _understand_conversation(
        self,
        session: AsyncSession,
        conversation: Conversation,
        user_message: Message,
    ) -> dict[str, Any]:
        """
        Layer 1: Conversation Understanding.

        Classify intent and extract entities from user message.

        Args:
            session: Database session
            conversation: Current conversation
            user_message: User's message

        Returns:
            {
                "intent": Intent,
                "entities": {},
                "confidence": 0.95,
                "reasoning": "..."
            }
        """
        # Get conversation history
        messages = await message_service.get_conversation_messages(
            session, conversation.id, limit=10
        )

        history = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
            if msg.id != user_message.id
        ]

        # Classify intent
        result = await self.intent_classifier.classify(
            message=user_message.content,
            conversation_history=history,
            context=conversation.context,
        )

        return {
            "intent": result.intent,
            "entities": result.entities,
            "confidence": result.confidence,
            "reasoning": result.reasoning,
        }

    async def _enrich_context(
        self,
        session: AsyncSession,
        conversation: Conversation,
        understanding: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Layer 2: Context Enrichment.

        Enrich with conversation history, customer profile, and knowledge base.

        Args:
            session: Database session
            conversation: Current conversation
            understanding: Understanding from Layer 1

        Returns:
            Enriched context with history, profile, knowledge
        """
        # Get conversation history (last 10 messages)
        messages = await message_service.get_conversation_messages(
            session, conversation.id, limit=10
        )

        history = [
            {
                "role": msg.role,
                "content": msg.content,
                "intent": msg.intent,
                "timestamp": msg.created_at.isoformat(),
            }
            for msg in messages
        ]

        # Customer profile (if available)
        customer_profile = {}
        if conversation.customer_id:
            # TODO: Fetch customer profile in Week 3
            customer_profile = {
                "id": str(conversation.customer_id),
                "is_repeat": True,  # Placeholder
            }

        # Knowledge base context (if product query)
        knowledge_context = {}
        if understanding["intent"] in (
            Intent.PRODUCT_QUERY,
            Intent.RECOMMENDATION_REQUEST,
        ):
            # RAG retrieval for product context
            from polar.agent_knowledge.service import get_knowledge_service
            from polar.kit.db.postgres import async_session_maker

            knowledge_service = get_knowledge_service(async_session_maker)

            # Get last user message for query
            recent_messages = [msg for msg in messages if msg.role == "user"]
            if recent_messages:
                query = recent_messages[-1].content
                rag_context = await knowledge_service.get_context_for_query(
                    query=query,
                    organization_id=conversation.organization_id,
                    top_k=3,
                )
                knowledge_context = {
                    "rag_context": rag_context,
                    "relevant_products": [],  # Will be populated by tool execution
                }

        return {
            "history": history,
            "customer_profile": customer_profile,
            "knowledge": knowledge_context,
            "conversation_stage": conversation.stage,
            "cart": conversation.context.get("cart", {}),
            "hesitation_signals": conversation.hesitation_signals,
        }

    async def _make_decision(
        self,
        session: AsyncSession,
        conversation: Conversation,
        understanding: dict[str, Any],
        enriched_context: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Layer 3: Decision Engine.

        Decide which action to take based on intent and context.

        Args:
            session: Database session
            conversation: Current conversation
            understanding: Understanding from Layer 1
            enriched_context: Context from Layer 2

        Returns:
            {
                "action": Action,
                "parameters": {},
                "reasoning": "..."
            }
        """
        intent = understanding["intent"]
        entities = understanding["entities"]

        # Intent → Action mapping
        INTENT_ACTION_MAP = {
            Intent.GREETING: Action.SEND_GREETING,
            Intent.PRODUCT_QUERY: Action.SEARCH_PRODUCTS,
            Intent.RECOMMENDATION_REQUEST: Action.RECOMMEND_PRODUCTS,
            Intent.PURCHASE_INTENT: Action.ADD_TO_CART,
            Intent.PRICE_NEGOTIATION: Action.CALCULATE_OFFER,
            Intent.CHECKOUT_READY: Action.GENERATE_CHECKOUT,
            Intent.SHIPPING_QUERY: Action.CALCULATE_SHIPPING,
            Intent.RETURN_REQUEST: Action.INITIATE_RETURN,
            Intent.COMPLAINT: Action.ESCALATE_TO_HUMAN,
            Intent.PRODUCT_QUESTION: Action.ANSWER_QUESTION,
            Intent.FAREWELL: Action.SEND_FAREWELL,
            Intent.UNKNOWN: Action.REQUEST_CLARIFICATION,
        }

        action = INTENT_ACTION_MAP.get(intent, Action.GENERAL_RESPONSE)

        # Build parameters based on action
        parameters = {}

        if action == Action.SEARCH_PRODUCTS:
            parameters["query"] = entities.get("product_type", "")
            parameters["max_price"] = entities.get("max_price")
            parameters["color"] = entities.get("color")
            parameters["size"] = entities.get("size")

        elif action == Action.CALCULATE_OFFER:
            parameters["cart_value"] = enriched_context["cart"].get("total", 0)
            parameters["hesitation_signals"] = enriched_context["hesitation_signals"]
            parameters["proposed_price"] = entities.get("proposed_price")

        elif action == Action.GENERATE_CHECKOUT:
            parameters["cart"] = enriched_context["cart"]

        return {
            "action": action,
            "parameters": parameters,
            "reasoning": f"Intent {intent.value} → Action {action.value}",
        }

    async def _invoke_tools(
        self, session: AsyncSession, decision: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """
        Layer 4: Tool Invocation.

        Execute tools based on decision.

        Args:
            session: Database session
            decision: Decision from Layer 3

        Returns:
            List of tool results
        """
        action = decision["action"]
        parameters = decision["parameters"]

        tool_results = []

        # Action → Tool mapping
        ACTION_TOOL_MAP = {
            Action.SEARCH_PRODUCTS: "product_lookup",
            Action.GENERATE_CHECKOUT: "payment_link",
            Action.CALCULATE_OFFER: "discount_calculator",
            # Add more mappings as tools are implemented
        }

        tool_name = ACTION_TOOL_MAP.get(action)
        if tool_name:
            # Invoke tool
            result = await self.tool_registry.invoke(
                session=session,
                tool_name=tool_name,
                parameters=parameters,
            )

            tool_results.append(
                {
                    "tool": tool_name,
                    "success": result.success,
                    "data": result.data,
                    "error": result.error,
                    "execution_time_ms": result.execution_time_ms,
                }
            )

        return tool_results

    async def _generate_response(
        self,
        session: AsyncSession,
        conversation: Conversation,
        understanding: dict[str, Any],
        enriched_context: dict[str, Any],
        decision: dict[str, Any],
        tool_results: list[dict[str, Any]],
    ) -> str:
        """
        Layer 5: Response Generation.

        Generate natural language response using LLM.

        Args:
            session: Database session
            conversation: Current conversation
            understanding: Understanding from Layer 1
            enriched_context: Context from Layer 2
            decision: Decision from Layer 3
            tool_results: Tool results from Layer 4

        Returns:
            Response text
        """
        # Get agent configuration
        agent = conversation.agent

        # Build system prompt
        system_prompt = self._build_system_prompt(agent, enriched_context)

        # Build conversation history for LLM
        llm_messages = [LLMMessage(role="system", content=system_prompt)]

        # Add recent conversation history
        for msg in enriched_context["history"][-5:]:
            llm_messages.append(
                LLMMessage(role=msg["role"], content=msg["content"])
            )

        # Add tool results context
        if tool_results:
            tool_context = self._format_tool_results(tool_results)
            llm_messages.append(
                LLMMessage(
                    role="system",
                    content=f"Tool execution results:\n{tool_context}",
                )
            )

        # Generate response with Claude
        response = await self.llm_client.chat(
            messages=llm_messages,
            model=agent.config.get("llm_model", "claude-3-5-sonnet-20241022"),
            temperature=agent.personality.get("temperature", 0.7),
            max_tokens=agent.config.get("max_tokens", 1024),
        )

        return response.content

    async def _update_state(
        self,
        session: AsyncSession,
        conversation: Conversation,
        understanding: dict[str, Any],
        decision: dict[str, Any],
    ) -> None:
        """
        Layer 6: State Memory.

        Update conversation state based on interaction.

        Args:
            session: Database session
            conversation: Current conversation
            understanding: Understanding from Layer 1
            decision: Decision from Layer 3
        """
        intent = understanding["intent"]
        action = decision["action"]

        # Update conversation stage
        STAGE_TRANSITIONS = {
            Intent.GREETING: "discovery",
            Intent.PRODUCT_QUERY: "browsing",
            Intent.PURCHASE_INTENT: "consideration",
            Intent.CHECKOUT_READY: "checkout",
            Intent.FAREWELL: "completed",
        }

        new_stage = STAGE_TRANSITIONS.get(intent)
        if new_stage and new_stage != conversation.stage:
            conversation.stage = new_stage

        # Track hesitation signals
        HESITATION_INTENTS = (
            Intent.PRICE_NEGOTIATION,
            Intent.PRICE_QUERY,
            Intent.COMPARISON,
        )
        if intent in HESITATION_INTENTS:
            conversation.hesitation_signals += 1

        # Update negotiation history
        if intent == Intent.PRICE_NEGOTIATION:
            if "negotiation_history" not in conversation.context:
                conversation.context["negotiation_history"] = []

            conversation.context["negotiation_history"].append(
                {
                    "intent": intent.value,
                    "entities": understanding["entities"],
                    "action": action.value,
                    "timestamp": time.time(),
                }
            )

        # Mark conversation as modified
        session.add(conversation)

    def _build_system_prompt(
        self, agent: Agent, enriched_context: dict[str, Any]
    ) -> str:
        """Build system prompt for LLM."""
        personality = agent.personality
        rules = agent.rules

        prompt = f"""You are a {personality.get('tone', 'friendly')} AI sales agent for an e-commerce platform.

Your personality:
- Tone: {personality.get('tone', 'friendly')}
- Verbosity: {personality.get('verbosity', 'medium')} (be concise but helpful)
- Emoji usage: {personality.get('emoji_usage', 'moderate')}

Your rules:
- Maximum discount: {rules.get('max_discount_percent', 15)}%
- Dynamic pricing: {'Enabled' if rules.get('allow_dynamic_pricing') else 'Disabled'}

Current conversation:
- Stage: {enriched_context['conversation_stage']}
- Hesitation signals: {enriched_context['hesitation_signals']}

Your goal: Guide the customer to a successful purchase while providing excellent service.
"""

        return prompt

    def _format_tool_results(self, tool_results: list[dict[str, Any]]) -> str:
        """Format tool results for LLM context."""
        formatted = []

        for result in tool_results:
            if result["success"]:
                formatted.append(f"Tool: {result['tool']}\nResult: {result['data']}")
            else:
                formatted.append(f"Tool: {result['tool']}\nError: {result['error']}")

        return "\n\n".join(formatted)


# Global orchestrator instance
agent_orchestrator = AgentOrchestrator()
