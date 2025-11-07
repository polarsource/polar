from uuid import UUID

import pytest
from dateutil.relativedelta import relativedelta
from httpx import AsyncClient

from polar.auth.models import AuthSubject
from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeyActivationCreateProperties,
    BenefitLicenseKeysCreateProperties,
)
from polar.kit.pagination import PaginationParams
from polar.kit.utils import generate_uuid, utc_now
from polar.license_key.repository import LicenseKeyRepository
from polar.license_key.service import license_key as license_key_service
from polar.models import Customer, Organization, Product, User, UserOrganization
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.license_key import TestLicenseKey


@pytest.mark.asyncio
class TestLicenseKeyEndpoints:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_get_non_existing_404s(
        self,
        session: AsyncSession,
        client: AsyncClient,
    ) -> None:
        random_id = generate_uuid()
        response = await client.get(f"/v1/license-keys/{random_id}")
        assert response.status_code == 404

    async def test_get_unauthorized_401(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
            ),
        )
        repository = LicenseKeyRepository.from_session(session)
        assert await repository.get_by_id(UUID(granted["license_key_id"])) is not None

        response = await client.get(f"/v1/license-keys/{id}")
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_get_authorized(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
            ),
        )
        repository = LicenseKeyRepository.from_session(session)
        lk = await repository.get_by_id(UUID(granted["license_key_id"]))
        assert lk is not None

        response = await client.get(f"/v1/license-keys/{lk.id}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("benefit_id") == str(benefit.id)
        assert data.get("key").startswith("TESTING")

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_update(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
            ),
        )
        repository = LicenseKeyRepository.from_session(session)
        lk = await repository.get_by_id(UUID(granted["license_key_id"]))
        assert lk is not None

        expires = utc_now() + relativedelta(months=1)
        expires_at = expires.strftime("%Y-%m-%dT%H:%M:%S")
        response = await client.patch(
            f"/v1/license-keys/{lk.id}",
            json={
                "usage": 4,
                "limit_usage": 10,
                "limit_activations": 5,
                "expires_at": expires_at,
            },
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["usage"] == 4
        assert updated["limit_usage"] == 10
        assert updated["limit_activations"] == 5
        assert updated["expires_at"] == expires_at

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_list(
        self,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
            ),
        )
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
            ),
        )
        keys, count = await license_key_service.list(
            session,
            auth_subject,
            organization_id=[organization.id],
            pagination=PaginationParams(1, 50),
        )
        assert count >= 2

        response = await client.get(
            f"/v1/license-keys/?organization_id={str(organization.id)}",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["total_count"] == count

    @pytest.mark.parametrize(
        "activate_path",
        [
            "/v1/customer-portal/license-keys/activate",
            "/v1/license-keys/activate",
        ],
    )
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_get_activation(
        self,
        activate_path: str,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                activations=BenefitLicenseKeyActivationCreateProperties(
                    limit=2, enable_customer_admin=True
                ),
            ),
        )
        repository = LicenseKeyRepository.from_session(session)
        lk = await repository.get_by_id(UUID(granted["license_key_id"]))
        assert lk is not None

        activate = await client.post(
            activate_path,
            json={
                "key": lk.key,
                "organization_id": str(organization.id),
                "label": "testing activation",
            },
        )
        assert activate.status_code == 200
        data = activate.json()
        activation_id = data["id"]

        response = await client.get(
            f"v1/license-keys/{lk.id}/activations/{activation_id}",
        )
        data = response.json()
        assert data["id"] == activation_id
        assert data["license_key"]["id"] == str(lk.id)

    @pytest.mark.parametrize(
        "activate_path",
        [
            "/v1/customer-portal/license-keys/activate",
            "/v1/license-keys/activate",
        ],
    )
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_activate_license_without_activations_returns_descriptive_error(
        self,
        activate_path: str,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that activating a license without activations returns a descriptive error."""
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                # No activations property - this license doesn't support activations
            ),
        )
        repository = LicenseKeyRepository.from_session(session)
        lk = await repository.get_by_id(UUID(granted["license_key_id"]))
        assert lk is not None

        activate = await client.post(
            activate_path,
            json={
                "key": lk.key,
                "organization_id": str(organization.id),
                "label": "testing activation",
                "conditions": {},
                "meta": {},
            },
        )
        assert activate.status_code == 403
        data = activate.json()
        assert "does not support activations" in data["detail"]
        assert "Use the /validate endpoint instead" in data["detail"]

    @pytest.mark.parametrize(
        "activate_path",
        [
            "/v1/customer-portal/license-keys/activate",
            "/v1/license-keys/activate",
        ],
    )
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_activate_expired_license_key_should_fail(
        self,
        activate_path: str,
        session: AsyncSession,
        redis: Redis,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that activating an expired license key should fail."""
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            redis,
            save_fixture,
            customer=customer,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                activations=BenefitLicenseKeyActivationCreateProperties(
                    limit=2, enable_customer_admin=True
                ),
            ),
        )
        repository = LicenseKeyRepository.from_session(session)
        lk = await repository.get_by_id(UUID(granted["license_key_id"]))
        assert lk is not None

        lk.expires_at = utc_now() - relativedelta(days=1)
        session.add(lk)
        await session.flush()

        activate = await client.post(
            activate_path,
            json={
                "key": lk.key,
                "organization_id": str(organization.id),
                "label": "testing activation of expired key",
            },
        )

        assert activate.status_code == 403, (
            f"Expected 403 but got {activate.status_code}. Response: {activate.json()}"
        )
