from typing import Any, Literal

from posthog import Posthog

from polar.config import settings
from polar.logging import ClientContext
from polar.models import Agent, User

EventCategory = Literal[
    "agent",
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
                # Mobile client identification
                **ClientContext.get(),
                **(properties or {}),
            },
        )

    def agent_event(
        self,
        agent: Agent,
        noun: EventNoun,
        verb: EventVerb,
        properties: dict[str, Any] | None = None,
    ) -> None:
        self.capture(
            f"agent:{agent.id}",
            event=_build_event_key("agent", noun, verb),
            properties={
                **self._get_common_properties(),
                "agent_id": str(agent.id),
                "agent_name": agent.name,
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

    def _get_common_properties(self) -> dict[str, Any]:
        return {
            "_environment": settings.ENV,
        }

    def _get_user_properties(self, user: User) -> dict[str, Any]:
        user_data: dict[str, Any] = {"verified": user.email_verified}

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
