import asyncio

import polar.integrations.github.verify as github_verify
from polar.logging import configure as configure_logging
from polar.redis import async_pool


async def _main() -> None:
    configure_logging()
    await github_verify.verify_app_configuration()
    await async_pool.disconnect()


if __name__ == "__main__":
    asyncio.run(_main())
