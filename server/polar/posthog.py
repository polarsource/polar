from __future__ import annotations

from typing import Any, Literal

from posthog import Posthog

from polar.auth.models import AuthSubject, Subject, is_organization, is_user
from polar.config import settings
from polar.models import Organization, User

ORGANIZATION_EVENT_DISTINCT_ID = "organization_event"

EventCategory = Literal[
    "benefits",
    "subscriptions",
    "user",
    "organizations",
    "issues",
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
    "open",
    "close",
]


def _build_event_key(category: EventCategory, noun: EventNoun, verb: EventVerb) -> str:
    # Surface is interesting in the client-side implementation to determine
    # which product area the customer engaged with. For programmatic & async
    # operations on the backend we hardcode all of them to `backend`.
    return f"backend:{category}:{noun}:{verb}"


class Service:
    client: Posthog | None = None

    def configure(self) -> None:
        if not settings.POSTHOG_PROJECT_API_KEY:
            self.client = None
            return

        self.client = Posthog(settings.POSTHOG_PROJECT_API_KEY)
        self.client.disabled = settings.is_testing()
        self.client.debug = settings.POSTHOG_DEBUG
        self.client.feature_enabled

    def has_feature_flag(self, auth_subject: AuthSubject[Subject], flag: str) -> bool:
        if not self.client:
            return True

        if is_user(auth_subject):
            return (
                self.client.feature_enabled(
                    flag, distinct_id=auth_subject.subject.posthog_distinct_id
                )
                or False
            )

        return False

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
            event,
            distinct_id=distinct_id,
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

        self.client.set(
            distinct_id=user.posthog_distinct_id,
            properties={
                **self._get_common_properties(),
                **self._get_user_properties(user),
            },
        )

    def user_login(
        self, user: User, method: Literal["github", "google", "apple", "ml", "code"]
    ) -> None:
        self.identify(user)
        self.user_event(user, "user", "login", "done", {"method": method})

    def user_signup(
        self, user: User, method: Literal["github", "google", "apple", "ml", "code"]
    ) -> None:
        self.identify(user)
        self.user_event(user, "user", "signup", "done", {"method": method})

    def _get_common_properties(self) -> dict[str, Any]:
        return {
            "_environment": settings.ENV,
        }

    def _get_user_properties(self, user: User) -> dict[str, Any]:
        user_data = {"email": user.email, "verified": user.email_verified}

        signup = {}
        signup_attribution = user.signup_attribution
        if signup_attribution:
            for key, value in signup_attribution.items():
                signup[f"signup_{key}"] = value

        user_data.update(signup)
        return user_data


posthog = Service()


def configure_posthog() -> None:
    posthog.configure()
