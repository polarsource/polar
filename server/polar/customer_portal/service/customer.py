from typing import cast

import stripe as stripe_lib

from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.pagination import ListResource, Pagination
from polar.kit.tax import InvalidTaxID, to_stripe_tax_id, validate_tax_id
from polar.models import Customer
from polar.postgres import AsyncSession

from ..schemas.customer import (
    CustomerPaymentMethod,
    CustomerPaymentMethodCreate,
    CustomerPaymentMethodTypeAdapter,
    CustomerPortalCustomerUpdate,
)


class CustomerService:
    async def update(
        self,
        session: AsyncSession,
        customer: Customer,
        customer_update: CustomerPortalCustomerUpdate,
    ) -> Customer:
        if customer_update.email is not None:
            repository = CustomerRepository.from_session(session)
            existing_customer = await repository.get_by_email_and_organization(
                customer_update.email, customer.organization_id
            )
            if existing_customer is not None and existing_customer.id != customer.id:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "email"),
                            "msg": "Another customer with this email already exists.",
                            "input": customer_update.email,
                        }
                    ]
                )

        customer.billing_address = (
            customer_update.billing_address or customer.billing_address
        )

        tax_id = customer_update.tax_id or (
            customer.tax_id[0] if customer.tax_id else None
        )
        if tax_id is not None:
            if customer.billing_address is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "missing",
                            "loc": ("body", "billing_address"),
                            "msg": "Country is required to validate tax ID.",
                            "input": None,
                        }
                    ]
                )
            try:
                customer.tax_id = validate_tax_id(
                    tax_id, customer.billing_address.country
                )
            except InvalidTaxID as e:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "invalid",
                            "loc": ("body", "tax_id"),
                            "msg": "Invalid tax ID.",
                            "input": customer_update.tax_id,
                        }
                    ]
                ) from e

        repository = CustomerRepository.from_session(session)
        customer = await repository.update(
            customer,
            update_dict=customer_update.model_dump(
                exclude_unset=True, exclude={"billing_address", "tax_id"}
            ),
        )

        if customer.stripe_customer_id is not None:
            params: stripe_lib.Customer.ModifyParams = {"email": customer.email}
            if customer.name is not None:
                params["name"] = customer.name
            if customer.billing_address is not None:
                params["address"] = customer.billing_address.to_dict()  # type: ignore
            await stripe_service.update_customer(
                customer.stripe_customer_id,
                tax_id=to_stripe_tax_id(customer.tax_id)
                if customer.tax_id is not None
                else None,
                **params,
            )

        return customer

    async def list_payment_methods(
        self, customer: Customer
    ) -> ListResource[CustomerPaymentMethod]:
        items: list[CustomerPaymentMethod] = []
        if customer.stripe_customer_id is not None:
            stripe_customer = await stripe_service.get_customer(
                customer.stripe_customer_id
            )
            default_payment_method_id: str | None = None
            if (
                stripe_customer.invoice_settings
                and stripe_customer.invoice_settings.default_payment_method
            ):
                default_payment_method_id = get_expandable_id(
                    stripe_customer.invoice_settings.default_payment_method
                )
            items = [
                CustomerPaymentMethodTypeAdapter.validate_python(
                    {
                        **payment_method,
                        "default": payment_method.id == default_payment_method_id,
                    }
                )
                async for payment_method in stripe_service.list_payment_methods(
                    customer.stripe_customer_id
                )
            ]
        items.sort(key=lambda x: x.created_at, reverse=True)

        return ListResource(
            items=items, pagination=Pagination(total_count=len(items), max_page=1)
        )

    async def add_payment_method(
        self,
        session: AsyncSession,
        customer: Customer,
        payment_method_create: CustomerPaymentMethodCreate,
    ) -> CustomerPaymentMethod:
        if customer.stripe_customer_id is None:
            params: stripe_lib.Customer.CreateParams = {
                "email": customer.email,
            }
            if customer.name is not None:
                params["name"] = customer.name
            if customer.billing_address is not None:
                params["address"] = customer.billing_address.to_dict()  # type: ignore
            if customer.tax_id is not None:
                params["tax_id_data"] = [to_stripe_tax_id(customer.tax_id)]
            stripe_customer = await stripe_service.create_customer(**params)
            repository = CustomerRepository.from_session(session)
            customer = await repository.update(
                customer, update_dict={"stripe_customer_id": stripe_customer.id}
            )
            assert customer.stripe_customer_id is not None

        setup_intent = await stripe_service.create_setup_intent(
            automatic_payment_methods={"enabled": True},
            confirm=True,
            confirmation_token=payment_method_create.confirmation_token_id,
            customer=customer.stripe_customer_id,
            metadata={
                "customer_id": str(customer.id),
            },
            return_url=payment_method_create.return_url,
            expand=["payment_method"],
        )
        assert setup_intent.payment_method is not None

        if payment_method_create.set_default:
            await stripe_service.update_customer(
                customer.stripe_customer_id,
                invoice_settings={
                    "default_payment_method": get_expandable_id(
                        setup_intent.payment_method
                    )
                },
            )

        return CustomerPaymentMethodTypeAdapter.validate_python(
            {
                **cast(stripe_lib.PaymentMethod, setup_intent.payment_method),
                "default": payment_method_create.set_default,
            }
        )

    async def delete_payment_method(
        self, customer: Customer, payment_method_id: str
    ) -> None:
        if customer.stripe_customer_id is None:
            raise ResourceNotFound()

        payment_method = await stripe_service.get_payment_method(payment_method_id)
        if (
            payment_method is None
            or payment_method.customer is None
            or get_expandable_id(payment_method.customer) != customer.stripe_customer_id
        ):
            raise ResourceNotFound()

        await stripe_service.delete_payment_method(payment_method_id)


customer = CustomerService()
