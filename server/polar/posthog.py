from __future__ import annotations

import uuid
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

    def get_anonymous_client(self) -> AnonymousClient:
        return AnonymousClient(self)

    def anonymous_event(
        self,
        event: str,
        properties: dict[str, Any] | None = None,
    ) -> None:
        """Shorthand for one-off anonymous event capture."""
        client = self.get_anonymous_client()
        client.capture(
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
            properties={
                "username": user.username,
            },
        )


class AnonymousClient:
    """Service wrapper to support anonymous event capture.

    Useful to support getting an anonymous client with a retained distinct_id
    between capture calls, e.g multiple events for the same anonymous user.
    """

    def __init__(self, service: Service) -> None:
        self.service = service
        self.anonymous_id = "anon:" + str(uuid.uuid4())

    def capture(
        self,
        event: str,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self.service.capture(
            self.anonymous_id,
            event=event,
            properties=properties,
        )


posthog = Service()
