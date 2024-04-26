from __future__ import annotations

from typing import Any, Literal

from posthog import Posthog

from polar.auth.models import AuthSubject, Subject, is_organization, is_user
from polar.config import settings
from polar.models import Organization, User

ORGANIZATION_EVENT_DISTINCT_ID = "organization_event"

EventCategory = Literal[
    "articles",
    "benefits",
    "subscriptions",
    "user",
    "organizations",
]
EventNoun = str
EventVerb = Literal[
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
    "done",
]


def _build_event_key(category: EventCategory, noun: EventNoun, verb: EventVerb) -> str:
    return f"{category}:{noun}:{verb}"


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
        *,
        properties: dict[str, Any] | None = None,
        groups: dict[str, Any] | None = None,
    ) -> None:
        if not self.client:
            return

        self.client.capture(
            distinct_id,
            event=event,
            groups=groups,
            properties={
                **self._get_common_properties(),
                **(properties or {}),
            },
        )

    def auth_subject_event(
        self,
        auth_subject: AuthSubject[Subject],
        category: EventCategory,
        noun: EventNoun,
        verb: EventVerb,
        properties: dict[str, Any] | None = None,
    ) -> None:
        event = f"{category}:{noun}:{verb}"

        if is_user(auth_subject):
            self.user_event(auth_subject.subject, category, noun, verb, properties)
        elif is_organization(auth_subject):
            self.organization_event(
                auth_subject.subject, category, noun, verb, properties
            )
        else:
            self.anonymous_event(category, noun, verb, properties)

    def anonymous_event(
        self,
        category: EventCategory,
        noun: EventNoun,
        verb: EventVerb,
        properties: dict[str, Any] | None = None,
    ) -> None:
        """Shorthand for one-off anonymous event capture."""
        self.capture(
            distinct_id="polar_anonymous",
            event=_build_event_key(category, noun, verb),
            properties={
                **self._get_common_properties(),
                **(properties or {}),
            },
        )

    def user_event(
        self,
        user: User,
        category: EventCategory,
        noun: EventNoun,
        verb: EventVerb,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self.capture(
            user.posthog_distinct_id,
            event=_build_event_key(category, noun, verb),
            properties={
                **self._get_common_properties(),
                "$set": self._get_user_properties(user),
                **(properties or {}),
            },
        )

    def organization_event(
        self,
        organization: Organization,
        category: EventCategory,
        noun: EventNoun,
        verb: EventVerb,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self.capture(
            ORGANIZATION_EVENT_DISTINCT_ID,  # Ref: https://posthog.com/docs/product-analytics/group-analytics#advanced-server-side-only-capturing-group-events-without-a-user
            event=_build_event_key(category, noun, verb),
            groups={
                "organization": str(organization.id),
            },
            properties={
                **self._get_common_properties(),
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
