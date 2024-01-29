from __future__ import annotations

from typing import Any, Literal

from posthog import Posthog

from polar.config import settings
from polar.models.user import User


class Service:
    client: Posthog | None = None

    def configure(self) -> None:
        if not settings.POSTHOG_PROJECT_API_KEY:
            self.client = None
            return

        self.client = Posthog(settings.POSTHOG_PROJECT_API_KEY)
        self.client.disabled = settings.is_testing()
        self.client.debug = settings.DEBUG

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
            properties={
                **self._get_common_properties(),
                **(properties or {}),
            },
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
            properties={
                **self._get_common_properties(),
                **(properties or {}),
            },
        )

    def user_event(
        self,
        user: User,
        # strict typing in an attempt to force a common naming convention for events
        category: Literal["articles", "subscriptions"],
        noun: str,
        verb: Literal[
            "click",
            "submit",
            "create",
            "view",
            "add",
            "invite",
            "update",
            "delete",
            "remove",
            "start",
            "end",
            "cancel",
            "fail",
            "generate",
            "send",
            "archive",
        ],
        properties: dict[str, Any] | None = None,
    ) -> None:
        event = f"{category}:{noun}:{verb}"
        self.user_event_raw(user, event, properties)

    def user_event_raw(
        self,
        user: User,
        event: str,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self.capture(
            user.posthog_distinct_id,
            event=event,
            properties={
                **self._get_common_properties(),
                "$set": self._get_user_properties(user),
                **(properties or {}),
            },
        )

    def identify(self, user: User) -> None:
        if not self.client:
            return

        self.client.identify(
            user.posthog_distinct_id,
            properties={
                **self._get_common_properties(),
                **self._get_user_properties(user),
            },
        )

    def _get_common_properties(self) -> dict[str, Any]:
        return {
            "_environment": settings.ENV,
        }

    def _get_user_properties(self, user: User) -> dict[str, Any]:
        return {
            "username": user.username,
            "email": user.email,
        }


posthog = Service()


def configure_posthog() -> None:
    posthog.configure()
