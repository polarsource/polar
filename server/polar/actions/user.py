import structlog
from fastapi_users.db import SQLAlchemyUserDatabase

from polar.actions.base import Action
from polar.models import User
from polar.schema.user import UserCreate, UserUpdate

log = structlog.get_logger()


# Subclass of the database manager for FastAPI-Users
# since we are likely going to override a few methods.
class UserDatabase(SQLAlchemyUserDatabase):
    ...


class UserActions(Action[User, UserCreate, UserUpdate]):
    ...


user = UserActions(User)
