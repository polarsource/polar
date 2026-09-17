from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from polar.config import settings

from .taxonomy import (
    ACTIVITY_CRITERIA,
    ACTIVITY_INSTRUCTIONS,
    TYPESAFE_MODEL,
    WASTE_INSTRUCTIONS,
)

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


@dataclass(frozen=True)
class Judgment:
    noul: float
    model: str


class Classifier(Protocol):
    async def classify(self, state: Mapping[str, Any]) -> Classification: ...


class Judge(Protocol):
    async def judge(self, state: Mapping[str, Any], when: str) -> Judgment: ...


class TypeSafeClassifier:
    async def classify(self, state: Mapping[str, Any]) -> Classification:
        body = await self._ask(
            state,
            {
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
        )
        activity = body["answers"]["activity"]
        return Classification(
            activity=activity["choice"],
            confidence=activity["confidence"],
            probabilities=activity["probabilities"],
            waste=body["answers"]["waste"]["noul"],
            model=body.get("model") or TYPESAFE_MODEL,
        )

    async def judge(self, state: Mapping[str, Any], when: str) -> Judgment:
        body = await self._ask(
            state,
            {
                "noul": {
                    "type": "noul",
                    "instructions": when,
                },
            },
        )
        return Judgment(
            noul=body["answers"]["noul"]["noul"],
            model=body.get("model") or TYPESAFE_MODEL,
        )

    async def _ask(
        self, state: Mapping[str, Any], questions: Mapping[str, Any]
    ) -> dict[str, Any]:
        api_key = settings.TYPESAFE_AI_KEY
        if not api_key:
            raise TypeSafeError("TYPESAFE_AI_KEY is not set")
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                TYPESAFE_URL,
                json={
                    "model": TYPESAFE_MODEL,
                    "state": state,
                    "questions": questions,
                },
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
        if response.status_code >= 400:
            raise TypeSafeError(
                f"TypeSafe {response.status_code}: {response.text[:300]}"
            )
        return response.json()
