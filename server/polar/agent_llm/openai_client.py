"""OpenAI LLM client (fallback and embeddings)."""

import json
import logging
from typing import Any, AsyncIterator

from polar.agent_llm.base import LLMClient, LLMMessage, LLMResponse, LLMTool
from polar.config import settings

logger = logging.getLogger(__name__)


class OpenAIClient(LLMClient):
    """
    OpenAI API client.

    Models:
    - gpt-4o: Latest GPT-4 Omni (multimodal)
    - gpt-4-turbo: GPT-4 Turbo
    - gpt-3.5-turbo: Fast, cheap fallback

    Embeddings:
    - text-embedding-3-small: 1536 dims, $0.02 per 1M tokens
    - text-embedding-3-large: 3072 dims, $0.13 per 1M tokens

    Use Cases:
    - Fallback when Anthropic is down
    - Embeddings for RAG (Week 4-6)
    """

    def __init__(
        self,
        api_key: str | None = None,
        default_model: str = "gpt-4o",
    ):
        """
        Initialize OpenAI client.

        Args:
            api_key: OpenAI API key (defaults to settings.OPENAI_API_KEY)
            default_model: Default model to use
        """
        self.api_key = api_key or getattr(settings, "OPENAI_API_KEY", None)
        self.default_model = default_model
        self.client = None

        # TODO: Initialize OpenAI client
        # from openai import AsyncOpenAI
        # self.client = AsyncOpenAI(api_key=self.api_key)

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
        Send chat completion to GPT.

        Args:
            messages: Conversation history
            model: GPT model
            temperature: Sampling temperature
            max_tokens: Max output tokens
            tools: Available tools
            stream: Enable streaming

        Returns:
            LLMResponse or AsyncIterator[str] if streaming
        """
        model = model or self.default_model

        # Convert messages to OpenAI format
        openai_messages = self._convert_messages(messages)

        # TODO: Make API call
        # if stream:
        #     return self._stream_chat(
        #         model, openai_messages, temperature, max_tokens, tools
        #     )
        # else:
        #     response = await self.client.chat.completions.create(
        #         model=model,
        #         messages=openai_messages,
        #         temperature=temperature,
        #         max_tokens=max_tokens,
        #         tools=self._convert_tools(tools) if tools else None,
        #     )
        #     return self._convert_response(response)

        # Placeholder
        logger.info(f"OpenAI chat request: model={model}, messages={len(messages)}")
        return LLMResponse(
            content="[Placeholder] OpenAI integration coming in Week 2 implementation",
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
        Classify intent using GPT-3.5-turbo (fallback).

        Args:
            message: User message
            conversation_history: Recent messages
            context: Conversation context

        Returns:
            Classification result
        """
        # Build classification prompt (same as Anthropic)
        system_prompt = """You are an intent classifier for an e-commerce AI agent.

Classify the user's message into one of these intents and extract entities.
Respond in JSON format:
{
  "intent": "intent_name",
  "confidence": 0.95,
  "entities": {}
}"""

        context_str = f"Cart: {context.get('cart', {})}\nStage: {context.get('stage', 'unknown')}"
        history_str = "\n".join(
            [f"{msg.role}: {msg.content}" for msg in conversation_history[-3:]]
        )

        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(
                role="user",
                content=f"Context:\n{context_str}\n\nRecent conversation:\n{history_str}\n\nUser message: {message}\n\nClassify:",
            ),
        ]

        # TODO: Make API call with GPT-3.5-turbo
        # response = await self.chat(
        #     messages=messages,
        #     model="gpt-3.5-turbo",
        #     temperature=0.3,
        #     max_tokens=256,
        # )
        #
        # try:
        #     result = json.loads(response.content)
        #     return result
        # except json.JSONDecodeError:
        #     logger.error(f"Failed to parse intent: {response.content}")
        #     return {"intent": "unknown", "confidence": 0.0, "entities": {}}

        # Placeholder
        logger.info(f"OpenAI intent classification: {message[:50]}...")
        return {
            "intent": "product_query",
            "confidence": 0.80,
            "entities": {},
        }

    async def embed(self, text: str, model: str = "text-embedding-3-small") -> list[float]:
        """
        Generate embedding for text.

        Args:
            text: Input text
            model: Embedding model

        Returns:
            Embedding vector (1536 or 3072 dimensions)
        """
        # TODO: Make API call
        # response = await self.client.embeddings.create(
        #     model=model,
        #     input=text,
        # )
        # return response.data[0].embedding

        # Placeholder
        logger.info(f"Embedding request: {text[:50]}...")
        dimensions = 1536 if "small" in model else 3072
        return [0.0] * dimensions

    async def embed_batch(
        self, texts: list[str], model: str = "text-embedding-3-small"
    ) -> list[list[float]]:
        """
        Generate embeddings for multiple texts (batched).

        Args:
            texts: Input texts (up to 2048 per batch)
            model: Embedding model

        Returns:
            List of embedding vectors
        """
        # TODO: Make API call
        # response = await self.client.embeddings.create(
        #     model=model,
        #     input=texts,
        # )
        # return [data.embedding for data in response.data]

        # Placeholder
        logger.info(f"Batch embedding request: {len(texts)} texts")
        dimensions = 1536 if "small" in model else 3072
        return [[0.0] * dimensions] * len(texts)

    async def _stream_chat(
        self,
        model: str,
        messages: list[dict],
        temperature: float,
        max_tokens: int,
        tools: list[dict] | None,
    ) -> AsyncIterator[str]:
        """Stream chat completion."""
        # TODO: Implement streaming
        # stream = await self.client.chat.completions.create(
        #     model=model,
        #     messages=messages,
        #     temperature=temperature,
        #     max_tokens=max_tokens,
        #     tools=tools,
        #     stream=True,
        # )
        # async for chunk in stream:
        #     if chunk.choices[0].delta.content:
        #         yield chunk.choices[0].delta.content

        yield "[Streaming placeholder]"

    def _convert_messages(self, messages: list[LLMMessage]) -> list[dict]:
        """Convert LLMMessage to OpenAI format."""
        return [
            {
                "role": msg.role,
                "content": msg.content,
            }
            for msg in messages
        ]

    def _convert_tools(self, tools: list[LLMTool]) -> list[dict]:
        """Convert LLMTool to OpenAI tool format."""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            }
            for tool in tools
        ]

    def _convert_response(self, response: Any) -> LLMResponse:
        """Convert OpenAI response to LLMResponse."""
        # TODO: Implement response conversion
        # choice = response.choices[0]
        # content = choice.message.content or ""
        # tool_calls = None
        # if choice.message.tool_calls:
        #     tool_calls = [
        #         {
        #             "id": tc.id,
        #             "name": tc.function.name,
        #             "arguments": json.loads(tc.function.arguments),
        #         }
        #         for tc in choice.message.tool_calls
        #     ]
        #
        # return LLMResponse(
        #     content=content,
        #     role="assistant",
        #     tool_calls=tool_calls,
        #     finish_reason=choice.finish_reason,
        #     usage={
        #         "input_tokens": response.usage.prompt_tokens,
        #         "output_tokens": response.usage.completion_tokens,
        #     },
        # )

        return LLMResponse(
            content="Placeholder",
            role="assistant",
            finish_reason="stop",
        )
