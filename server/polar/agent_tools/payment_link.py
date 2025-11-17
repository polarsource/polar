"""Payment link tool - generates checkout links."""

import time
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from polar.agent_tools.base import BaseTool, ToolResult
from polar.checkout.service import checkout as checkout_service


class PaymentLinkTool(BaseTool):
    """
    Tool for generating payment/checkout links.

    Integrates with Polar's existing checkout system.
    """

    name = "payment_link"
    description = "Generate secure checkout link for product purchase"
    parameters_schema = {
        "type": "object",
        "properties": {
            "product_id": {"type": "string", "format": "uuid"},
            "product_price_id": {"type": "string", "format": "uuid"},
            "customer_email": {"type": "string", "format": "email"},
            "amount": {"type": "integer", "description": "Override amount in cents"},
        },
        "required": ["product_id"],
    }

    async def execute(
        self, session: AsyncSession, parameters: dict[str, Any]
    ) -> ToolResult:
        """Generate checkout link."""
        start_time = time.time()

        try:
            product_id = UUID(parameters["product_id"])

            # TODO: Integrate with Polar checkout service in Week 7-8
            # For now, return placeholder
            checkout_url = f"https://checkout.agentpay.com/{product_id}"

            execution_time = int((time.time() - start_time) * 1000)

            return ToolResult(
                success=True,
                data={
                    "checkout_url": checkout_url,
                    "product_id": str(product_id),
                    "expires_in_seconds": 900,  # 15 minutes
                },
                execution_time_ms=execution_time,
            )

        except Exception as e:
            return ToolResult(
                success=False,
                data={},
                error=str(e),
            )
