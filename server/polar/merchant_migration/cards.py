"""Reading the moved cards back onto the imported customers.

A copy lands them under the source's `cus_…` id but with fresh `pm_…` ids, so
they stay invisible to Polar until stored as payment methods of our own.
"""

import csv
import io
from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

import stripe as stripe_lib

from polar.customer.repository import CustomerRepository
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Customer, PaymentMethod
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncSession

from .canonical import CanonicalPaymentMethod
from .errors import MerchantMigrationError

CARD_TYPE = "card"
PAYMENT_METHOD_MAPPING_HEADERS = (
    "customer_id_old",
    "source_id_old",
    "customer_id_new",
    "source_id_new",
)


class CopiedCardResolutionError(MerchantMigrationError): ...


class AmbiguousCopiedCard(CopiedCardResolutionError):
    """Deliberately unhandled at the top: charging the wrong card is worse than
    not charging, and there is nothing sensible to guess. Pages so a human can
    look at the account."""

    def __init__(self, customer_id: UUID, matches: int) -> None:
        self.customer_id = customer_id
        super().__init__(
            f"{matches} copied methods look like the one the source was charging "
            f"for customer {customer_id}; can't tell which is which."
        )


class InvalidCopiedCardMapping(CopiedCardResolutionError):
    def __init__(self, payment_method_id: str) -> None:
        super().__init__(
            f"Copied payment method {payment_method_id} does not belong to the "
            "destination customer in Stripe's mapping."
        )


class PaymentMethodMappingCSVError(MerchantMigrationError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400)


@dataclass(frozen=True)
class PaymentMethodMapping:
    source_customer_id: str
    source_payment_method_id: str
    destination_customer_id: str
    destination_payment_method_id: str


def parse_payment_method_mapping_csv(contents: bytes) -> list[PaymentMethodMapping]:
    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise PaymentMethodMappingCSVError(
            "The mapping must be a UTF-8 CSV file."
        ) from e

    reader = csv.DictReader(io.StringIO(decoded))
    if tuple(reader.fieldnames or ()) != PAYMENT_METHOD_MAPPING_HEADERS:
        raise PaymentMethodMappingCSVError(
            "The CSV headers must be: "
            + ", ".join(PAYMENT_METHOD_MAPPING_HEADERS)
            + "."
        )

    by_source: dict[str, PaymentMethodMapping] = {}
    by_destination: dict[str, PaymentMethodMapping] = {}
    customer_destinations: dict[str, str] = {}
    destination_sources: dict[str, str] = {}
    for line_number, row in enumerate(reader, start=2):
        if None in row:
            raise PaymentMethodMappingCSVError(
                f"Line {line_number} has more than four values."
            )
        values = {
            header: (row.get(header) or "").strip()
            for header in PAYMENT_METHOD_MAPPING_HEADERS
        }
        if not all(values.values()):
            raise PaymentMethodMappingCSVError(
                f"Line {line_number} has an empty mapping value."
            )
        mapping = PaymentMethodMapping(
            source_customer_id=values["customer_id_old"],
            source_payment_method_id=values["source_id_old"],
            destination_customer_id=values["customer_id_new"],
            destination_payment_method_id=values["source_id_new"],
        )
        existing = by_source.get(mapping.source_payment_method_id)
        if existing is not None and existing != mapping:
            raise PaymentMethodMappingCSVError(
                f"Source payment method {mapping.source_payment_method_id} has "
                "conflicting mappings."
            )
        destination_existing = by_destination.get(mapping.destination_payment_method_id)
        if destination_existing is not None and destination_existing != mapping:
            raise PaymentMethodMappingCSVError(
                f"Destination payment method {mapping.destination_payment_method_id} "
                "is mapped more than once."
            )
        customer_destination = customer_destinations.get(mapping.source_customer_id)
        if (
            customer_destination is not None
            and customer_destination != mapping.destination_customer_id
        ):
            raise PaymentMethodMappingCSVError(
                f"Source customer {mapping.source_customer_id} has conflicting "
                "destination customers."
            )
        by_source[mapping.source_payment_method_id] = mapping
        by_destination[mapping.destination_payment_method_id] = mapping
        customer_destinations[mapping.source_customer_id] = (
            mapping.destination_customer_id
        )
        destination_source = destination_sources.get(mapping.destination_customer_id)
        if (
            destination_source is not None
            and destination_source != mapping.source_customer_id
        ):
            raise PaymentMethodMappingCSVError(
                f"Destination customer {mapping.destination_customer_id} is mapped "
                "from more than one source customer."
            )
        destination_sources[mapping.destination_customer_id] = (
            mapping.source_customer_id
        )

    if not by_source:
        raise PaymentMethodMappingCSVError("The mapping CSV has no data rows.")
    return list(by_source.values())


async def link_payment_method(
    session: AsyncSession,
    customer: Customer,
    *,
    source_method: CanonicalPaymentMethod | None = None,
    mapping: PaymentMethodMapping | None = None,
) -> PaymentMethod | None:
    """The method to charge, or None while nothing has landed for this customer.

    ``source_method`` is what the source subscription was charging; its copy
    wins. Idempotent, so it can run again as more cards arrive.
    """
    if mapping is not None:
        if (
            customer.stripe_customer_id is not None
            and customer.stripe_customer_id != mapping.destination_customer_id
        ):
            raise InvalidCopiedCardMapping(mapping.destination_payment_method_id)
        if customer.stripe_customer_id is None:
            await CustomerRepository.from_session(session).update(
                customer,
                update_dict={"stripe_customer_id": mapping.destination_customer_id},
            )
        try:
            stripe_payment_method = await stripe_service.get_payment_method(
                mapping.destination_payment_method_id
            )
        except stripe_lib.InvalidRequestError:
            return None
        stripe_customer = stripe_payment_method.customer
        if (
            stripe_customer is None
            or get_expandable_id(stripe_customer) != mapping.destination_customer_id
        ):
            raise InvalidCopiedCardMapping(mapping.destination_payment_method_id)
        payment_method = await payment_method_service.upsert_from_stripe(
            session, customer, stripe_payment_method, flush=True
        )
        preferred = payment_method
    else:
        if customer.stripe_customer_id is None:
            return None
        try:
            stripe_payment_methods = [
                stripe_payment_method
                async for stripe_payment_method in stripe_service.list_payment_methods(
                    customer.stripe_customer_id
                )
            ]
        except stripe_lib.InvalidRequestError:
            # No such customer on our account: the copy hasn't reached them.
            return None

        payment_methods = [
            await payment_method_service.upsert_from_stripe(
                session, customer, stripe_payment_method, flush=True
            )
            for stripe_payment_method in stripe_payment_methods
        ]
        if not payment_methods:
            return None
        preferred = _preferred(payment_methods, customer, source_method)

    # What the renewal charges when a subscription has no method of its own.
    if customer.default_payment_method_id is None:
        await CustomerRepository.from_session(session).update(
            customer, update_dict={"default_payment_method_id": preferred.id}
        )
    return preferred


def _preferred(
    payment_methods: Sequence[PaymentMethod],
    customer: Customer,
    source_method: CanonicalPaymentMethod | None,
) -> PaymentMethod:
    """Prefer the source method's copy, else the customer's default, else the first stored method."""
    if source_method is not None:
        copies = [
            payment_method
            for payment_method in payment_methods
            if _is_copy_of(payment_method, source_method)
        ]
        if len(copies) > 1:
            raise AmbiguousCopiedCard(customer.id, len(copies))
        if copies:
            return copies[0]
    for payment_method in payment_methods:
        if payment_method.id == customer.default_payment_method_id:
            return payment_method
    for payment_method in payment_methods:
        if payment_method.type == CARD_TYPE:
            return payment_method
    return payment_methods[0]


def _is_copy_of(
    payment_method: PaymentMethod, source_method: CanonicalPaymentMethod
) -> bool:
    """A copy keeps the card but not its id, and not its fingerprint either —
    that is per-account. Brand, last4 and expiry are what is left."""
    details = {
        "last4": source_method.last4,
        "brand": source_method.brand,
        "exp_month": source_method.exp_month,
        "exp_year": source_method.exp_year,
    }
    known = {key: value for key, value in details.items() if value is not None}
    if not known or payment_method.type != source_method.type.value:
        return False
    return all(
        payment_method.method_metadata.get(key) == value for key, value in known.items()
    )
