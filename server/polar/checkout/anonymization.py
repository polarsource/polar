from polar.kit.anonymization import (
    ANONYMIZED_IP_ADDRESS,
    anonymize_address_for_deletion,
    anonymize_email_for_deletion,
    anonymize_for_deletion,
    anonymize_metadata_for_deletion,
)
from polar.models import Customer
from polar.postgres import AsyncSession

from .repository import CheckoutRepository


async def anonymize_customer_checkouts(
    session: AsyncSession, customer: Customer
) -> None:
    """Anonymize the customer PII that checkouts snapshot independently.

    Checkouts copy the customer details at checkout time, so anonymizing the
    `customers` row alone leaves the email, IP address and billing details
    behind. Orders keep their own snapshot of what the tax records need, so
    nothing here has to stay readable.

    Values are hashed rather than cleared, mirroring the customer scrub, so it
    stays visible whether a field was ever filled. Hashes use the customer's
    `created_at`, so they match the ones written on the customer row. The
    exceptions are the two fields that cannot hold a hash and stay valid: the IP
    address is typed as an IP, and an address needs a real country.

    Lives outside `service.py` because `customer.service` imports this, and
    `checkout.service` imports back into that module's dependents.
    """
    repository = CheckoutRepository.from_session(session)
    checkouts = await repository.get_all_by_customer_reference(
        customer.id, customer.organization_id, customer.email
    )
    created_at = customer.created_at

    for checkout in checkouts:
        if checkout.customer_email is not None:
            checkout.customer_email = anonymize_email_for_deletion(
                checkout.customer_email, created_at
            )
        if checkout.customer_name is not None:
            checkout.customer_name = anonymize_for_deletion(
                checkout.customer_name, created_at
            )
        if checkout.customer_billing_name is not None:
            checkout.customer_billing_name = anonymize_for_deletion(
                checkout.customer_billing_name, created_at
            )
        if checkout.customer_billing_address is not None:
            checkout.customer_billing_address = anonymize_address_for_deletion(
                checkout.customer_billing_address, created_at
            )
        if checkout.customer_tax_id is not None:
            tax_id_number, tax_id_format = checkout.customer_tax_id
            checkout.customer_tax_id = (
                anonymize_for_deletion(tax_id_number, created_at),
                tax_id_format,
            )
        if checkout.customer_ip_address is not None:
            checkout.customer_ip_address = ANONYMIZED_IP_ADDRESS
        checkout.customer_metadata = anonymize_metadata_for_deletion(
            checkout.customer_metadata, created_at
        )
        session.add(checkout)
