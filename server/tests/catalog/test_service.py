import uuid
from datetime import timedelta

import pytest
from sqlalchemy import update

from polar.auth.models import AuthSubject
from polar.catalog.schemas import CatalogUpdate
from polar.catalog.service import (
    CatalogMembers,
    CatalogNotDraft,
    CatalogNotFound,
    CatalogRemovals,
)
from polar.catalog.service import catalog as catalog_service
from polar.kit.utils import utc_now
from polar.models import (
    Catalog,
    CatalogBenefit,
    CatalogMeter,
    CatalogProduct,
    Organization,
)
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_meter, create_product


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

        assert await catalog_service.resolve(session, organization, draft.id) == draft

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
    async def test_versioning_boundary(
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
        await save_fixture(
            CatalogBenefit(catalog=live, benefit=current, external_id="beta")
        )
        emptied = Catalog(
            organization=organization,
            status=CatalogStatus.archived,
            published_at=live.published_at,
        )
        await save_fixture(emptied)

        assert [
            await catalog_service.get_catalog_benefits(session, organization, catalog)
            for catalog in (archived, emptied)
        ] == [{"beta": current}, {}]


@pytest.mark.anyio
class TestGetCatalogMeters:
    async def test_draft_saved_before_meters_were_versioned(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        _, live, legacy_draft, _ = catalogs
        assert live.published_at is not None
        legacy_draft.created_at = live.published_at - timedelta(minutes=1)
        legacy_draft.modified_at = legacy_draft.created_at
        await save_fixture(legacy_draft)
        current = await create_meter(
            save_fixture, organization=organization, external_id="tool-calls"
        )
        emptied = Catalog(
            organization=organization,
            status=CatalogStatus.archived,
            published_at=live.published_at,
        )
        emptied_draft = Catalog(organization=organization, status=CatalogStatus.draft)
        await save_fixture(emptied)
        await save_fixture(emptied_draft)
        await save_fixture(
            CatalogMeter(catalog=live, meter=current, external_id="tool-calls")
        )

        assert [
            await catalog_service.get_catalog_meters(session, organization, catalog)
            for catalog in (legacy_draft, emptied, emptied_draft)
        ] == [{"tool-calls": current}, {}, {}]


@pytest.mark.anyio
class TestPublishDraft:
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_discarded_meanwhile(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        _, _, draft, _ = catalogs
        await catalog_service.discard_draft(session, draft)

        with pytest.raises(CatalogNotDraft):
            await catalog_service.publish_draft(
                session, auth_subject, organization, draft
            )


@pytest.mark.anyio
class TestSaveDraft:
    async def test_keeps_name_when_config_has_none(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        _, live, draft, _ = catalogs
        draft.name = "Spring launch"
        await save_fixture(draft)

        saved = await catalog_service.save_draft(
            session, organization, live, CatalogMembers(), "d" * 64, CatalogRemovals()
        )

        assert (saved.id, saved.name) == (draft.id, "Spring launch")


@pytest.mark.anyio
class TestDiscardDraft:
    async def test_deletes_rows_only_the_draft_has(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        _, _, draft, _ = catalogs
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            is_current=False,
            catalog=draft,
        )
        await save_fixture(
            CatalogProduct(catalog=draft, product=product, external_id="pro")
        )

        await catalog_service.discard_draft(session, draft)

        await session.refresh(product)
        assert (draft.deleted_at is not None, product.deleted_at is not None) == (
            True,
            True,
        )


@pytest.mark.anyio
class TestUpdate:
    async def test_discarded_concurrently(
        self,
        session: AsyncSession,
        catalogs: tuple[Catalog, Catalog, Catalog, Catalog],
    ) -> None:
        _, _, draft, _ = catalogs
        await session.execute(
            update(Catalog)
            .where(Catalog.id == draft.id)
            .values(deleted_at=utc_now())
            .execution_options(synchronize_session=False)
        )
        assert draft.deleted_at is None

        with pytest.raises(CatalogNotFound):
            await catalog_service.update(session, draft, CatalogUpdate(name="Renamed"))
