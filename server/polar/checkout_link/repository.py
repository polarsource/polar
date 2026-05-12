from collections.abc import Iterable
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload, selectinload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import (
    Benefit,
    CheckoutLink,
    CheckoutLinkProduct,
    Organization,
    Product,
    ProductBenefit,
)
from polar.models.benefit import BenefitType

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class CheckoutLinkRepository(
    RepositorySoftDeletionIDMixin[CheckoutLink, UUID],
    RepositorySoftDeletionMixin[CheckoutLink],
    RepositoryBase[CheckoutLink],
):
    model = CheckoutLink

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
                Organization.can_authenticate.is_(True),
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

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[CheckoutLink]]:
        return self.get_base_statement().where(
            CheckoutLink.organization_id.in_(org_ids)
        )

    async def has_with_benefit_types(
        self, organization_id: UUID, benefit_types: Iterable[BenefitType]
    ) -> bool:
        """Whether the organization has any live checkout link pointing at
        an active product that grants a benefit of the given types."""
        statement = (
            select(CheckoutLink.id)
            .join(
                CheckoutLinkProduct,
                CheckoutLink.id == CheckoutLinkProduct.checkout_link_id,
            )
            .join(Product, CheckoutLinkProduct.product_id == Product.id)
            .join(ProductBenefit, Product.id == ProductBenefit.product_id)
            .join(Benefit, ProductBenefit.benefit_id == Benefit.id)
            .where(
                CheckoutLink.organization_id == organization_id,
                CheckoutLink.deleted_at.is_(None),
                Product.deleted_at.is_(None),
                Product.is_archived.is_(False),
                Benefit.deleted_at.is_(None),
                Benefit.type.in_(list(benefit_types)),
            )
            .limit(1)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def has_any(self, organization_id: UUID) -> bool:
        """Whether the organization has any live checkout link at all,
        regardless of its product or success_url configuration."""
        statement = (
            select(CheckoutLink.id)
            .where(
                CheckoutLink.organization_id == organization_id,
                CheckoutLink.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def has_with_success_url(self, organization_id: UUID) -> bool:
        """Whether the organization has any live checkout link with a
        success_url set, meaning the merchant handles fulfillment by
        redirecting customers to their own site after checkout."""
        statement = (
            select(CheckoutLink.id)
            .where(
                CheckoutLink.organization_id == organization_id,
                CheckoutLink.deleted_at.is_(None),
                CheckoutLink._success_url.isnot(None),
            )
            .limit(1)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def archive_product(self, product_id: UUID) -> None:
        statement = (
            self.get_base_statement()
            .where(
                CheckoutLink.id.in_(
                    select(CheckoutLinkProduct.checkout_link_id).where(
                        CheckoutLinkProduct.product_id == product_id
                    )
                )
            )
            .options(selectinload(CheckoutLink.checkout_link_products))
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
