"""Run one metered tool call for a customer, using the names in polar_types.py.

POLAR_ACCESS_TOKEN=polar_oat_... uv run main.py <external customer ID>
"""

import asyncio
import os
import sys

from polar.v2027_01 import PolarAsync

from polar_types import Benefits, Events, Meters


async def use_tool(polar: PolarAsync, customer: str) -> None:
    grants = await polar.benefit_grants.list(
        external_customer_id=customer,
        external_benefit_id=Benefits.custom_servers,
        is_granted=True,
    )
    server = "custom" if grants.items else "builtin"

    meters = await polar.customer_meters.list(
        external_customer_id=customer,
        external_meter_id=Meters.tool_call,
    )
    balance = meters.items[0].balance if meters.items else 0
    print(f"{customer} has {balance:g} tool calls left, {server} servers")
    if balance <= 0:
        print("No tool calls left, nothing tracked")
        return

    async with polar.metering() as metering:
        actor = await metering.actor(external_customer_id=customer)
        await actor.track(
            name=Events.tool_call,
            metadata={
                "tool": "search",
                "server": server,
                "success": True,
                "duration_ms": 120,
            },
        )
    print(f"Tracked one {Events.tool_call} event")


async def main(customer: str) -> None:
    async with PolarAsync(
        os.environ["POLAR_ACCESS_TOKEN"],
        environment="sandbox",
        base_url=os.environ.get("POLAR_BASE_URL"),
    ) as polar:
        await use_tool(polar, customer)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1]))
