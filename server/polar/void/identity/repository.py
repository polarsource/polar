from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, all_, literal, select
from sqlalchemy.dialects.postgresql import array
from sqlalchemy.orm import aliased, joinedload

from polar.kit.repository import RepositoryBase
from polar.models import Organization, VoidBillingIdentity


class IdentityRepository(RepositoryBase[VoidBillingIdentity]):
    model = VoidBillingIdentity

    def get_base_statement(self) -> Select[tuple[VoidBillingIdentity]]:
        return select(VoidBillingIdentity).options(
            joinedload(
                VoidBillingIdentity.parent.and_(
                    VoidBillingIdentity.deleted_at.is_(None)
                )
            )
        )

    def get_scoped_statement(
        self, organization_id: UUID
    ) -> Select[tuple[VoidBillingIdentity]]:
        return self.get_base_statement().where(
            VoidBillingIdentity.organization_id == organization_id,
            VoidBillingIdentity.deleted_at.is_(None),
        )

    async def lock_organization(self, organization_id: UUID) -> None:
        await self.session.execute(
            select(Organization.id)
            .where(Organization.id == organization_id)
            .with_for_update()
        )

    async def get_by_external_id(
        self,
        organization_id: UUID,
        external_id: str,
        *,
        include_deleted: bool = False,
    ) -> VoidBillingIdentity | None:
        statement = self.get_base_statement().where(
            VoidBillingIdentity.organization_id == organization_id,
            VoidBillingIdentity.external_id == external_id,
        )
        if not include_deleted:
            statement = statement.where(VoidBillingIdentity.deleted_at.is_(None))
        return await self.get_one_or_none(statement)

    async def list(
        self,
        organization_id: UUID,
        *,
        parent_id: UUID | None = None,
        roots: bool = False,
    ) -> Sequence[VoidBillingIdentity]:
        statement = self.get_scoped_statement(organization_id)
        if parent_id is not None:
            statement = statement.where(VoidBillingIdentity.parent_id == parent_id)
        elif roots:
            statement = statement.where(VoidBillingIdentity.parent_id.is_(None))
        return await self.get_all(
            statement.order_by(VoidBillingIdentity.created_at, VoidBillingIdentity.id)
        )

    async def chain(
        self, identity: VoidBillingIdentity
    ) -> Sequence[VoidBillingIdentity]:
        walk = (
            select(
                VoidBillingIdentity.id,
                VoidBillingIdentity.parent_id,
                literal(0).label("depth"),
                array([VoidBillingIdentity.id]).label("path"),
            )
            .where(
                VoidBillingIdentity.id == identity.id,
                VoidBillingIdentity.organization_id == identity.organization_id,
                VoidBillingIdentity.deleted_at.is_(None),
            )
            .cte(recursive=True)
        )
        parent = aliased(VoidBillingIdentity)
        walk = walk.union_all(
            select(
                parent.id,
                parent.parent_id,
                walk.c.depth + 1,
                walk.c.path + array([parent.id]),
            )
            .join(walk, parent.id == walk.c.parent_id)
            .where(
                parent.organization_id == identity.organization_id,
                parent.deleted_at.is_(None),
                parent.id != all_(walk.c.path),
            )
        )
        return await self.get_all(
            self.get_scoped_statement(identity.organization_id)
            .join(walk, VoidBillingIdentity.id == walk.c.id)
            .order_by(walk.c.depth)
        )

    async def subtree(
        self, identity: VoidBillingIdentity
    ) -> Sequence[VoidBillingIdentity]:
        walk = (
            select(
                VoidBillingIdentity.id,
                literal(0).label("depth"),
                array([VoidBillingIdentity.id]).label("path"),
            )
            .where(
                VoidBillingIdentity.id == identity.id,
                VoidBillingIdentity.organization_id == identity.organization_id,
                VoidBillingIdentity.deleted_at.is_(None),
            )
            .cte(recursive=True)
        )
        child = aliased(VoidBillingIdentity)
        walk = walk.union_all(
            select(child.id, walk.c.depth + 1, walk.c.path + array([child.id]))
            .join(walk, child.parent_id == walk.c.id)
            .where(
                child.organization_id == identity.organization_id,
                child.deleted_at.is_(None),
                child.id != all_(walk.c.path),
            )
        )
        return await self.get_all(
            self.get_scoped_statement(identity.organization_id)
            .join(walk, VoidBillingIdentity.id == walk.c.id)
            .order_by(
                walk.c.depth, VoidBillingIdentity.created_at, VoidBillingIdentity.id
            )
        )

    async def roots_of(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> dict[str, str]:
        if not external_ids:
            return {}
        walk = (
            select(
                VoidBillingIdentity.external_id.label("external_id"),
                VoidBillingIdentity.parent_id,
                VoidBillingIdentity.external_id.label("ancestor_external_id"),
                array([VoidBillingIdentity.id]).label("path"),
            )
            .where(
                VoidBillingIdentity.organization_id == organization_id,
                VoidBillingIdentity.external_id.in_(external_ids),
                VoidBillingIdentity.deleted_at.is_(None),
            )
            .cte(recursive=True)
        )
        parent = aliased(VoidBillingIdentity)
        walk = walk.union_all(
            select(
                walk.c.external_id,
                parent.parent_id,
                parent.external_id,
                walk.c.path + array([parent.id]),
            )
            .join(parent, parent.id == walk.c.parent_id)
            .where(
                parent.organization_id == organization_id,
                parent.deleted_at.is_(None),
                parent.id != all_(walk.c.path),
            )
        )
        result = await self.session.execute(
            select(walk.c.external_id, walk.c.ancestor_external_id).where(
                walk.c.parent_id.is_(None)
            )
        )
        return {external_id: root for external_id, root in result.all()}
