"""Base LLM client interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, AsyncIterator


@dataclass
class LLMMessage:
    """Message in LLM conversation."""

    role: str  # system, user, assistant, tool
    content: str
    name: str | None = None  # For tool responses
    tool_calls: list[dict[str, Any]] | None = None  # For assistant tool calls


@dataclass
class LLMTool:
    """Tool definition for LLM function calling."""

    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema


@dataclass
class LLMResponse:
    """Response from LLM."""

    content: str
    role: str = "assistant"
    tool_calls: list[dict[str, Any]] | None = None
    finish_reason: str | None = None  # stop, tool_calls, length, etc.
    usage: dict[str, int] | None = None  # input_tokens, output_tokens


class LLMClient(ABC):
    """
    Abstract LLM client interface.

    Implementations:
    - AnthropicClient: Claude models (Sonnet, Opus, Haiku)
    - OpenAIClient: GPT models (fallback)
    """

    @abstractmethod
    async def chat(
        self,
        messages: list[LLMMessage],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        tools: list[LLMTool] | None = None,
        stream: bool = False,
    ) -> LLMResponse | AsyncIterator[str]:
        """
        Send chat completion request.

        Args:
            messages: Conversation history
            model: Model name
            temperature: Sampling temperature (0-1)
            max_tokens: Max tokens to generate
            tools: Available tools for function calling
            stream: Enable streaming responses

        Returns:
            LLMResponse or AsyncIterator[str] if streaming
        """
        pass

    @abstractmethod
    async def classify_intent(
        self,
        message: str,
        conversation_history: list[LLMMessage],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Classify user intent (fallback for rule-based classifier).

        Args:
            message: User message
            conversation_history: Recent conversation
            context: Additional context (cart, stage, etc.)

        Returns:
            {
                "intent": "product_query",
                "confidence": 0.95,
                "entities": {"product_type": "shoes"}
            }
        """
        pass
