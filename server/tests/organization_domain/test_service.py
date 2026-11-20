import dns.exception
import pytest
from pytest_mock import MockerFixture

from polar.email.schemas import DomainVerificationLostEmail
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationDomain, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.organization_domain.service import (
    organization_domain as organization_domain_service,
)
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
        user_organization: UserOrganization,
        user_organization_second: UserOrganization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value=set()
        )
        enqueue_email_mock = mocker.patch(
            "polar.organization_domain.service.enqueue_email_template"
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
        assert domain.verification_lost_at is not None
        enqueue_email_mock.assert_called_once()
        email = enqueue_email_mock.call_args.args[0]
        assert isinstance(email, DomainVerificationLostEmail)
        assert email.props.domain == "acme.com"
        assert email.props.record_name == "_polar-challenge.acme.com"
        assert email.props.record_value == "TOKEN"
        assert enqueue_email_mock.call_args.kwargs["to_email_addr"] == (
            user_organization.user.email
        )

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
        assert domain.verification_lost_at is None

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
            verification_lost_at=utc_now(),
        )
        await save_fixture(domain)

        await organization_domain_service.reverify(session, organization)

        assert domain.verified_at is not None
        assert domain.verification_lost_at is None

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

    async def test_record_removed_unregisters_payment_method_domains(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value=set()
        )
        mocker.patch("polar.organization_domain.service.enqueue_email_template")
        enqueue_job_mock = mocker.patch("polar.organization_domain.service.enqueue_job")
        organization.embed_hosts = ["acme.com"]
        await save_fixture(organization)
        await save_fixture(
            OrganizationDomain(
                organization=organization,
                domain="acme.com",
                verification_record_value="TOKEN",
                verified_at=utc_now(),
            )
        )

        await organization_domain_service.reverify(session, organization)

        enqueue_job_mock.assert_called_once_with(
            "organization_domain.unregister_payment_method_domains",
            domains=["acme.com"],
        )


@pytest.mark.anyio
class TestRegisterPaymentMethodDomains:
    async def test_only_embed_hosts_under_verified_domain(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization_domain.service.enqueue_job")
        organization.embed_hosts = ["shop.acme.com"]
        await save_fixture(organization)
        await save_fixture(
            OrganizationDomain(
                organization=organization, domain="acme.com", verified_at=utc_now()
            )
        )

        await organization_domain_service.register_payment_method_domains(
            session, organization
        )

        enqueue_job_mock.assert_called_once_with(
            "organization_domain.register_payment_method_domains",
            domains=["shop.acme.com"],
        )

    async def test_organization_not_active(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization_domain.service.enqueue_job")
        organization.status = OrganizationStatus.REVIEW
        organization.embed_hosts = ["shop.acme.com"]
        await save_fixture(organization)
        await save_fixture(
            OrganizationDomain(
                organization=organization, domain="acme.com", verified_at=utc_now()
            )
        )

        await organization_domain_service.register_payment_method_domains(
            session, organization
        )

        enqueue_job_mock.assert_not_called()

    async def test_organization_without_checkout(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.organization_domain.service.enqueue_job")
        organization.capabilities = {
            **organization.capabilities,
            "checkout_payments": False,
        }
        organization.embed_hosts = ["shop.acme.com"]
        await save_fixture(organization)
        await save_fixture(
            OrganizationDomain(
                organization=organization, domain="acme.com", verified_at=utc_now()
            )
        )

        await organization_domain_service.register_payment_method_domains(
            session, organization
        )

        enqueue_job_mock.assert_not_called()
