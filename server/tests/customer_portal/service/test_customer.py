from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pydantic import ValidationError
from pytest_mock import MockerFixture

from polar.customer_portal.schemas.customer import (
    CustomerPaymentMethodCreate,
    CustomerPortalCustomerUpdate,
)
from polar.customer_portal.service.customer import (
    PaymentMethodSetupFailed,
)
from polar.customer_portal.service.customer import (
    customer as customer_service,
)
from polar.event.system import SystemEvent
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address, AddressInput, CountryAlpha2, CountryAlpha2Input
from polar.models import Customer, Organization, PaymentMethod, Product
from polar.models.checkout import CheckoutStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from polar.tax.tax_id import TaxIDFormat
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_checkout,
    create_customer,
    create_payment_method,
)
from tests.fixtures.stripe import build_stripe_payment_method


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.customer_portal.service.customer.stripe_service", new=mock)
    return mock


@pytest.mark.anyio
class TestAddPaymentMethod:
    async def test_setup_intent_creation_error_propagates(
        self,
        session: AsyncSession,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        error = stripe_lib.InvalidRequestError("No such customer", "customer")
        stripe_service_mock.create_setup_intent.side_effect = error

        with pytest.raises(stripe_lib.InvalidRequestError) as exc_info:
            await customer_service.add_payment_method(
                session,
                customer,
                CustomerPaymentMethodCreate(
                    confirmation_token_id="CONFIRMATION_TOKEN_ID",
                    set_default=True,
                    return_url="https://example.com/return",
                ),
            )

        assert exc_info.value is error
        stripe_service_mock.confirm_setup_intent.assert_not_called()
        stripe_service_mock.update_customer.assert_not_called()

    async def test_unsupported_payment_method(
        self,
        session: AsyncSession,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        stripe_service_mock.confirm_setup_intent.side_effect = (
            stripe_lib.InvalidRequestError(
                "Payment method is excluded", "payment_method"
            )
        )

        with pytest.raises(PaymentMethodSetupFailed):
            await customer_service.add_payment_method(
                session,
                customer,
                CustomerPaymentMethodCreate(
                    confirmation_token_id="CONFIRMATION_TOKEN_ID",
                    set_default=True,
                    return_url="https://example.com/return",
                ),
            )

        assert customer.default_payment_method_id is None
        stripe_service_mock.update_customer.assert_not_called()

    async def test_default_sends_customer_update_events(
        self,
        session: AsyncSession,
        customer: Customer,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        stripe_payment_method = build_stripe_payment_method(
            customer=customer.stripe_customer_id,
            details={
                "brand": "visa",
                "last4": "4242",
                "exp_month": 12,
                "exp_year": 2030,
            },
        )
        setup_intent = stripe_lib.SetupIntent.construct_from(
            {
                "id": "SETUP_INTENT_ID",
                "status": "succeeded",
                "payment_method": stripe_payment_method,
            },
            None,
        )
        stripe_service_mock.create_setup_intent.return_value = setup_intent
        stripe_service_mock.confirm_setup_intent.return_value = setup_intent
        enqueue_job_mock = mocker.patch("polar.customer.repository.enqueue_job")

        result = await customer_service.add_payment_method(
            session,
            customer,
            CustomerPaymentMethodCreate(
                confirmation_token_id="CONFIRMATION_TOKEN_ID",
                set_default=True,
                return_url="https://example.com/return",
            ),
        )
        await session.flush()

        assert result.status == "succeeded"
        assert result.payment_method.customer_id == customer.id
        assert customer.default_payment_method_id == result.payment_method.id
        enqueue_job_mock.assert_any_call(
            "customer.webhook", WebhookEventType.customer_updated, customer.id
        )
        enqueue_job_mock.assert_any_call(
            "customer.event", customer.id, SystemEvent.customer_updated, {}
        )

    async def test_non_default_does_not_send_customer_update_events(
        self,
        session: AsyncSession,
        customer: Customer,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        stripe_payment_method = build_stripe_payment_method(
            customer=customer.stripe_customer_id,
            details={
                "brand": "visa",
                "last4": "4242",
                "exp_month": 12,
                "exp_year": 2030,
            },
        )
        setup_intent = stripe_lib.SetupIntent.construct_from(
            {
                "id": "SETUP_INTENT_ID",
                "status": "succeeded",
                "payment_method": stripe_payment_method,
            },
            None,
        )
        stripe_service_mock.create_setup_intent.return_value = setup_intent
        stripe_service_mock.confirm_setup_intent.return_value = setup_intent
        enqueue_job_mock = mocker.patch("polar.customer.repository.enqueue_job")

        result = await customer_service.add_payment_method(
            session,
            customer,
            CustomerPaymentMethodCreate(
                confirmation_token_id="CONFIRMATION_TOKEN_ID",
                set_default=False,
                return_url="https://example.com/return",
            ),
        )
        await session.flush()

        assert result.status == "succeeded"
        assert result.payment_method.customer_id == customer.id
        assert customer.default_payment_method_id is None
        enqueue_job_mock.assert_not_called()

    async def test_generated_sepa_default(
        self,
        session: AsyncSession,
        customer: Customer,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        original = build_stripe_payment_method(type="ideal")
        generated = build_stripe_payment_method(type="sepa_debit")
        generated.id = "pm_generated"
        intent = stripe_lib.SetupIntent.construct_from(
            {
                "id": "seti_test",
                "status": "succeeded",
                "payment_method": original,
                "latest_attempt": {
                    "id": "setatt_test",
                    "object": "setup_attempt",
                    "payment_method_details": {
                        "type": "ideal",
                        "ideal": {"generated_sepa_debit": generated.id},
                    },
                },
            },
            None,
        )
        stripe_service_mock.create_setup_intent.return_value = intent
        stripe_service_mock.confirm_setup_intent.return_value = intent
        mocker.patch(
            "polar.payment_method.service.stripe_service.get_setup_intent",
            return_value=intent,
        )
        mocker.patch(
            "polar.payment_method.service.stripe_service.get_payment_method",
            return_value=generated,
        )

        response = await customer_service.add_payment_method(
            session,
            customer,
            CustomerPaymentMethodCreate(
                confirmation_token_id="CONFIRMATION_TOKEN_ID",
                set_default=True,
                return_url="https://example.com/return",
            ),
        )

        stripe_service_mock.update_customer.assert_not_called()
        assert response.status == "succeeded"
        assert response.payment_method.type == "sepa_debit"
        assert customer.default_payment_method_id == response.payment_method.id


@pytest.mark.anyio
class TestDeletePaymentMethod:
    async def test_default_sends_customer_update_events(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        payment_method: PaymentMethod,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        customer.default_payment_method = payment_method
        await save_fixture(customer)
        mocker.patch(
            "polar.payment_method.service.stripe_service", new=stripe_service_mock
        )
        enqueue_job_mock = mocker.patch("polar.customer.repository.enqueue_job")

        await customer_service.delete_payment_method(session, payment_method)

        assert payment_method.deleted_at is not None
        assert customer.default_payment_method_id is None
        enqueue_job_mock.assert_any_call(
            "customer.webhook", WebhookEventType.customer_updated, customer.id
        )
        enqueue_job_mock.assert_any_call(
            "customer.event", customer.id, SystemEvent.customer_updated, {}
        )

    async def test_non_default_does_not_send_customer_update_events(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        payment_method: PaymentMethod,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        default_payment_method = await create_payment_method(save_fixture, customer)
        customer.default_payment_method = default_payment_method
        await save_fixture(customer)
        mocker.patch(
            "polar.payment_method.service.stripe_service", new=stripe_service_mock
        )
        enqueue_job_mock = mocker.patch("polar.customer.repository.enqueue_job")

        await customer_service.delete_payment_method(session, payment_method)

        assert payment_method.deleted_at is not None
        assert customer.default_payment_method_id == default_payment_method.id
        assert default_payment_method.deleted_at is None
        enqueue_job_mock.assert_not_called()


@pytest.mark.anyio
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

    async def test_explicit_null_billing_address(self) -> None:
        with pytest.raises(ValidationError):
            CustomerPortalCustomerUpdate.model_validate({"billing_address": None})

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

    @pytest.mark.parametrize(
        (
            "billing_country",
            "checkout_ip_country",
            "default_payment_method",
            "expected_event",
        ),
        [
            pytest.param("SE", "UG", None, None, id="country unchanged"),
            pytest.param(
                "UG",
                "UG",
                ("card", {"country": "SE"}),
                None,
                id="checkout ip confirms",
            ),
            pytest.param(
                "UG", "SE", ("card", {"country": "UG"}), None, id="card confirms"
            ),
            pytest.param(
                "BE",
                "SE",
                ("bancontact", {}),
                None,
                id="implied payment method country confirms",
            ),
            pytest.param(
                "UG",
                "SE",
                ("card", {"country": "SE"}),
                "customer_portal.billing_country_mismatch",
                id="no match",
            ),
            pytest.param(
                "UG",
                None,
                None,
                "customer_portal.billing_country_unverified",
                id="no known country",
            ),
        ],
    )
    async def test_billing_country_mismatch_is_only_logged(
        self,
        billing_country: str,
        checkout_ip_country: str | None,
        default_payment_method: tuple[str, dict[str, str]] | None,
        expected_event: str | None,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        log_mock = mocker.patch("polar.customer_portal.service.customer.log")
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("SE")),
        )
        if default_payment_method is not None:
            type, method_metadata = default_payment_method
            customer.default_payment_method = await create_payment_method(
                save_fixture, customer, type=type, method_metadata=method_metadata
            )
            await save_fixture(customer)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        if checkout_ip_country is not None:
            checkout = await create_checkout(
                save_fixture, products=[product], status=CheckoutStatus.succeeded
            )
            checkout.customer_signals = {"ip_country": checkout_ip_country}
            await save_fixture(checkout)
            subscription.checkout = checkout
            await save_fixture(subscription)

        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(
                billing_address=AddressInput(
                    country=CountryAlpha2Input(billing_country)
                )
            ),
        )

        assert updated_customer.billing_address is not None
        assert updated_customer.billing_address.country == billing_country
        logged_events = [call.args[0] for call in log_mock.info.call_args_list]
        assert logged_events == ([expected_event] if expected_event else [])

    async def test_billing_country_confirmed_by_new_default_payment_method(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        log_mock = mocker.patch("polar.customer_portal.service.customer.log")
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("SE")),
        )
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=await create_payment_method(
                save_fixture, customer, method_metadata={"country": "SE"}
            ),
        )
        payment_method = await create_payment_method(
            save_fixture, customer, method_metadata={"country": "UG"}
        )

        await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(
                billing_address=AddressInput(country=CountryAlpha2Input("UG")),
                default_payment_method_id=payment_method.id,
            ),
        )

        log_mock.info.assert_not_called()

    async def test_billing_country_not_confirmed_by_one_of_several_subscriptions(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        log_mock = mocker.patch("polar.customer_portal.service.customer.log")
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("SE")),
        )
        for country in ("SE", "UG"):
            await create_active_subscription(
                save_fixture,
                product=product,
                customer=customer,
                payment_method=await create_payment_method(
                    save_fixture, customer, method_metadata={"country": country}
                ),
            )

        await customer_service.update(
            session,
            customer,
            CustomerPortalCustomerUpdate(
                billing_address=AddressInput(country=CountryAlpha2Input("UG"))
            ),
        )

        log_mock.info.assert_called_once_with(
            "customer_portal.billing_country_mismatch",
            customer_id=str(customer.id),
            organization_id=str(organization.id),
            checkout_ip_countries=[],
            payment_method_countries=["SE"],
            unconfirmed_subscription_count=1,
            billing_country="UG",
            previous_billing_country="SE",
        )
