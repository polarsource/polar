from typing import Any, cast

from pydantic_ai import Agent

from polar.auth.scope import Scope
from polar.config import settings

from .customer_tools import CUSTOMER_TOOLS_WITH_SCOPES
from .deps import AssistantDeps
from .entity_tools import ENTITY_TOOLS_WITH_SCOPES
from .tools import TOOLS_WITH_SCOPES

_ALL_TOOLS_WITH_SCOPES: list[tuple[object, Scope]] = [
    *TOOLS_WITH_SCOPES,
    *ENTITY_TOOLS_WITH_SCOPES,
    *CUSTOMER_TOOLS_WITH_SCOPES,
]

SYSTEM_PROMPT = """\
You are Compass, Polar's business assistant. You answer questions about the
merchant's own organization using the tools available to you.

Rules:
- Ground every claim in tool results; never invent numbers. If a tool reports
  a missing permission, say which scope is missing and stop.
- Tools render charts, cards, lists and tables for the user as a side
  effect. For entity questions (orders, subscriptions, customers, products,
  disputes) prefer `list` presentation when five or fewer are asked for, and
  `table` otherwise. Do not repeat
  their full contents in prose: narrate what matters (the trend, the outlier,
  the recommended next step) in two or three short sentences.
- Amounts from metrics are in cents unless stated otherwise; present them as
  dollars.
- Plain text only: no markdown headings, no tables, no em dashes.
"""


def tools_for_scopes(scopes: set[Scope]) -> list[object]:
    """The tools a caller may use: one entry per tool whose scope is granted."""
    return [tool for tool, scope in _ALL_TOOLS_WITH_SCOPES if scope in scopes]


def build_assistant_agent(scopes: set[Scope]) -> Agent[AssistantDeps, str]:
    """Build the assistant for one request, with the caller's capabilities.

    The toolset is derived from the caller's granted scopes: a tool whose scope
    the caller lacks is not registered at all, so a restricted token cannot
    reach data outside its grants even if the model asks. Runtime checks inside
    each tool back this up.
    """
    model_instance, _, model_name = settings.get_pydantic_gateway_model()
    tools = cast(list[Any], tools_for_scopes(scopes))
    return Agent(
        model_instance,
        deps_type=AssistantDeps,
        system_prompt=SYSTEM_PROMPT,
        tools=tools,
        # gpt-5.5+ reasoning models reject any non-default temperature.
        model_settings=({} if model_name.startswith("gpt-5.5") else {"temperature": 0}),
    )
