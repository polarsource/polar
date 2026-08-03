from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.benefit.strategies import BenefitServiceProtocol


@pytest.fixture(autouse=True)
def benefit_strategy_mock(mocker: MockerFixture) -> MagicMock:
    strategy_mock = MagicMock(spec=BenefitServiceProtocol)
    strategy_mock.should_revoke_individually = False
    strategy_mock.grant.return_value = {}
    strategy_mock.revoke.return_value = {}
    strategy_mock.cycle.return_value = {}
    mock = mocker.patch("polar.benefit.grant.service.get_benefit_strategy")
    mock.return_value = strategy_mock
    return strategy_mock
