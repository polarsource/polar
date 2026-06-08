from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.customer_portal.schemas.customer import (
    CustomerPaymentMethodCreate,
    CustomerPortalCustomerUpdate,
)
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
                    billing_address=AddressInput(country=CountryAlpha2Input("GB")),
                ),
            )

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


@pytest.mark.asyncio
class TestAddPaymentMethod:
    async def test_stripe_customer_creation_uses_idempotency_key(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        stripe_service_mock: MagicMock,
    ) -> None:
        """Customer-portal-driven Stripe customer creation must pass a stable
        idempotency key so that a retry after a transaction rollback reuses
        the same Stripe customer.
        """
        customer = await create_customer(
            save_fixture, organization=organization, stripe_customer_id=None
        )

        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )
        stripe_service_mock.create_setup_intent.return_value = SimpleNamespace(
            id="SETUP_INTENT_ID",
            status="requires_action",
            client_secret="CLIENT_SECRET",
        )
        stripe_service_mock.confirm_setup_intent.return_value = SimpleNamespace(
            id="SETUP_INTENT_ID",
            status="requires_action",
            client_secret="CLIENT_SECRET",
            payment_method=None,
            customer="STRIPE_CUSTOMER_ID",
        )

        await customer_service.add_payment_method(
            session,
            customer,
            CustomerPaymentMethodCreate(
                confirmation_token_id="CONFIRMATION_TOKEN_ID",
                set_default=False,
                return_url="https://example.com/return",
            ),
        )

        stripe_service_mock.create_customer.assert_called_once()
        call_kwargs = stripe_service_mock.create_customer.call_args.kwargs
        assert (
            call_kwargs["idempotency_key"]
            == f"customer-portal-customer-{customer.id}"
        )
        assert call_kwargs["metadata"] == {
            "organization_id": str(customer.organization_id)
        }
