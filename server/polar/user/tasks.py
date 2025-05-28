import uuid

from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import UserRepository


class UserTaskError(PolarTaskError): ...


class UserDoesNotExist(UserTaskError):
    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        message = f"The user with id {user_id} does not exist."
        super().__init__(message)


@actor(actor_name="user.on_after_signup", priority=TaskPriority.LOW)
async def user_on_after_signup(user_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = UserRepository.from_session(session)
        user = await repository.get_by_id(user_id)
        if user is None:
            raise UserDoesNotExist(user_id)
