import asyncio

import polar.integrations.github.verify as github_verify
from polar.logging import configure as configure_logging

if __name__ == "__main__":
    configure_logging()
    asyncio.run(github_verify.verify_app_configuration())
