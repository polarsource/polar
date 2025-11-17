"""Tool registry - manages available tools for agents."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent_tools.base import BaseTool, ToolResult


class ToolRegistry:
    """
    Registry of available tools for agents.

    Tools are registered by name and can be invoked dynamically.
    """

    def __init__(self):
        """Initialize tool registry."""
        self.tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        """Register a tool."""
        self.tools[tool.name] = tool

    def get(self, tool_name: str) -> BaseTool | None:
        """Get tool by name."""
        return self.tools.get(tool_name)

    def list_tools(self) -> list[dict[str, Any]]:
        """List all registered tools."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "parameters_schema": tool.parameters_schema,
            }
            for tool in self.tools.values()
        ]

    async def invoke(
        self, session: AsyncSession, tool_name: str, parameters: dict[str, Any]
    ) -> ToolResult:
        """
        Invoke a tool by name.

        Args:
            session: Database session
            tool_name: Name of tool to invoke
            parameters: Tool parameters

        Returns:
            ToolResult with execution outcome
        """
        tool = self.get(tool_name)
        if not tool:
            return ToolResult(
                success=False,
                data={},
                error=f"Tool '{tool_name}' not found",
            )

        # Validate parameters
        if not tool.validate_parameters(parameters):
            return ToolResult(
                success=False,
                data={},
                error="Invalid parameters",
            )

        # Execute tool
        return await tool.execute(session, parameters)


# Global tool registry instance
tool_registry = ToolRegistry()
