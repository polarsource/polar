import structlog
from sqlalchemy.orm import joinedload

from polar.kit.services import ResourceService
from polar.models import User, OAuthAccount
from polar.postgres import AsyncSession, sql

from .schemas import UserCreate, UserUpdate

log = structlog.get_logger()


class UserService(ResourceService[User, UserCreate, UserUpdate]):
    ...


user = UserService(User)
