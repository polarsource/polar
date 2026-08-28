import logging

from tests.fixtures.auth import *
from tests.fixtures.base import *
from tests.fixtures.database import *
from tests.fixtures.file import *
from tests.fixtures.locker import *
from tests.fixtures.random_objects import *
from tests.fixtures.redis import *
from tests.fixtures.stripe import *
from tests.fixtures.tinybird import *
from tests.fixtures.worker import *

# Quiet down external libraries during testing
logging.getLogger("faker").setLevel(logging.INFO)
logging.getLogger("asyncio").setLevel(logging.INFO)
