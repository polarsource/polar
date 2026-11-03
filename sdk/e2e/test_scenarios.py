import typing

import pytest

from harness import Scenario, run
from scenarios import SCENARIOS


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
@pytest.mark.parametrize("scenario", SCENARIOS, ids=lambda scenario: scenario.name)
@pytest.mark.parametrize("language", ["python", "typescript"])
async def test_scenario(
    scenario: Scenario, language: typing.Literal["python", "typescript"]
) -> None:
    await run(scenario, language)
