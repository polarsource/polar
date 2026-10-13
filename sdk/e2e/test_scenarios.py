import pytest

from harness import Scenario, run
from scenarios import SCENARIOS

MODES = {
    "python": {"writer": "python", "reader": "python"},
    "typescript": {"writer": "typescript", "reader": "typescript"},
    "mixed": {"writer": "python", "reader": "typescript"},
    "mixed-reverse": {"writer": "typescript", "reader": "python"},
}


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
@pytest.mark.parametrize("scenario", SCENARIOS, ids=lambda scenario: scenario.name)
@pytest.mark.parametrize("mode", MODES)
async def test_scenario(scenario: Scenario, mode: str) -> None:
    await run(scenario, MODES[mode])
