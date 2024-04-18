from stripe import StripeObject
from stripe._expandable_field import ExpandableField


def get_expandable_id(expandable: ExpandableField[StripeObject]) -> str:
    if isinstance(expandable, str):
        return expandable
    if expandable["id"] is None:
        raise ValueError("id is None")
    return expandable["id"]
