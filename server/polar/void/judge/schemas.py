from datetime import datetime
from typing import Any, Literal

from pydantic import Field, model_validator

from polar.kit.schemas import Schema
from polar.void.entitlement.schemas import SLUG_PATTERN

WindowUnit = Literal["minute", "hour", "day"]
WINDOW_SECONDS: dict[WindowUnit, int] = {"minute": 60, "hour": 3600, "day": 86400}
MAX_WINDOW_SECONDS = 7 * 86400


class JudgeWindow(Schema):
    amount: int = Field(ge=1)
    unit: WindowUnit

    @model_validator(mode="after")
    def bounded(self) -> "JudgeWindow":
        if self.amount * WINDOW_SECONDS[self.unit] > MAX_WINDOW_SECONDS:
            raise ValueError("window must be at most 7 days")
        return self

    @property
    def seconds(self) -> int:
        return self.amount * WINDOW_SECONDS[self.unit]


class JudgeRequest(Schema):
    meter: str = Field(
        min_length=1,
        pattern=SLUG_PATTERN,
        description="Slug of the meter whose recent events Jev reads.",
    )
    when: str = Field(
        min_length=1,
        max_length=512,
        description="The question Jev answers with a noul, verbatim.",
    )
    over: JudgeWindow = Field(
        default_factory=lambda: JudgeWindow(amount=1, unit="hour"),
        description="How far back the events go. Defaults to the last hour.",
    )
    version_id: str | None = Field(
        default=None,
        pattern=r"^[0-9a-f]{64}$",
        description="Configuration version whose meter to read. Defaults to the active deployment.",
    )


class Evidence(Schema):
    events: int = Field(description="Matching events in the window.")
    identities: int = Field(description="Identities in the subtree that emitted them.")
    first_at: datetime | None
    last_at: datetime | None
    totals: dict[str, float] = Field(
        description="Sum of every numeric metadata key across the window."
    )
    values: dict[str, list[str]] = Field(
        description="Distinct string metadata values per key, capped."
    )
    sample: list[dict[str, Any]] = Field(
        description="The events Jev saw: the first and the most recent ones."
    )


class Judgment(Schema):
    identity_id: str
    root_id: str
    meter: str
    when: str
    over: JudgeWindow
    noul: float | None = Field(
        description="Jev's answer in [0, 1]. Unset until Jev has answered once."
    )
    model: str | None
    judged_at: datetime | None = Field(description="When Jev gave this answer.")
    stale: bool = Field(
        description=(
            "The window changed since this noul was judged. Polar re-asks Jev "
            "at most once a minute per identity and question."
        )
    )
    evidence: Evidence = Field(description="What Jev saw when it answered.")
