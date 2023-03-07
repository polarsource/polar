import structlog
from fastapi_users.db import SQLAlchemyUserDatabase

from polar.kit.services import ResourceService
from polar.models import User

from .schemas import UserCreate, UserUpdate

log = structlog.get_logger()


# Subclass of the database manager for FastAPI-Users
# since we are likely going to override a few methods.
class UserDatabase(SQLAlchemyUserDatabase):
    ...


class UserService(ResourceService[User, UserCreate, UserUpdate]):
    ...


user = UserService(User)
