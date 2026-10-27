import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationDomain, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.anyio
class TestListOrganizationDomains:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/domains/")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/domains/")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await save_fixture(
            OrganizationDomain(
                organization=organization, domain="acme.com", verified_at=utc_now()
            )
        )
        await save_fixture(
            OrganizationDomain(
                organization=organization,
                domain="pending.com",
                verification_record_value="TOKEN",
            )
        )
        await save_fixture(
            OrganizationDomain(organization=organization_second, domain="other.com")
        )

        response = await client.get(f"/v1/organizations/{organization.id}/domains/")
        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2
        assert [item["domain"] for item in json["items"]] == [
            "acme.com",
            "pending.com",
        ]
        assert json["items"][1]["verified_at"] is None
        assert json["items"][1]["verification_record_name"] == (
            "_polar-challenge.pending.com"
        )
        assert json["items"][1]["verification_record_value"] == "TOKEN"


@pytest.mark.anyio
class TestCreateOrganizationDomain:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/",
            json={"domain": "acme.com"},
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/",
            json={"domain": "acme.com"},
        )
        assert response.status_code == 404

    @pytest.mark.auth
    @pytest.mark.parametrize(
        "domain", ["localhost", "1.2.3.4", "acme.notatld", "https://", "a b.com"]
    )
    async def test_invalid_domain(
        self,
        domain: str,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/",
            json={"domain": domain},
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_already_exists(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await save_fixture(
            OrganizationDomain(organization=organization, domain="acme.com")
        )

        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/",
            json={"domain": "ACME.com"},
        )
        assert response.status_code == 409

    @pytest.mark.auth
    @pytest.mark.parametrize(
        "domain",
        [
            " Acme.COM. ",
            "https://acme.com",
            "https://Acme.com/pricing",
            "acme.com/path",
        ],
    )
    async def test_valid(
        self,
        domain: str,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/",
            json={"domain": domain},
        )
        assert response.status_code == 201

        json = response.json()
        assert json["domain"] == "acme.com"
        assert json["verified_at"] is None
        assert json["verification_record_value"]


@pytest.mark.anyio
class TestDeleteOrganizationDomain:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        domain = OrganizationDomain(organization=organization, domain="acme.com")
        await save_fixture(domain)

        response = await client.delete(
            f"/v1/organizations/{organization.id}/domains/{domain.id}"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_other_organization_domain(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        other = OrganizationDomain(organization=organization_second, domain="acme.com")
        await save_fixture(other)

        response = await client.delete(
            f"/v1/organizations/{organization.id}/domains/{other.id}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        domain = OrganizationDomain(organization=organization, domain="acme.com")
        await save_fixture(domain)

        response = await client.delete(
            f"/v1/organizations/{organization.id}/domains/{domain.id}"
        )
        assert response.status_code == 204

        response = await client.get(f"/v1/organizations/{organization.id}/domains/")
        assert response.json()["pagination"]["total_count"] == 0


@pytest.mark.anyio
class TestVerifyOrganizationDomain:
    async def test_anonymous(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        domain = OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verification_record_value="TOKEN",
        )
        await save_fixture(domain)

        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/{domain.id}/verify"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_other_organization_domain(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        other = OrganizationDomain(
            organization=organization_second,
            domain="acme.com",
            verification_record_value="TOKEN",
        )
        await save_fixture(other)

        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/{other.id}/verify"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_record_not_found(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        lookup_txt_mock = mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value={"OTHER"}
        )
        domain = OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verification_record_value="TOKEN",
        )
        await save_fixture(domain)

        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/{domain.id}/verify"
        )
        assert response.status_code == 400
        lookup_txt_mock.assert_called_once_with("_polar-challenge.acme.com")

    @pytest.mark.auth
    async def test_verified_elsewhere(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
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

        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/{domain.id}/verify"
        )
        assert response.status_code == 409

    @pytest.mark.auth
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service._lookup_txt",
            return_value={"v=spf1 -all", "TOKEN"},
        )
        organization.embed_hosts = ["localhost:3000", "acme.com"]
        await save_fixture(organization)
        domain = OrganizationDomain(
            organization=organization,
            domain="acme.com",
            verification_record_value="TOKEN",
        )
        await save_fixture(domain)

        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/{domain.id}/verify"
        )
        assert response.status_code == 200
        assert response.json()["verified_at"] is not None
        updated = await session.get(Organization, organization.id)
        assert updated is not None
        assert updated.embed_hosts == ["localhost:3000", "acme.com", "*.acme.com"]

    @pytest.mark.auth
    async def test_valid_shared_host(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch(
            "polar.organization_domain.service._lookup_txt", return_value={"TOKEN"}
        )
        domain = OrganizationDomain(
            organization=organization,
            domain="github.io",
            verification_record_value="TOKEN",
        )
        await save_fixture(domain)

        response = await client.post(
            f"/v1/organizations/{organization.id}/domains/{domain.id}/verify"
        )
        assert response.status_code == 200
        updated = await session.get(Organization, organization.id)
        assert updated is not None
        assert updated.embed_hosts == ["github.io"]
