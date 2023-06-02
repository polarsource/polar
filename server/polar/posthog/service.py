from polar.config import settings
from polar.models.user import User
from posthog import Posthog


class Service:
    client: Posthog | None

    def __init__(self) -> None:
        if not settings.POSTHOG_PROJECT_API_KEY:
            return

        self.client = Posthog(settings.POSTHOG_PROJECT_API_KEY)

    def identify(self, user: User) -> None:
        if not self.client:
            return

        self.client.identify(
            f"user:{user.id}",
            properties={
                "username": user.username,
            },
        )


posthog_service = Service()
