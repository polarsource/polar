"""Product lookup tool - searches product catalog."""

import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent_tools.base import BaseTool, ToolResult
from polar.models import Product


class ProductLookupTool(BaseTool):
    """
    Tool for searching product catalog.

    In Week 4-6, this will use RAG (semantic search).
    For now, uses basic SQL search.
    """

    name = "product_lookup"
    description = "Search product catalog by name, description, or category"
    parameters_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "category": {"type": "string", "description": "Filter by category"},
            "max_price": {"type": "integer", "description": "Max price in cents"},
            "min_price": {"type": "integer", "description": "Min price in cents"},
            "limit": {
                "type": "integer",
                "description": "Max results",
                "default": 5,
            },
        },
        "required": ["query"],
    }

    async def execute(
        self, session: AsyncSession, parameters: dict[str, Any]
    ) -> ToolResult:
        """Execute product search."""
        start_time = time.time()

        query = parameters.get("query", "")
        limit = parameters.get("limit", 5)

        # Basic SQL search (will be replaced with RAG in Week 4)
        statement = select(Product).where(
            Product.name.ilike(f"%{query}%") | Product.description.ilike(f"%{query}%")
        )

        # Apply filters
        if "category" in parameters:
            # TODO: Add category filter when Product model has category
            pass

        # TODO: Add price filters
        # if "max_price" in parameters:
        #     statement = statement.where(Product.price <= parameters["max_price"])

        statement = statement.limit(limit)

        result = await session.execute(statement)
        products = list(result.scalars().all())

        execution_time = int((time.time() - start_time) * 1000)

        return ToolResult(
            success=True,
            data={
                "products": [
                    {
                        "id": str(p.id),
                        "name": p.name,
                        "description": p.description,
                        # Add more fields as needed
                    }
                    for p in products
                ],
                "count": len(products),
            },
            execution_time_ms=execution_time,
        )
