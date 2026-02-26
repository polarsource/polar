from polar.models.organization import Organization

from ..schemas import OrganizationData


def collect_organization_data(organization: Organization) -> OrganizationData:
    details = organization.details or {}
    return OrganizationData(
        name=organization.name,
        slug=organization.slug,
        website=organization.website,
        email=organization.email,
        about=details.get("about"),
        product_description=details.get("product_description"),
        intended_use=details.get("intended_use"),
        customer_acquisition=details.get("customer_acquisition", []),
        switching_from=details.get("switching_from"),
        previous_annual_revenue=details.get("previous_annual_revenue"),
        socials=[
            {"platform": s.get("platform", ""), "url": s.get("url", "")}
            for s in (organization.socials or [])
        ],
        created_at=organization.created_at,
        details_submitted_at=organization.details_submitted_at,
        blocked_at=organization.blocked_at,
    )
