import pytest
from sqlalchemy import func, select, text

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization
from polar.models.organization import OrganizationSocials
from scripts.fix_organizations_socials_links import fix_links
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestFixOrganizationSocialsLinks:
    async def test_fix_organization_socials_links(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        organization.socials = [
            *organization.socials,
            OrganizationSocials(platform="X", url="https://https//x.com/test"),
            OrganizationSocials(platform="X", url="https://x.com/b"),
        ]
        await save_fixture(organization)

        organization_second.socials = [
            *organization_second.socials,
            OrganizationSocials(platform="X", url="https://x.com/b"),
        ]
        await save_fixture(organization_second)

        await fix_links(batch_size=10, session=session)

        stmt = select(func.count(Organization.id)).where(
            text("""
                    EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements(socials) AS elem
                        WHERE elem->>'url' LIKE :pattern
                    )
                    """).bindparams(pattern="https://https//%")
        )
        broken_socials_links = (await session.execute(stmt)).scalar_one()
        assert broken_socials_links == 0
