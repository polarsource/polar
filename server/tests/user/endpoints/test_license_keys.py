import pytest
from httpx import AsyncClient

from polar.benefit.schemas import (
    BenefitLicenseKeyActivation,
    BenefitLicenseKeysCreateProperties,
)
from polar.kit.utils import generate_uuid
from polar.models import Organization, Product, User
from polar.postgres import AsyncSession
from polar.user.service.license_key import license_key as license_key_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.license_key import TestLicenseKey


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
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
        response = await client.get(f"/v1/users/license-keys/{random_id}")
        assert response.status_code == 404

    async def test_get_unauthorized_401(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                expires=None,
                activations=None,
            ),
        )
        id = granted["license_key_id"]
        lk = await license_key_service.get(session, id)
        assert lk

        response = await client.get(f"/v1/users/license-keys/{id}")
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_get_authorized(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                expires=None,
                activations=None,
            ),
        )
        id = granted["license_key_id"]
        lk = await license_key_service.get(session, id)
        assert lk

        response = await client.get(f"/v1/users/license-keys/{id}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("benefit_id") == str(benefit.id)
        assert data.get("key").startswith("TESTING")

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_validate(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                expires=None,
                activations=None,
            ),
        )
        id = granted["license_key_id"]
        lk = await license_key_service.get(session, id)
        assert lk

        key_only_response = await client.post(
            "/v1/users/license-keys/validate",
            json={
                "key": lk.key,
            },
        )
        assert key_only_response.status_code == 200

        scope_benefit_404_response = await client.post(
            "/v1/users/license-keys/validate",
            json={"key": lk.key, "scope": {"benefit_id": str(generate_uuid())}},
        )
        assert scope_benefit_404_response.status_code == 404

        scope_benefit_response = await client.post(
            "/v1/users/license-keys/validate",
            json={
                "key": lk.key,
                "scope": {"benefit_id": str(lk.benefit_id)},
            },
        )
        assert scope_benefit_response.status_code == 200

        full_response = await client.post(
            "/v1/users/license-keys/validate",
            json={
                "key": lk.key,
                "scope": {"benefit_id": str(lk.benefit_id), "user_id": str(lk.user_id)},
            },
        )
        assert full_response.status_code == 200
        data = full_response.json()
        assert data.get("benefit_id") == str(benefit.id)
        assert data.get("key").startswith("TESTING")

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_validate_activation(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                expires=None,
                activations=BenefitLicenseKeyActivation(limit=1),
            ),
        )
        id = granted["license_key_id"]
        lk = await license_key_service.get(session, id)
        assert lk

        activate = await client.post(
            "/v1/users/license-keys/activate",
            json={
                "key": lk.key,
                "label": "testing activation",
            },
        )
        assert activate.status_code == 200
        data = activate.json()
        activation_id = data["id"]

        random_id = generate_uuid()
        activation_404 = await client.post(
            "/v1/users/license-keys/validate",
            json={"key": lk.key, "activation_id": str(random_id)},
        )
        assert activation_404.status_code == 404

        validate_activation = await client.post(
            "/v1/users/license-keys/validate",
            json={"key": lk.key, "activation_id": activation_id},
        )
        assert validate_activation.status_code == 200
        validation = validate_activation.json()
        assert validation["key"] == lk.key
        assert validation["activation"]["id"] == activation_id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_activation(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                expires=None,
                activations=BenefitLicenseKeyActivation(limit=1),
            ),
        )
        id = granted["license_key_id"]
        lk = await license_key_service.get(session, id)
        assert lk

        label = "test"
        metadata = {"test": "test"}
        response = await client.post(
            "/v1/users/license-keys/activate",
            json={
                "key": lk.key,
                "label": label,
                "meta": metadata,
            },
        )
        assert response.status_code == 200
        data = response.json()

        assert data.get("label") == label
        assert data.get("meta") == metadata

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_unnecessary_activation(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                expires=None,
                activations=None,
            ),
        )
        id = granted["license_key_id"]
        lk = await license_key_service.get(session, id)
        assert lk

        response = await client.post(
            "/v1/users/license-keys/activate",
            json={
                "key": lk.key,
                "label": "test",
                "meta": {},
            },
        )
        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_too_many_activations(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        product: Product,
    ) -> None:
        benefit, granted = await TestLicenseKey.create_benefit_and_grant(
            session,
            save_fixture,
            user=user,
            organization=organization,
            product=product,
            properties=BenefitLicenseKeysCreateProperties(
                prefix="testing",
                expires=None,
                activations=BenefitLicenseKeyActivation(limit=1),
            ),
        )
        id = granted["license_key_id"]
        lk = await license_key_service.get(session, id)
        assert lk

        label = "test"
        metadata = {"test": "test"}
        response = await client.post(
            "/v1/users/license-keys/activate",
            json={
                "key": lk.key,
                "label": label,
                "meta": metadata,
            },
        )
        assert response.status_code == 200
        data = response.json()

        second_response = await client.post(
            "/v1/users/license-keys/activate",
            json={
                "key": lk.key,
                "label": label,
                "meta": metadata,
            },
        )
        assert second_response.status_code == 403
