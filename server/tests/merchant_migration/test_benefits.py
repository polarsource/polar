from uuid import UUID

import pytest

from polar.kit.utils import utc_now
from polar.license_key.repository import LicenseKeyRepository
from polar.merchant_migration.benefits import keep_activations, kept_key_properties
from polar.merchant_migration.canonical import CanonicalLicenseKey
from polar.models import Benefit, Customer, LicenseKeyActivation, Organization
from polar.models.benefit import BenefitType
from polar.models.license_key import LicenseKey, LicenseKeyStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_benefit_grant

ACTIVATION_ID = "16a12ab5-d7b7-442e-a2db-e9dfa14a05de"


@pytest.mark.anyio
class TestKeptKeyProperties:
    @pytest.mark.parametrize(
        ("taken", "deleted", "expected"),
        [
            (False, False, {"user_provided_key": "KEY-1"}),
            (True, False, {}),
            (True, True, {}),
        ],
    )
    async def test_reuses_a_key_only_while_its_value_is_free(
        self,
        taken: bool,
        deleted: bool,
        expected: dict[str, str],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        if taken:
            benefit = await create_benefit(
                save_fixture, organization=organization, type=BenefitType.license_keys
            )
            await save_fixture(
                LicenseKey(
                    organization_id=organization.id,
                    customer_id=customer.id,
                    benefit_id=benefit.id,
                    key="KEY-1",
                    status=LicenseKeyStatus.granted,
                    deleted_at=utc_now() if deleted else None,
                )
            )

        properties = await kept_key_properties(
            session, organization.id, CanonicalLicenseKey(key="KEY-1")
        )

        assert dict(properties) == expected


@pytest.mark.anyio
class TestKeepActivations:
    async def _kept_key(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        *,
        key: str = "KEY-1",
    ) -> tuple[Benefit, LicenseKey, UUID]:
        benefit = await create_benefit(
            save_fixture, organization=organization, type=BenefitType.license_keys
        )
        license_key = LicenseKey(
            organization_id=organization.id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            key=key,
            status=LicenseKeyStatus.granted,
        )
        await save_fixture(license_key)
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            granted=True,
            properties={
                "user_provided_key": "KEY-1",
                "license_key_id": str(license_key.id),
            },
        )
        return benefit, license_key, grant.id

    async def test_keeps_the_source_ids(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        _, license_key, grant_id = await self._kept_key(
            save_fixture, organization, customer
        )

        done = await keep_activations(
            session, grant_id, [{"id": ACTIVATION_ID, "label": "Ada's laptop"}]
        )
        # A rerun skips the activation it already made.
        await keep_activations(
            session, grant_id, [{"id": ACTIVATION_ID, "label": "Ada's laptop"}]
        )

        assert done
        activation = await session.get(LicenseKeyActivation, UUID(ACTIVATION_ID))
        assert activation is not None
        assert activation.license_key_id == license_key.id
        assert activation.label == "Ada's laptop"

    async def test_waits_for_the_grant_to_make_the_key(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        benefit = await create_benefit(
            save_fixture, organization=organization, type=BenefitType.license_keys
        )
        grant = await create_benefit_grant(
            save_fixture, customer, benefit, properties={"user_provided_key": "KEY-1"}
        )

        assert not await keep_activations(
            session, grant.id, [{"id": ACTIVATION_ID, "label": "Ada's laptop"}]
        )

    async def test_leaves_a_new_key_alone(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        _, _, grant_id = await self._kept_key(
            save_fixture, organization, customer, key="POLAR-NEW"
        )

        assert await keep_activations(
            session, grant_id, [{"id": ACTIVATION_ID, "label": "Ada's laptop"}]
        )
        assert (
            await LicenseKeyRepository.from_session(session).get_activation_ids(
                [UUID(ACTIVATION_ID)]
            )
            == set()
        )
