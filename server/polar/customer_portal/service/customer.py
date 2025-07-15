from collections.abc import Sequence
from typing import cast
from uuid import UUID

import stripe as stripe_lib

from polar.auth.models import AuthSubject
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.pagination import PaginationParams
from polar.kit.tax import InvalidTaxID, to_stripe_tax_id, validate_tax_id
from polar.models import Customer, PaymentMethod
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncSession

from ..repository.payment_method import CustomerPaymentMethodRepository
from ..schemas.customer import CustomerPaymentMethodCreate, CustomerPortalCustomerUpdate


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
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[PaymentMethod], int]:
        repository = CustomerPaymentMethodRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).order_by(
            PaymentMethod.created_at.desc()
        )
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get_payment_method(
        self, session: AsyncSession, auth_subject: AuthSubject[Customer], id: UUID
    ) -> PaymentMethod | None:
        repository = CustomerPaymentMethodRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            PaymentMethod.id == id
        )
        return await repository.get_one_or_none(statement)

    async def add_payment_method(
        self,
        session: AsyncSession,
        customer: Customer,
        payment_method_create: CustomerPaymentMethodCreate,
    ) -> PaymentMethod:
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

        payment_method = await payment_method_service.upsert_from_stripe(
            session,
            customer,
            cast(stripe_lib.PaymentMethod, setup_intent.payment_method),
            flush=True,
        )
        if payment_method_create.set_default:
            repository = CustomerRepository.from_session(session)
            customer = await repository.update(
                customer, update_dict={"default_payment_method": payment_method}
            )

        return payment_method

    async def delete_payment_method(
        self, session: AsyncSession, payment_method: PaymentMethod
    ) -> None:
        await payment_method_service.delete(session, payment_method)


customer = CustomerService()
