from stripe.api_resources.expandable_field import ExpandableField
from stripe.stripe_object import StripeObject


def get_expandable_id(expandable: ExpandableField[StripeObject]) -> str:
    if isinstance(expandable, str):
        return expandable
    if expandable.stripe_id is None:
        raise ValueError("stripe_id is None")
    return expandable.stripe_id
