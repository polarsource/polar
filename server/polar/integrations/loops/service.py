from typing import Unpack

from polar.enums import UserSignupType
from polar.models import User

from .client import Properties
from .client import client as loops_client


class Loops:
    async def user_signup(
        self, user: User, signup_type: UserSignupType | None = None
    ) -> None:
        properties: Properties = {
            "isMaintainer": False,
            "isBacker": False,
            "organizationInstalled": False,
            "repositoryInstalled": False,
            "issueBadged": False,
        }
        if signup_type is not None:
            properties["isMaintainer"] = signup_type == UserSignupType.maintainer
            properties["isBacker"] = signup_type == UserSignupType.backer

        await loops_client.create_contact(
            user.email,
            str(user.id),
            **properties,
        )

    async def user_update(self, user: User, **properties: Unpack[Properties]) -> None:
        await loops_client.update_contact(user.email, str(user.id), **properties)


loops = Loops()

__all__ = ["loops"]
