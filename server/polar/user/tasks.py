import uuid

from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, actor

from .service.user import user as user_service


class UserTaskError(PolarTaskError): ...


class UserDoesNotExist(UserTaskError):
    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        message = f"The user with id {user_id} does not exist."
        super().__init__(message)


@actor(actor_name="user.on_after_signup")
async def user_on_after_signup(user_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        user = await user_service.get(session, user_id)

        if user is None:
            raise UserDoesNotExist(user_id)
