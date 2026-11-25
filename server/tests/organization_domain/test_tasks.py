from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationDomain
from polar.models.organization import OrganizationStatus
from polar.organization_domain.tasks import (
    register_payment_method_domains,
    unregister_organization_payment_method_domains,
    unregister_payment_method_domains,
)
from tests.fixtures.database import SaveFixture


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

    async def test_enables_disabled_domains(self, mocker: MockerFixture) -> None:
        stripe_service_mock = mocker.patch(
            "polar.organization_domain.tasks.stripe_service", autospec=True
        )
        stripe_service_mock.get_payment_method_domain = AsyncMock(
            return_value=MagicMock(id="pmd_123", enabled=False)
        )

        await register_payment_method_domains(["acme.com"])

        stripe_service_mock.update_payment_method_domain.assert_awaited_once_with(
            "pmd_123", enabled=True
        )
        stripe_service_mock.create_payment_method_domain.assert_not_awaited()


@pytest.mark.anyio
class TestUnregisterPaymentMethodDomains:
    async def test_disables_domains_no_longer_vouched_for(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        stripe_service_mock = mocker.patch(
            "polar.organization_domain.tasks.stripe_service", autospec=True
        )
        stripe_service_mock.get_payment_method_domain = AsyncMock(
            side_effect=lambda domain: MagicMock(id=f"pmd_{domain}", enabled=True)
        )
        organization.embed_hosts = ["shop.acme.com"]
        await save_fixture(organization)
        await save_fixture(
            OrganizationDomain(
                organization=organization, domain="acme.com", verified_at=utc_now()
            )
        )

        await unregister_payment_method_domains(["shop.acme.com", "old.acme.com"])

        stripe_service_mock.update_payment_method_domain.assert_awaited_once_with(
            "pmd_old.acme.com", enabled=False
        )

    async def test_disables_domains_of_organizations_without_checkout(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        stripe_service_mock = mocker.patch(
            "polar.organization_domain.tasks.stripe_service", autospec=True
        )
        stripe_service_mock.get_payment_method_domain = AsyncMock(
            return_value=MagicMock(id="pmd_123", enabled=True)
        )
        organization.capabilities = {
            **organization.capabilities,
            "checkout_payments": False,
        }
        organization.embed_hosts = ["shop.acme.com"]
        await save_fixture(organization)
        await save_fixture(
            OrganizationDomain(
                organization=organization, domain="acme.com", verified_at=utc_now()
            )
        )

        await unregister_payment_method_domains(["shop.acme.com"])

        stripe_service_mock.update_payment_method_domain.assert_awaited_once_with(
            "pmd_123", enabled=False
        )


@pytest.mark.anyio
class TestUnregisterOrganizationPaymentMethodDomains:
    async def test_blocked_organization(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization_domain.service.enqueue_job")
        organization.status = OrganizationStatus.BLOCKED
        organization.embed_hosts = ["shop.acme.com"]
        await save_fixture(organization)
        await save_fixture(
            OrganizationDomain(
                organization=organization, domain="acme.com", verified_at=utc_now()
            )
        )

        await unregister_organization_payment_method_domains(organization.id)

        enqueue_job_mock.assert_called_once_with(
            "organization_domain.unregister_payment_method_domains",
            domains=["shop.acme.com"],
        )
