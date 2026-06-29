from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.repository import select_accessible_org_ids
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import BenefitGrant, Customer, ManualGrant, Organization, User


class ManualGrantRepository(
    RepositorySoftDeletionIDMixin[ManualGrant, UUID],
    RepositorySoftDeletionMixin[ManualGrant],
    RepositoryBase[ManualGrant],
):
    model = ManualGrant

    def get_eager_options(self) -> Options:
        return (selectinload(ManualGrant.grants),)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[ManualGrant]]:
        statement = self.get_base_statement().join(
            Customer, ManualGrant.customer_id == Customer.id
        )
        if is_user(auth_subject):
            statement = statement.where(
                Customer.organization_id.in_(select_accessible_org_ids(auth_subject))
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Customer.organization_id == auth_subject.subject.id
            )
        return statement

    async def list_readable(
        self,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[UUID] | None = None,
        customer_id: Sequence[UUID] | None = None,
        benefit_id: Sequence[UUID] | None = None,
    ) -> Select[tuple[ManualGrant]]:
        statement = (
            self.get_readable_statement(auth_subject)
            .where(ManualGrant.deleted_at.is_(None))
            .order_by(ManualGrant.created_at.desc())
            .options(*self.get_eager_options())
        )
        if organization_id is not None:
            statement = statement.where(Customer.organization_id.in_(organization_id))
        if customer_id is not None:
            statement = statement.where(ManualGrant.customer_id.in_(customer_id))
        if benefit_id is not None:
            statement = statement.where(
                select(BenefitGrant.id)
                .where(
                    BenefitGrant.manual_grant_id == ManualGrant.id,
                    BenefitGrant.benefit_id.in_(benefit_id),
                    BenefitGrant.deleted_at.is_(None),
                )
                .exists()
            )
        return statement
