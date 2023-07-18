from posthog import Posthog

from polar.config import settings
from polar.models.user import User


class Service:
    client: Posthog | None

    def __init__(self) -> None:
        if not settings.POSTHOG_PROJECT_API_KEY:
            self.client = None
            return

        self.client = Posthog(settings.POSTHOG_PROJECT_API_KEY)
        self.client.disabled = settings.is_testing()
        self.client.debug = settings.DEBUG

    def identify(self, user: User) -> None:
        if not self.client:
            return

        self.client.identify(
            f"user:{user.id}",
            properties={
                "username": user.username,
            },
        )


posthog = Service()
