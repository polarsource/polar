import stripe as stripe_lib
from stripe import StripeObject
from stripe._expandable_field import ExpandableField


def get_expandable_id(expandable: ExpandableField[StripeObject]) -> str:
    if isinstance(expandable, str):
        return expandable
    if expandable["id"] is None:
        raise ValueError("id is None")
    return expandable["id"]


def get_fingerprint(payment_method: stripe_lib.PaymentMethod) -> str | None:
    if payment_method.card is not None:
        return payment_method.card.fingerprint
    return None
