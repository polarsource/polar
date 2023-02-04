import os

import nest_asyncio

# Since we're calling alembic upgrade which is also creating an asyncio loop
nest_asyncio.apply()

os.environ["POLAR_ENV"] = "testing"

from tests.fixtures import *  # noqa
