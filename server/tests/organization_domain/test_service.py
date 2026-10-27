import dns.exception
import pytest
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationDomain, OrganizationRiskSignal
from polar.organization_domain.service import (
    organization_domain as organization_domain_service,
)
from polar.organization_review.repository import OrganizationRiskSignalRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.anyio
class TestReverify:
    async def test_manually_verified_untouched(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        lookup_txt_mock = mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value=set()
        )
        domain = OrganizationDomain(
            organization=organization, domain="acme.com", verified_at=utc_now()
        )
        await save_fixture(domain)

        await organization_domain_service.reverify(session, organization)

        assert domain.verified_at is not None
        lookup_txt_mock.assert_not_called()

    async def test_record_still_present(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value={"TOKEN"}
        )
        verified_at = utc_now()
        domain = OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verification_record_value="TOKEN",
            verified_at=verified_at,
        )
        await save_fixture(domain)

        await organization_domain_service.reverify(session, organization)

        assert domain.verified_at == verified_at

    async def test_record_removed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value=set()
        )
        domain = OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verification_record_value="TOKEN",
            verified_at=utc_now(),
        )
        await save_fixture(domain)

        await organization_domain_service.reverify(session, organization)

        assert domain.verified_at is None
        repository = OrganizationRiskSignalRepository.from_session(session)
        [signal] = await repository.get_all(
            repository.get_base_statement().where(
                OrganizationRiskSignal.organization_id == organization.id
            )
        )
        assert signal.type == OrganizationRiskSignal.Type.DOMAIN_VERIFICATION_LOST
        assert signal.payload == {"domain": "acme.com"}

    async def test_lookup_failure_keeps_verification(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service.dns.asyncresolver.resolve",
            side_effect=dns.exception.Timeout,
        )
        verified_at = utc_now()
        domain = OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verification_record_value="TOKEN",
            verified_at=verified_at,
        )
        await save_fixture(domain)

        await organization_domain_service.reverify(session, organization)

        assert domain.verified_at == verified_at
        repository = OrganizationRiskSignalRepository.from_session(session)
        assert (
            await repository.get_all(
                repository.get_base_statement().where(
                    OrganizationRiskSignal.organization_id == organization.id
                )
            )
            == []
        )

    async def test_pending_record_added(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value={"TOKEN"}
        )
        domain = OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verification_record_value="TOKEN",
        )
        await save_fixture(domain)

        await organization_domain_service.reverify(session, organization)

        assert domain.verified_at is not None

    async def test_pending_verified_elsewhere(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value={"TOKEN"}
        )
        await save_fixture(
            OrganizationDomain(
                organization=organization_second,
                domain="acme.com",
                verified_at=utc_now(),
            )
        )
        domain = OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verification_record_value="TOKEN",
        )
        await save_fixture(domain)

        await organization_domain_service.reverify(session, organization)

        assert domain.verified_at is None
