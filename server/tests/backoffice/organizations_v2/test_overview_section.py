from tagflow import document

from polar.backoffice.organizations_v2.views.sections.overview_section import (
    OverviewSection,
)
from polar.models import Organization
from polar.organization_review.strict_category import (
    AI_IMAGE_VIDEO_GENERATION_CATEGORY,
)


def render_notice(organization: Organization) -> str:
    with document() as doc:
        OverviewSection(organization)._render_strict_category_notice()
    return doc.to_html()


class TestStrictCategoryNotice:
    def test_hidden_for_regular_category(self) -> None:
        organization = Organization(
            name="Acme",
            slug="acme",
            details={"selling_categories": ["Software / SaaS"]},
        )

        assert "Strict category" not in render_notice(organization)

    def test_flags_declared_category_and_personal_email(self) -> None:
        organization = Organization(
            name="Acme",
            slug="acme",
            email="founder@gmail.com",
            details={"selling_categories": [AI_IMAGE_VIDEO_GENERATION_CATEGORY]},
        )

        html = render_notice(organization)

        assert "Strict category" in html
        assert "declared by the merchant" in html
        assert "personal provider: founder@gmail.com" in html
