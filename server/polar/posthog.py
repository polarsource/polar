from __future__ import annotations

from typing import Any

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

    def generate_distinct_user_id(self, user: User) -> str:
        return f"user:{user.id}"

    def decorate_properties(
        self, properties: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        if not properties:
            return None

        properties["_environment"] = settings.ENV
        return properties

    def capture(
        self,
        distinct_id: str,
        event: str,
        properties: dict[str, Any] | None = None,
    ) -> None:
        if not self.client:
            return

        self.client.capture(
            distinct_id,
            event=event,
            properties=self.decorate_properties(properties),
        )

    def anonymous_event(
        self,
        event: str,
        properties: dict[str, Any] | None = None,
    ) -> None:
        """Shorthand for one-off anonymous event capture."""
        self.capture(
            distinct_id="polar_anonymous",
            event=event,
            properties=self.decorate_properties(properties),
        )

    def user_event(
        self,
        user: User,
        event: str,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self.capture(
            self.generate_distinct_user_id(user),
            event=event,
            properties=self.decorate_properties(properties),
        )

    def identify(self, user: User) -> None:
        if not self.client:
            return

        self.client.identify(
            self.generate_distinct_user_id(user),
            properties=self.decorate_properties(
                {
                    "username": user.username,
                }
            ),
        )


posthog = Service()
