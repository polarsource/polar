from collections.abc import Sequence
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.sql.base import ExecutableOption

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import CheckoutLink, CheckoutLinkProduct, Product, UserOrganization

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class CheckoutLinkRepository(
    RepositoryIDMixin[CheckoutLink, UUID],
    RepositorySoftDeletionMixin[CheckoutLink],
    RepositoryBase[CheckoutLink],
):
    model = CheckoutLink

    async def get_by_client_secret(
        self, client_secret: str, *, options: Sequence[ExecutableOption] = ()
    ) -> CheckoutLink | None:
        statement = (
            self.get_base_statement()
            .join(
                Organization, onclause=Organization.id == CheckoutLink.organization_id
            )
            .where(
                CheckoutLink.client_secret == client_secret,
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(
        self, *, checkout_link_product_load: "_AbstractLoad | None" = None
    ) -> Sequence[ExecutableOption]:
        checkout_link_product_load = (
            checkout_link_product_load
            if checkout_link_product_load
            else selectinload(CheckoutLink.checkout_link_products)
        )
        return (
            checkout_link_product_load.options(
                joinedload(CheckoutLinkProduct.product).options(
                    joinedload(Product.product_medias),
                    joinedload(Product.attached_custom_fields),
                )
            ),
            joinedload(CheckoutLink.discount),
            joinedload(CheckoutLink.organization),
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CheckoutLink]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                CheckoutLink.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                CheckoutLink.organization_id == auth_subject.subject.id,
            )

        return statement
