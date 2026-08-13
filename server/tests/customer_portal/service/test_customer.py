from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.customer_portal.schemas.customer import CustomerPortalCustomerUpdate
from polar.customer_portal.service.customer import customer as customer_service
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address, AddressInput, CountryAlpha2, CountryAlpha2Input
from polar.models import Organization
from polar.postgres import AsyncSession
from polar.tax.tax_id import TaxIDFormat
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
        with pytest.raises(PolarRequestValidationError) as exc_info:
            await customer_service.update(
                session,
                customer,
                CustomerPortalCustomerUpdate(
                    tax_id="FR61954506077",
                ),
            )
        errors = exc_info.value.errors()
        assert errors[0]["loc"] == ("body", "tax_id")
        assert errors[0]["input"] == "FR61954506077"

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
        with pytest.raises(PolarRequestValidationError) as exc_info:
            await customer_service.update(
                session,
                customer,
                CustomerPortalCustomerUpdate(
                    billing_address=AddressInput(country=CountryAlpha2Input("GB")),
                ),
            )
        errors = exc_info.value.errors()
        assert errors[0]["loc"] == ("body", "tax_id")
        assert errors[0]["input"] == "FR61954506077"

    async def test_explicit_null_billing_address(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        with pytest.raises(PolarRequestValidationError):
            await customer_service.update(
                session, customer, CustomerPortalCustomerUpdate(billing_address=None)
            )
        assert customer.billing_address is not None

    async def test_billing_name_update(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
        )

        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(
                billing_name="Polar Software Inc.",
            ),
        )

        assert updated_customer.billing_name == "Polar Software Inc."

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
                billing_name="Polar Software Inc.",
                billing_address=AddressInput(country=CountryAlpha2Input("FR")),
                tax_id="FR61954506077",
            ),
        )

        assert updated_customer.billing_name == "Polar Software Inc."
        assert updated_customer.billing_address is not None
        assert updated_customer.billing_address.country == "FR"
        assert updated_customer.tax_id is not None
        assert updated_customer.tax_id == ("FR61954506077", TaxIDFormat.eu_vat)

        stripe_service_mock.update_customer.assert_called_once()

    async def test_clear_tax_id_with_empty_string(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        stripe_service_mock: MagicMock,
    ) -> None:
        """Sending tax_id="" (normalized to None) clears an existing tax_id."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
            tax_id=("FR61954506077", TaxIDFormat.eu_vat),
        )
        assert customer.tax_id is not None

        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(tax_id=""),
        )

        assert updated_customer.tax_id is None
        # Stripe sync still fires with no tax_id datum
        stripe_service_mock.update_customer.assert_called_once()

    async def test_clear_tax_id_with_explicit_none(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Explicitly sending tax_id=null clears an existing tax_id."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
            tax_id=("FR61954506077", TaxIDFormat.eu_vat),
        )
        assert customer.tax_id is not None

        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(tax_id=None),
        )

        assert updated_customer.tax_id is None

    async def test_update_billing_name_does_not_revalidate_tax_id(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Updating an unrelated field must not re-validate an existing tax_id."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
            tax_id=("FR61954506077", TaxIDFormat.eu_vat),
        )

        mock_validate = mocker.patch(
            "polar.customer_portal.service.customer.validate_tax_id"
        )
        mock_validate.return_value = ("FR61954506077", TaxIDFormat.eu_vat)

        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(billing_name="New Billing Name"),
        )

        assert not mock_validate.called
        assert updated_customer.billing_name == "New Billing Name"
        assert updated_customer.tax_id is not None
        assert updated_customer.tax_id[0] == "FR61954506077"

    async def test_update_tax_id_to_new_valid_value(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Replacing an existing tax_id with a new valid value validates and stores it."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
            tax_id=("FR61954506077", TaxIDFormat.eu_vat),
        )

        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(tax_id="FR00300076965"),
        )

        assert updated_customer.tax_id is not None
        assert updated_customer.tax_id[0] == "FR00300076965"
        assert updated_customer.tax_id[1] == TaxIDFormat.eu_vat

    async def test_billing_address_change_revalidates_tax_id_to_valid_country(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Changing billing_address while a tax_id is set re-validates the existing
        tax_id against the new country (success path)."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("DE")),
            tax_id=("DE114103379", TaxIDFormat.eu_vat),
        )

        # Re-supply the same country — re-validation succeeds, tax_id unchanged
        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(
                billing_address=AddressInput(country=CountryAlpha2Input("DE"))
            ),
        )

        assert updated_customer.tax_id is not None
        assert updated_customer.tax_id[0] == "DE114103379"
        assert updated_customer.tax_id[1] == TaxIDFormat.eu_vat

    async def test_tax_id_omitted_keeps_existing(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Omitting tax_id from the update entirely keeps the existing value
        and does not trigger validation."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
            tax_id=("FR61954506077", TaxIDFormat.eu_vat),
        )

        mock_validate = mocker.patch(
            "polar.customer_portal.service.customer.validate_tax_id"
        )
        mock_validate.return_value = ("FR61954506077", TaxIDFormat.eu_vat)

        # Update only billing_name — tax_id and billing_address both omitted
        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(billing_name="Some Name"),
        )

        assert not mock_validate.called
        assert updated_customer.tax_id is not None
        assert updated_customer.tax_id[0] == "FR61954506077"
