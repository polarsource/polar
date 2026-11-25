from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.organization_domain.tasks import register_payment_method_domains


@pytest.mark.anyio
class TestRegisterPaymentMethodDomains:
    async def test_skips_registered_domains(self, mocker: MockerFixture) -> None:
        stripe_service_mock = mocker.patch(
            "polar.organization_domain.tasks.stripe_service", autospec=True
        )
        stripe_service_mock.get_payment_method_domain = AsyncMock(
            side_effect=lambda domain: MagicMock() if domain == "acme.com" else None
        )

        await register_payment_method_domains(["acme.com", "shop.acme.com"])

        stripe_service_mock.create_payment_method_domain.assert_awaited_once_with(
            "shop.acme.com"
        )
