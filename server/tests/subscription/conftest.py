import random
import string
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService


def rstr(prefix: str) -> str:
    return f"{prefix}.{''.join(random.choices(string.ascii_uppercase + string.digits, k=6))}"


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch(
        "polar.subscription.service.subscription_tier.stripe_service", new=mock
    )
    mocker.patch(
        "polar.subscription.service.subscribe_session.stripe_service", new=mock
    )
    mocker.patch("polar.subscription.service.subscription.stripe_service", new=mock)
    return mock
