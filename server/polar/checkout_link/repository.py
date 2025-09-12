from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.orm.strategy_options import contains_eager

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import CheckoutLink, CheckoutLinkProduct, Product, UserOrganization

from .sorting import CheckoutLinkSortProperty

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class CheckoutLinkRepository(
    RepositorySortingMixin[CheckoutLink, CheckoutLinkSortProperty],
    RepositorySoftDeletionIDMixin[CheckoutLink, UUID],
    RepositorySoftDeletionMixin[CheckoutLink],
    RepositoryBase[CheckoutLink],
):
    model = CheckoutLink
    sorting_enum = CheckoutLinkSortProperty

    def get_sorting_clause(self, property: CheckoutLinkSortProperty) -> SortingClause:
        if property == CheckoutLinkSortProperty.created_at:
            return self.model.created_at
        elif property == CheckoutLinkSortProperty.label:
            return self.model.label
        elif property == CheckoutLinkSortProperty.success_url:
            return self.model._success_url
        elif property == CheckoutLinkSortProperty.allow_discount_codes:
            return self.model.allow_discount_codes
        elif property == CheckoutLinkSortProperty.organization:
            return Organization.name
        raise NotImplementedError()  # pragma: no cover

    async def get_by_client_secret(
        self, client_secret: str, *, options: Options = ()
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
    ) -> Options:
        checkout_link_product_load = (
            checkout_link_product_load
            if checkout_link_product_load
            else selectinload(CheckoutLink.checkout_link_products)
        )
        return (
            checkout_link_product_load.options(
                joinedload(CheckoutLinkProduct.product).options(
                    joinedload(Product.organization),
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

    async def count_by_organization_id(self, organization_id: UUID) -> int:
        """Count checkout links for a specific organization."""
        statement = self.get_base_statement().where(
            CheckoutLink.organization_id == organization_id
        )
        return await self.count(statement)

    async def restore(
        self, checkout_link: CheckoutLink, *, flush: bool = False
    ) -> CheckoutLink:
        """Restore a soft-deleted checkout link by setting deleted_at to None."""
        return await self.update(
            checkout_link, update_dict={"deleted_at": None}, flush=flush
        )

    async def archive_product(self, product_id: UUID) -> None:
        statement = (
            self.get_base_statement()
            .join(
                CheckoutLinkProduct,
                onclause=CheckoutLinkProduct.checkout_link_id == CheckoutLink.id,
            )
            .where(CheckoutLinkProduct.product_id == product_id)
            .options(contains_eager(CheckoutLink.checkout_link_products))
        )
        checkout_links = await self.get_all(statement)
        for checkout_link in checkout_links:
            checkout_link.checkout_link_products = [
                product
                for product in checkout_link.checkout_link_products
                if product.product_id != product_id
            ]
            if not checkout_link.checkout_link_products:
                await self.soft_delete(checkout_link)
            self.session.add(checkout_link)
