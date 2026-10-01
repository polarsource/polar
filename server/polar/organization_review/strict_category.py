from collections.abc import Iterable

from polar.config import settings

AI_IMAGE_VIDEO_GENERATION_CATEGORY = "AI image or video generation"

STRICT_SELLING_CATEGORIES: frozenset[str] = frozenset(
    {AI_IMAGE_VIDEO_GENERATION_CATEGORY}
)


def is_strict_category(selling_categories: Iterable[str] | None) -> bool:
    """Whether the organization sells in a category held to strict review.

    Strict categories are restricted businesses we only accept from
    established companies: a business email on the organization's own domain
    and a full API integration (access token + webhook) are required before
    the organization can submit for review.
    """
    return any(c in STRICT_SELLING_CATEGORIES for c in selling_categories or [])


def is_personal_email(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    return email.rsplit("@", 1)[1].lower() in settings.PERSONAL_EMAIL_DOMAINS
