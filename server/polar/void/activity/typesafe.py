from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from polar.void.typesafe import TYPESAFE_MODEL, TypeSafe, TypeSafeError

from .taxonomy import ACTIVITY_CRITERIA, ACTIVITY_INSTRUCTIONS, WASTE_INSTRUCTIONS

__all__ = ["Classification", "Classifier", "TypeSafeClassifier", "TypeSafeError"]


@dataclass(frozen=True)
class Classification:
    activity: str
    confidence: float
    waste: float
    model: str


class Classifier(Protocol):
    async def classify(self, state: Mapping[str, Any]) -> Classification: ...


class TypeSafeClassifier(TypeSafe):
    async def classify(self, state: Mapping[str, Any]) -> Classification:
        body = await self.ask(
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
            waste=body["answers"]["waste"]["noul"],
            model=body.get("model") or TYPESAFE_MODEL,
        )
