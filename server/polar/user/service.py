import structlog

from polar.kit.services import ResourceService
from polar.models import User

from .schemas import UserCreate, UserUpdate

log = structlog.get_logger()


class UserService(ResourceService[User, UserCreate, UserUpdate]):
    ...


user = UserService(User)
