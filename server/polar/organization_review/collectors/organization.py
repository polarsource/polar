from collections.abc import Sequence
from itertools import pairwise

from polar.models import Organization, OrganizationEmail

from ..schemas import OrganizationData, SupportEmailChange


def collect_organization_data(
    organization: Organization,
    organization_emails: Sequence[OrganizationEmail] = (),
) -> OrganizationData:
    details = organization.details or {}
    current = organization_emails[0] if organization_emails else None
    return OrganizationData(
        id=str(organization.id),
        name=organization.name,
        slug=organization.slug,
        website=organization.website,
        email=organization.email,
        email_verified=(
            current is not None
            and current.verified_at is not None
            and current.email == organization.email
        ),
        previous_emails=[
            SupportEmailChange(
                domain=older.email.rpartition("@")[2], replaced_at=newer.created_at
            )
            for newer, older in pairwise(organization_emails)
        ],
        about=details.get("about"),
        product_description=details.get("product_description"),
        selling_categories=details.get("selling_categories", []),
        pricing_models=details.get("pricing_models", []),
        switching_from=details.get("switching_from"),
        previous_annual_revenue=details.get("previous_annual_revenue"),
        socials=[
            {"platform": s.get("platform", ""), "url": s.get("url", "")}
            for s in (organization.socials or [])
        ],
        created_at=organization.created_at,
        details_submitted_at=organization.details_submitted_at,
        is_blocked=organization.is_blocked(),
    )
