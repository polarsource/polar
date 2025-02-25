from unittest.mock import MagicMock

import pytest
from pydantic_extra_types.country import CountryAlpha2
from pytest_mock import MockerFixture

from polar.customer_portal.schemas.customer import CustomerPortalCustomerUpdate
from polar.customer_portal.service.customer import customer as customer_service
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address
from polar.kit.tax import TaxIDFormat
from polar.models import Customer, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.customer_portal.service.customer.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestUpdate:
    async def test_tax_id_no_country(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=None,
            tax_id=None,
        )
        with pytest.raises(PolarRequestValidationError):
            await customer_service.update(
                session,
                customer,
                CustomerPortalCustomerUpdate(
                    tax_id="FR61954506077",
                ),
            )

    async def test_tax_id_country_set_mismatch(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("GB")),
            tax_id=None,
        )
        with pytest.raises(PolarRequestValidationError):
            await customer_service.update(
                session,
                customer,
                CustomerPortalCustomerUpdate(
                    tax_id="FR61954506077",
                ),
            )

    async def test_country_tax_id_set_mismatch(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
            tax_id=("FR61954506077", TaxIDFormat.eu_vat),
        )
        with pytest.raises(PolarRequestValidationError):
            await customer_service.update(
                session,
                customer,
                CustomerPortalCustomerUpdate(
                    billing_address=Address(country=CountryAlpha2("GB")),
                ),
            )

    async def test_email_already_exists(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        new_customer = await create_customer(
            save_fixture,
            organization=organization,
        )
        with pytest.raises(PolarRequestValidationError):
            await customer_service.update(
                session,
                new_customer,
                CustomerPortalCustomerUpdate(
                    email=customer.email,
                ),
            )

    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        stripe_service_mock: MagicMock,
    ) -> None:
        customer = await create_customer(save_fixture, organization=organization)

        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(
                name="Updated Name",
                billing_address=Address(country=CountryAlpha2("FR")),
                tax_id="FR61954506077",
            ),
        )

        assert updated_customer.name == "Updated Name"
        assert updated_customer.billing_address is not None
        assert updated_customer.billing_address.country == "FR"
        assert updated_customer.tax_id is not None
        assert updated_customer.tax_id == ("FR61954506077", TaxIDFormat.eu_vat)

        stripe_service_mock.update_customer.assert_called_once()
