"""The TypeSafe System One client: state in, typed answers out."""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from polar.config import settings

TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone"
TYPESAFE_MODEL = "jev-latest"


class TypeSafeError(Exception):
    pass


@dataclass(frozen=True)
class Judgment:
    noul: float
    model: str


class Judge(Protocol):
    async def judge(self, state: Mapping[str, Any], when: str) -> Judgment: ...


class TypeSafe:
    async def judge(self, state: Mapping[str, Any], when: str) -> Judgment:
        body = await self.ask(state, {"noul": {"type": "noul", "instructions": when}})
        return Judgment(
            noul=body["answers"]["noul"]["noul"],
            model=body.get("model") or TYPESAFE_MODEL,
        )

    async def ask(
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
