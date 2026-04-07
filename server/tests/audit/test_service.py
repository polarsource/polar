import pytest

from polar.audit.service import AuditService
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.models import Organization, User, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account

from .conftest import generate_audit_entry


@pytest.mark.asyncio
class TestAudit:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.audit_read}))
    async def test_list_all(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        account = await create_account(
            save_fixture, user_organization.organization, user_organization.user
        )

        audit_entry = generate_audit_entry(account, organization)
        await save_fixture(audit_entry)

        logs, count = await AuditService().list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(logs) == 1
        assert count == 1
