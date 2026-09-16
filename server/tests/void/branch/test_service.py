from copy import deepcopy
from decimal import Decimal
from typing import Any

import pytest

from polar.exceptions import ResourceNotFound
from polar.models import Organization, VoidDeployment, VoidProduct
from polar.models.void_deployment import VoidDeploymentStatus
from polar.postgres import AsyncSession
from polar.void.branch.exceptions import BranchBaseUnavailable, InvalidBranch
from polar.void.branch.schemas import BranchCreate, BranchPatch, BranchUpdate
from polar.void.branch.service import branch as branch_service
from polar.void.branch.service import resolve
from polar.void.deploy.schemas import DeployCreate
from polar.void.deploy.service import deploy as deploy_service
from polar.void.product.service import product as product_service
from tests.fixtures.database import SaveFixture
from tests.void.deploy.test_service import CONFIG

PATCH = {
    "products": {
        "pro": {
            "price": {
                "type": "recurring",
                "interval": "month",
                "amount": "30",
                "currency": "usd",
            },
            "meters": {"tokens": {"included": 500, "limit": "soft"}},
        }
    },
    "meters": {"tokens": {"unit_amount": "0.02"}},
}


async def deploy_base(session: AsyncSession, organization: Organization) -> str:
    deployed = await deploy_service.deploy(
        session, organization.id, DeployCreate(**CONFIG)
    )
    return deployed.version_id


class TestResolve:
    def test_applies_patch_and_changes_version(self) -> None:
        base = DeployCreate(**CONFIG)
        resolved = resolve(base, BranchPatch.model_validate(PATCH))
        assert resolved.version_id != base.version_id
        assert resolved.products[0].price.amount == Decimal(30)
        terms = resolved.products[0].meters[0]
        assert not isinstance(terms, str)
        assert (terms.included, terms.limit) == (500, "soft")
        assert resolved.meters[0].unit_amount == Decimal("0.02")
        assert resolved.products[0].name == "Pro"

    def test_empty_patch_keeps_version(self) -> None:
        base = DeployCreate(**CONFIG)
        assert resolve(base, BranchPatch()).version_id == base.version_id

    @pytest.mark.parametrize(
        "patch",
        [
            {"products": {"missing": {"name": "x"}}},
            {"products": {"pro": {"meters": {"other": {"included": 1}}}}},
            {"meters": {"missing": {"unit_amount": "1"}}},
        ],
    )
    def test_rejects_unknown_slugs(self, patch: dict[str, Any]) -> None:
        with pytest.raises(InvalidBranch):
            resolve(DeployCreate(**CONFIG), BranchPatch.model_validate(patch))


@pytest.mark.asyncio
class TestBranchService:
    async def test_create_update_promote(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        base_version = await deploy_base(session, organization)
        created = await branch_service.create(
            session,
            organization.id,
            BranchCreate(name="Usage-first", base_version_id=base_version),
        )
        assert created.version_id == base_version
        assert created.deployment_id is not None
        assert created.promoted_deployment_id is None
        assert created.configuration.checksum == f"branch:{created.id}"

        updated = await branch_service.update(
            session,
            organization.id,
            created.id,
            BranchUpdate(patch=BranchPatch.model_validate(PATCH)),
        )
        assert updated.version_id != base_version
        assert updated.deployment_id is None
        assert updated.patch.meters["tokens"].unit_amount == Decimal("0.02")

        promoted = await branch_service.promote(session, organization.id, created.id)
        assert promoted.status == VoidDeploymentStatus.draft
        assert promoted.version_id == updated.version_id
        assert promoted.checksum == f"branch:{created.id}"
        deployment = await session.get(VoidDeployment, promoted.id)
        assert deployment is not None
        assert deployment.configuration is not None
        assert deployment.configuration["products"][0]["price"]["amount"] == "30"

        after = await branch_service.to_schema(
            session, await branch_service.get(session, organization.id, created.id)
        )
        assert after.promoted_deployment_id == promoted.id
        assert after.deployment_id == promoted.id

        products = await product_service.list(session, organization.id)
        by_version = {p.version_id: p for p in products}
        assert set(by_version) == {base_version, promoted.version_id}
        assert Decimal(by_version[promoted.version_id].amount) == Decimal(30)
        assert isinstance(by_version[base_version], VoidProduct)

        again = await branch_service.promote(session, organization.id, created.id)
        assert again.id == promoted.id

    async def test_branch_is_pinned_to_base(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        base_version = await deploy_base(session, organization)
        created = await branch_service.create(
            session,
            organization.id,
            BranchCreate(name="Pinned", base_version_id=base_version),
        )
        newer = deepcopy(CONFIG)
        newer["products"][0]["name"] = "Pro v2"
        await deploy_service.deploy(session, organization.id, DeployCreate(**newer))
        listed = await branch_service.list(session, organization.id)
        assert [b.base_version_id for b in listed] == [base_version]
        assert listed[0].configuration.products[0].name == "Pro"
        assert listed[0].id == created.id

    async def test_create_requires_stored_configuration(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        legacy = VoidDeployment(
            organization=organization,
            checksum="legacy",
            version_id="b" * 64,
            status="draft",
            entries=[],
        )
        await save_fixture(legacy)
        with pytest.raises(BranchBaseUnavailable):
            await branch_service.create(
                session,
                organization.id,
                BranchCreate(name="Legacy", base_version_id="b" * 64),
            )
        with pytest.raises(ResourceNotFound):
            await branch_service.create(
                session,
                organization.id,
                BranchCreate(name="Missing", base_version_id="c" * 64),
            )

    async def test_delete_hides_branch(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        base_version = await deploy_base(session, organization)
        created = await branch_service.create(
            session,
            organization.id,
            BranchCreate(name="Gone", base_version_id=base_version),
        )
        await branch_service.delete(session, organization.id, created.id)
        assert await branch_service.list(session, organization.id) == []
        with pytest.raises(ResourceNotFound):
            await branch_service.get(session, organization.id, created.id)
