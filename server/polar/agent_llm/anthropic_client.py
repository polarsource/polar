"""Anthropic Claude LLM client."""

import json
import logging
from typing import Any, AsyncIterator

from polar.agent_llm.base import LLMClient, LLMMessage, LLMResponse, LLMTool
from polar.config import settings

logger = logging.getLogger(__name__)


class AnthropicClient(LLMClient):
    """
    Anthropic Claude API client.

    Models:
    - claude-3-5-sonnet-20241022: Best for complex reasoning
    - claude-3-opus-20240229: Most capable, expensive
    - claude-3-haiku-20240307: Fastest, cheapest (intent classification)

    Pricing (per 1M tokens):
    - Sonnet: $3 input, $15 output
    - Opus: $15 input, $75 output
    - Haiku: $0.25 input, $1.25 output
    """

    def __init__(
        self,
        api_key: str | None = None,
        default_model: str = "claude-3-5-sonnet-20241022",
    ):
        """
        Initialize Anthropic client.

        Args:
            api_key: Anthropic API key (defaults to settings.ANTHROPIC_API_KEY)
            default_model: Default model to use
        """
        self.api_key = api_key or getattr(settings, "ANTHROPIC_API_KEY", None)
        self.default_model = default_model
        self.client = None

        # TODO: Initialize Anthropic client
        # from anthropic import AsyncAnthropic
        # self.client = AsyncAnthropic(api_key=self.api_key)

    async def chat(
        self,
        messages: list[LLMMessage],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        tools: list[LLMTool] | None = None,
        stream: bool = False,
    ) -> LLMResponse | AsyncIterator[str]:
        """
        Send chat completion to Claude.

        Args:
            messages: Conversation history
            model: Claude model (defaults to Sonnet)
            temperature: Sampling temperature
            max_tokens: Max output tokens
            tools: Available tools
            stream: Enable streaming

        Returns:
            LLMResponse or AsyncIterator[str] if streaming
        """
        model = model or self.default_model

        # Convert messages to Anthropic format
        anthropic_messages = self._convert_messages(messages)

        # Extract system message
        system_message = None
        if anthropic_messages and anthropic_messages[0]["role"] == "system":
            system_message = anthropic_messages[0]["content"]
            anthropic_messages = anthropic_messages[1:]

        # TODO: Make API call (Week 2 implementation)
        # if stream:
        #     return self._stream_chat(
        #         model, anthropic_messages, system_message, temperature, max_tokens, tools
        #     )
        # else:
        #     response = await self.client.messages.create(
        #         model=model,
        #         messages=anthropic_messages,
        #         system=system_message,
        #         temperature=temperature,
        #         max_tokens=max_tokens,
        #         tools=self._convert_tools(tools) if tools else None,
        #     )
        #     return self._convert_response(response)

        # Placeholder response
        logger.info(f"Claude chat request: model={model}, messages={len(messages)}")
        return LLMResponse(
            content="[Placeholder] Claude integration coming in Week 2 implementation",
            role="assistant",
            finish_reason="stop",
            usage={"input_tokens": 100, "output_tokens": 20},
        )

    async def classify_intent(
        self,
        message: str,
        conversation_history: list[LLMMessage],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Classify intent using Claude Haiku (fast, cheap).

        Args:
            message: User message
            conversation_history: Recent messages
            context: Conversation context

        Returns:
            Classification result with intent, confidence, entities
        """
        # Build classification prompt
        system_prompt = """You are an intent classifier for an e-commerce AI agent.

Classify the user's message into one of these intents:
- product_query: Looking for products
- purchase_intent: Ready to buy
- price_negotiation: Asking for discount
- checkout_ready: Ready to checkout
- shipping_query: Asking about shipping
- return_request: Want to return
- complaint: Complaint or issue
- product_question: Question about product
- greeting: Hello/hi
- farewell: Goodbye
- unknown: Cannot determine

Also extract entities:
- product_type: Type of product (shoes, laptop, etc.)
- price: Price mentioned
- quantity: Quantity mentioned
- color, size: Product attributes

Respond in JSON format:
{
  "intent": "intent_name",
  "confidence": 0.95,
  "entities": {}
}"""

        # Build context
        context_str = f"Cart: {context.get('cart', {})}\nStage: {context.get('stage', 'unknown')}"

        # Build conversation history
        history_str = "\n".join(
            [f"{msg.role}: {msg.content}" for msg in conversation_history[-3:]]
        )

        # Build messages
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(
                role="user",
                content=f"Context:\n{context_str}\n\nRecent conversation:\n{history_str}\n\nUser message: {message}\n\nClassify this message:",
            ),
        ]

        # TODO: Make API call with Claude Haiku
        # response = await self.chat(
        #     messages=messages,
        #     model="claude-3-haiku-20240307",
        #     temperature=0.3,
        #     max_tokens=256,
        # )
        #
        # # Parse JSON response
        # try:
        #     result = json.loads(response.content)
        #     return result
        # except json.JSONDecodeError:
        #     logger.error(f"Failed to parse intent classification: {response.content}")
        #     return {"intent": "unknown", "confidence": 0.0, "entities": {}}

        # Placeholder
        logger.info(f"Intent classification request: {message[:50]}...")
        return {
            "intent": "product_query",
            "confidence": 0.85,
            "entities": {},
        }

    async def _stream_chat(
        self,
        model: str,
        messages: list[dict],
        system: str | None,
        temperature: float,
        max_tokens: int,
        tools: list[dict] | None,
    ) -> AsyncIterator[str]:
        """
        Stream chat completion.

        Yields:
            Text chunks as they arrive
        """
        # TODO: Implement streaming (Week 2-3)
        # async with self.client.messages.stream(
        #     model=model,
        #     messages=messages,
        #     system=system,
        #     temperature=temperature,
        #     max_tokens=max_tokens,
        #     tools=tools,
        # ) as stream:
        #     async for text in stream.text_stream:
        #         yield text

        yield "[Streaming placeholder]"

    def _convert_messages(self, messages: list[LLMMessage]) -> list[dict]:
        """Convert LLMMessage to Anthropic format."""
        return [
            {
                "role": msg.role,
                "content": msg.content,
            }
            for msg in messages
        ]

    def _convert_tools(self, tools: list[LLMTool]) -> list[dict]:
        """Convert LLMTool to Anthropic tool format."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.parameters,
            }
            for tool in tools
        ]

    def _convert_response(self, response: Any) -> LLMResponse:
        """Convert Anthropic response to LLMResponse."""
        # TODO: Implement response conversion
        # content = response.content[0].text if response.content else ""
        # tool_calls = None
        # if hasattr(response, "tool_calls") and response.tool_calls:
        #     tool_calls = [
        #         {
        #             "id": tc.id,
        #             "name": tc.name,
        #             "arguments": tc.input,
        #         }
        #         for tc in response.tool_calls
        #     ]
        #
        # return LLMResponse(
        #     content=content,
        #     role="assistant",
        #     tool_calls=tool_calls,
        #     finish_reason=response.stop_reason,
        #     usage={
        #         "input_tokens": response.usage.input_tokens,
        #         "output_tokens": response.usage.output_tokens,
        #     },
        # )

        return LLMResponse(
            content="Placeholder",
            role="assistant",
            finish_reason="stop",
        )
