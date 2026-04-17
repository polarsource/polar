import pytest

from polar.auth.models import AuthSubject
from polar.metrics.service import metrics as metrics_service
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
class TestResolveTinybirdFiltersAuthz:
    @pytest.mark.auth
    async def test_user_passing_foreign_org_is_filtered_out(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        assert user_organization.user_id == auth_subject.subject.id
        assert user_organization.organization_id == organization.id

        result = await metrics_service._resolve_tinybird_filters(
            session,
            auth_subject,
            organization_id=[organization_second.id],
            product_id=None,
            billing_type=None,
            customer_id=None,
            tb_needed=set(),
        )

        assert result.org_ids == []

    @pytest.mark.auth
    async def test_user_passing_mix_keeps_only_accessible(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        result = await metrics_service._resolve_tinybird_filters(
            session,
            auth_subject,
            organization_id=[organization.id, organization_second.id],
            product_id=None,
            billing_type=None,
            customer_id=None,
            tb_needed=set(),
        )

        assert result.org_ids == [organization.id]

    @pytest.mark.auth
    async def test_user_no_filter_returns_accessible_orgs(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        result = await metrics_service._resolve_tinybird_filters(
            session,
            auth_subject,
            organization_id=None,
            product_id=None,
            billing_type=None,
            customer_id=None,
            tb_needed=set(),
        )

        assert result.org_ids == [organization.id]

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_passing_foreign_org_is_filtered_out(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        assert auth_subject.subject.id == organization.id

        result = await metrics_service._resolve_tinybird_filters(
            session,
            auth_subject,
            organization_id=[organization_second.id],
            product_id=None,
            billing_type=None,
            customer_id=None,
            tb_needed=set(),
        )

        assert result.org_ids == []

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_no_filter_returns_self(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        result = await metrics_service._resolve_tinybird_filters(
            session,
            auth_subject,
            organization_id=None,
            product_id=None,
            billing_type=None,
            customer_id=None,
            tb_needed=set(),
        )

        assert result.org_ids == [organization.id]
