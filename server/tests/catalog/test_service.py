import uuid
from datetime import timedelta

import pytest

from polar.catalog.service import CatalogNotFound
from polar.catalog.service import catalog as catalog_service
from polar.kit.utils import utc_now
from polar.models import Catalog, CatalogBenefit, Organization
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


@pytest.fixture
async def catalogs(
    save_fixture: SaveFixture,
    organization: Organization,
    organization_second: Organization,
) -> tuple[Catalog, Catalog, Catalog, Catalog]:
    now = utc_now()
    archived = Catalog(
        organization=organization,
        version_hash="a" * 64,
        status=CatalogStatus.archived,
        published_at=now - timedelta(days=1),
    )
    live = Catalog(
        organization=organization,
        version_hash="b" * 64,
        status=CatalogStatus.live,
        published_at=now,
    )
    draft = Catalog(organization=organization, status=CatalogStatus.draft)
    other_organization = Catalog(
        organization=organization_second,
        version_hash="c" * 64,
        status=CatalogStatus.live,
        published_at=now,
    )
    for catalog in (archived, live, draft, other_organization):
        await save_fixture(catalog)
    return archived, live, draft, other_organization


@pytest.mark.anyio
class TestResolve:
    async def test_live_before_first_publish(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        assert await catalog_service.resolve(session, organization, None) is None

    async def test_live(
        self,
        session: AsyncSession,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        _, live, _, _ = catalogs

        assert await catalog_service.resolve(session, organization, None) == live

    async def test_archived_by_id(
        self,
        session: AsyncSession,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        archived, _, _, _ = catalogs

        assert (
            await catalog_service.resolve(session, organization, archived.id)
            == archived
        )

    @pytest.mark.usefixtures("catalogs")
    async def test_unknown_id(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with pytest.raises(CatalogNotFound):
            await catalog_service.resolve(session, organization, uuid.uuid4())

    async def test_draft(
        self,
        session: AsyncSession,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        _, _, draft, _ = catalogs

        with pytest.raises(CatalogNotFound):
            await catalog_service.resolve(session, organization, draft.id)

    async def test_other_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        _, _, _, other_organization = catalogs

        with pytest.raises(CatalogNotFound):
            await catalog_service.resolve(session, organization, other_organization.id)


@pytest.mark.anyio
class TestGetCatalogBenefits:
    async def test_before_and_after_benefits_are_versioned(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        archived, live, _, _ = catalogs
        current = await create_benefit(
            save_fixture, organization=organization, external_id="beta"
        )
        emptied = Catalog(
            organization=organization,
            status=CatalogStatus.archived,
            published_at=live.published_at,
        )
        await save_fixture(emptied)
        await save_fixture(
            CatalogBenefit(catalog=live, benefit=current, external_id="beta")
        )

        assert await catalog_service.get_catalog_benefits(
            session, organization, archived
        ) == {"beta": current}
        assert (
            await catalog_service.get_catalog_benefits(session, organization, emptied)
            == {}
        )
