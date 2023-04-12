from tests.fixtures.base import *  # noqa: F401, F403
from tests.fixtures.database import *  # noqa: F401, F403
from tests.fixtures.webhook import *  # noqa: F401, F403
from tests.fixtures.example_objects import *  # noqa: F401, F403
from tests.fixtures.auth import *  # noqa: F401, F403

import logging

# Quiet down external libraries during testing
logging.getLogger("faker").setLevel(logging.INFO)
logging.getLogger("asyncio").setLevel(logging.INFO)
