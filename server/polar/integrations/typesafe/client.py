from typing import Any, Literal, NotRequired, TypedDict

import httpx

from polar.config import settings
from polar.exceptions import PolarError

API_URL = "https://api.typesafe.ai/v1/systemone"
DEFAULT_MODEL = "jev-latest"


class NoulCriteria(TypedDict):
    true: str
    false: str


class NoulQuestion(TypedDict):
    type: Literal["noul"]
    instructions: str
    criteria: NotRequired[NoulCriteria]


class ChoiceQuestion(TypedDict):
    type: Literal["choice"]
    instructions: str
    criteria: dict[str, str | None]


class ScoreQuestion(TypedDict):
    type: Literal["score"]
    instructions: str
    criteria: list[str]


Question = NoulQuestion | ChoiceQuestion | ScoreQuestion


class NoulAnswer(TypedDict):
    type: Literal["noul"]
    noul: float


class ChoiceAnswer(TypedDict):
    type: Literal["choice"]
    choice: str
    probabilities: dict[str, float]
    confidence: float


class ScoreAnswer(TypedDict):
    type: Literal["score"]
    score: float
    probabilities: list[float]
    confidence: float


Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer


class SystemOneResponse(TypedDict):
    model: str
    answers: dict[str, Answer]
    usage: dict[str, int]


class TypeSafeClientError(PolarError): ...


class TypeSafeNotConfigured(TypeSafeClientError):
    def __init__(self) -> None:
        super().__init__("TYPESAFE_API_KEY is not set", 500)


class TypeSafeClient:
    @property
    def is_configured(self) -> bool:
        return settings.TYPESAFE_API_KEY is not None

    async def system_one(
        self,
        state: Any,
        questions: dict[str, Question],
        *,
        model: str = DEFAULT_MODEL,
    ) -> SystemOneResponse:
        """Evaluate typed questions against `state`; answers are keyed like `questions`."""
        if settings.TYPESAFE_API_KEY is None:
            raise TypeSafeNotConfigured()

        async with httpx.AsyncClient(
            headers={"Authorization": f"Bearer {settings.TYPESAFE_API_KEY}"},
            timeout=httpx.Timeout(10.0, connect=5.0),
        ) as client:
            response = await client.post(
                API_URL,
                json={"model": model, "state": state, "questions": questions},
            )
            response.raise_for_status()

        return response.json()


typesafe = TypeSafeClient()
