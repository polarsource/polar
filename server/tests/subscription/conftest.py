from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.subscription.service.subscription.stripe_service", new=mock)
    return mock
