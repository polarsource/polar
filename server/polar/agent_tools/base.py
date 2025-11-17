"""Base tool class for agent tools."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class ToolResult:
    """Result of tool execution."""

    success: bool
    data: dict[str, Any]
    error: str | None = None
    execution_time_ms: int = 0


class BaseTool(ABC):
    """
    Base class for all agent tools.

    Tools are functions the agent can call to:
    - Look up products (RAG search)
    - Generate payment links
    - Calculate shipping costs
    - Check inventory
    - Validate discount codes
    """

    name: str
    description: str
    parameters_schema: dict

    @abstractmethod
    async def execute(
        self, session: AsyncSession, parameters: dict[str, Any]
    ) -> ToolResult:
        """
        Execute the tool with given parameters.

        Args:
            session: Database session
            parameters: Tool parameters (validated against schema)

        Returns:
            ToolResult with success status and data
        """
        pass

    def validate_parameters(self, parameters: dict[str, Any]) -> bool:
        """
        Validate parameters against schema.

        TODO: Implement JSON schema validation
        """
        return True
