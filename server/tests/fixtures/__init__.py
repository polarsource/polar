import logging

from tests.fixtures.auth import *  # noqa: F403
from tests.fixtures.base import *  # noqa: F403
from tests.fixtures.database import *  # noqa: F403
from tests.fixtures.file import *  # noqa: F403
from tests.fixtures.locker import *  # noqa: F403
from tests.fixtures.random_objects import *  # noqa: F403
from tests.fixtures.redis import *  # noqa: F403
from tests.fixtures.stripe import *  # noqa: F403
from tests.fixtures.worker import *  # noqa: F403

# Quiet down external libraries during testing
logging.getLogger("faker").setLevel(logging.INFO)
logging.getLogger("asyncio").setLevel(logging.INFO)
