# ADR 003: Tool Registry Pattern for Agent Actions

**Status**: Accepted

**Date**: 2025-11-17

**Context**:

Agent Core needs to invoke actions like product lookup, payment link generation, discount calculation, inventory checking, etc. We need a pattern for:

1. **Defining tools**: Clear interface for tool implementation
2. **Registering tools**: Dynamic tool registration
3. **Invoking tools**: Runtime tool invocation by name
4. **Validation**: Parameter validation against schemas
5. **Extensibility**: Easy to add new tools without modifying core agent logic

We evaluated three patterns:

1. **Hard-coded tools**: Switch statement in agent service (`if tool == "product_lookup": ...`)
2. **Plugin system**: Dynamic import from tools directory
3. **Registry pattern**: Central registry with explicit registration

**Decision**:

We will implement **Tool Registry Pattern** with abstract base class:

```python
class BaseTool(ABC):
    name: str
    description: str
    parameters_schema: dict  # JSON Schema

    @abstractmethod
    async def execute(self, session: AsyncSession, parameters: dict) -> ToolResult:
        pass

class ToolRegistry:
    def __init__(self):
        self.tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        self.tools[tool.name] = tool

    async def invoke(self, session, tool_name, parameters) -> ToolResult:
        tool = self.get(tool_name)
        if not tool:
            return ToolResult(success=False, error=f"Tool '{tool_name}' not found")

        if not tool.validate_parameters(parameters):
            return ToolResult(success=False, error="Invalid parameters")

        return await tool.execute(session, parameters)
```

**Tool Implementation Example**:
```python
class ProductLookupTool(BaseTool):
    name = "product_lookup"
    description = "Search product catalog by name, description, or category"
    parameters_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "limit": {"type": "integer", "default": 5}
        },
        "required": ["query"]
    }

    async def execute(self, session, parameters) -> ToolResult:
        # Implementation
        pass
```

**Registration** (at startup):
```python
from polar.agent_tools import tool_registry
from polar.agent_tools.product_lookup import ProductLookupTool
from polar.agent_tools.payment_link import PaymentLinkTool

tool_registry.register(ProductLookupTool())
tool_registry.register(PaymentLinkTool())
```

**Consequences**:

**Positive**:
- **Clear interface**: Every tool has same structure (name, description, schema, execute)
- **Validation**: JSON Schema validation ensures type safety
- **Testability**: Easy to mock tools in tests (`registry.register(MockTool())`)
- **Discoverability**: `tool_registry.list_tools()` returns all available tools for agent prompt
- **Extensibility**: New tools just implement BaseTool and register, no agent logic changes
- **Type safety**: ToolResult dataclass ensures consistent return format
- **Execution tracking**: Tools report execution_time_ms for monitoring

**Negative**:
- **Startup overhead**: All tools must be registered at startup
- **Global state**: Single global registry (acceptable for MVP, could use DI later)
- **No versioning**: Tool changes affect all agents (future: version tools)
- **Limited composition**: Tools can't easily call other tools (future: add tool chaining)

**Design Choices**:

1. **Async execute**: All tools are async for DB/API calls
2. **Session injection**: Tools receive DB session for queries
3. **ToolResult dataclass**: Standardized return format (success, data, error, execution_time_ms)
4. **JSON Schema validation**: Industry standard, supports complex types
5. **Global registry**: Singleton pattern for MVP simplicity

**Initial Tool Set** (Week 1-3):
- `product_lookup`: Search product catalog (RAG in Week 4-6)
- `payment_link`: Generate Stripe checkout URL
- `discount_calculator`: Calculate dynamic pricing (Week 7-9)
- `inventory_check`: Check stock availability (Week 10-12)

**Future Tools** (Week 13+):
- `shipping_calculator`: Estimate shipping costs
- `review_lookup`: Find product reviews
- `similar_products`: Recommendation engine
- `order_status`: Track order fulfillment

**LLM Integration**:

Tools are exposed to LLM as function calling schema:
```json
{
  "tools": [
    {
      "name": "product_lookup",
      "description": "Search product catalog by name, description, or category",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {"type": "string"},
          "limit": {"type": "integer"}
        }
      }
    }
  ]
}
```

**Testing Strategy**:
```python
# Unit test each tool
async def test_product_lookup_tool():
    tool = ProductLookupTool()
    result = await tool.execute(session, {"query": "running shoes"})
    assert result.success
    assert len(result.data["products"]) > 0

# Integration test registry
async def test_tool_registry_invoke():
    registry = ToolRegistry()
    registry.register(ProductLookupTool())
    result = await registry.invoke(session, "product_lookup", {"query": "shoes"})
    assert result.success
```

**References**:
- `server/polar/agent_tools/base.py` - BaseTool interface
- `server/polar/agent_tools/registry.py` - ToolRegistry implementation
- `server/polar/agent_tools/product_lookup.py` - Example tool
