from datetime import UTC, datetime

from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationEmail
from polar.organization_review.collectors.organization import (
    collect_organization_data,
)


class TestCollectOrganizationData:
    def test_no_emails(self, organization: Organization) -> None:
        data = collect_organization_data(organization)

        assert data.email_verified is False
        assert data.previous_emails == []

    def test_verified_with_history(self, organization: Organization) -> None:
        organization.email = "support@acme.com"
        emails = [
            OrganizationEmail(
                email="support@acme.com",
                verified_at=utc_now(),
                created_at=datetime(2026, 11, 5, tzinfo=UTC),
            ),
            OrganizationEmail(
                email="founder@gmail.com",
                created_at=datetime(2026, 10, 1, tzinfo=UTC),
            ),
        ]

        data = collect_organization_data(organization, emails)

        assert data.email_verified is True
        assert [(e.domain, e.replaced_at) for e in data.previous_emails] == [
            ("gmail.com", datetime(2026, 11, 5, tzinfo=UTC))
        ]

    def test_verified_row_for_previous_email(self, organization: Organization) -> None:
        organization.email = "new@acme.com"
        emails = [OrganizationEmail(email="old@acme.com", verified_at=utc_now())]

        assert collect_organization_data(organization, emails).email_verified is False
