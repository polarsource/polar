from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarRequestValidationError
from polar.kit.tax import validate_tax_id
from polar.models import Customer
from polar.postgres import AsyncSession

from ..schemas.customer import CustomerPortalCustomerUpdate


class CustomerService:
    async def update(
        self,
        session: AsyncSession,
        customer: Customer,
        customer_update: CustomerPortalCustomerUpdate,
    ) -> Customer:
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
            except ValueError as e:
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
        return await repository.update(
            customer,
            update_dict=customer_update.model_dump(
                exclude_unset=True, exclude={"billing_address", "tax_id"}
            ),
        )


customer = CustomerService()
