from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import structlog

from polar.config import settings

from .taxonomy import (
    ACTIVITY_CRITERIA,
    ACTIVITY_INSTRUCTIONS,
    TYPESAFE_MODEL,
    WASTE_INSTRUCTIONS,
)

log = structlog.get_logger()

TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone"


class TypeSafeError(Exception):
    pass


@dataclass(frozen=True)
class Classification:
    activity: str
    confidence: float
    probabilities: dict[str, float]
    waste: float
    model: str


class Classifier(Protocol):
    async def classify(self, state: Mapping[str, Any]) -> Classification: ...


class TypeSafeClassifier:
    def __init__(
        self,
        api_key: str | None = None,
        *,
        url: str = TYPESAFE_URL,
        timeout: float = 15,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.TYPESAFE_API_KEY
        self.url = url
        self.timeout = timeout

    async def classify(self, state: Mapping[str, Any]) -> Classification:
        if not self.api_key:
            raise TypeSafeError("TYPESAFE_API_KEY is not set")
        payload = {
            "model": TYPESAFE_MODEL,
            "state": state,
            "questions": {
                "activity": {
                    "type": "choice",
                    "instructions": ACTIVITY_INSTRUCTIONS,
                    "criteria": ACTIVITY_CRITERIA,
                },
                "waste": {
                    "type": "noul",
                    "instructions": WASTE_INSTRUCTIONS,
                },
            },
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self.url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
            )
        if response.status_code >= 400:
            raise TypeSafeError(
                f"TypeSafe {response.status_code}: {response.text[:300]}"
            )
        body = response.json()
        answers = body["answers"]
        activity = answers["activity"]
        return Classification(
            activity=activity["choice"],
            confidence=float(activity["confidence"]),
            probabilities={
                key: float(value) for key, value in activity["probabilities"].items()
            },
            waste=float(answers["waste"]["noul"]),
            model=body.get("model", TYPESAFE_MODEL),
        )


class StaticClassifier:
    def __init__(self, result: Classification) -> None:
        self.result = result

    async def classify(self, state: Mapping[str, Any]) -> Classification:
        return self.result
