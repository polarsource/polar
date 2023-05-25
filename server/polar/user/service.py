import structlog

from polar.kit.services import ResourceService
from polar.models import User
from polar.postgres import AsyncSession

from .schemas import UserCreate, UserUpdate, UserUpdateSettings

log = structlog.get_logger()


class UserService(ResourceService[User, UserCreate, UserUpdate]):
    async def update_preferences(
        self, session: AsyncSession, user: User, settings: UserUpdateSettings
    ) -> User:
        changed = False

        if settings.email_newsletters_and_changelogs is not None:
            user.email_newsletters_and_changelogs = (
                settings.email_newsletters_and_changelogs
            )
            changed = True

        if settings.email_promotions_and_events is not None:
            user.email_promotions_and_events = settings.email_promotions_and_events
            changed = True

        if changed:
            await user.save(session)

        return user


user = UserService(User)
