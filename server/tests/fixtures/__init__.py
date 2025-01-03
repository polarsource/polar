import logging

from tests.fixtures.auth import *  # noqa: F401, F403
from tests.fixtures.base import *  # noqa: F401, F403
from tests.fixtures.database import *  # noqa: F401, F403
from tests.fixtures.email import *  # noqa: F401, F403
from tests.fixtures.file import *  # noqa: F401, F403
from tests.fixtures.locker import *  # noqa: F401, F403
from tests.fixtures.predictable_objects import *  # noqa: F401, F403
from tests.fixtures.random_objects import *  # noqa: F401, F403
from tests.fixtures.redis import *  # noqa: F401, F403
from tests.fixtures.stripe import *  # noqa: F401, F403
from tests.fixtures.webhook import *  # noqa: F401, F403
from tests.fixtures.worker import *  # noqa: F401, F403

# Quiet down external libraries during testing
logging.getLogger("faker").setLevel(logging.INFO)
logging.getLogger("asyncio").setLevel(logging.INFO)
