from uuid import UUID

from sqlalchemy import Select, update
from sqlalchemy.orm import joinedload, selectinload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.utils import utc_now
from polar.models import (
    Checkout,
    CheckoutProduct,
    Organization,
    Product,
)
from polar.models.checkout import CheckoutStatus

from .sorting import CheckoutSortProperty


class CheckoutRepository(
    RepositorySortingMixin[Checkout, CheckoutSortProperty],
    RepositorySoftDeletionIDMixin[Checkout, UUID],
    RepositorySoftDeletionMixin[Checkout],
    RepositoryBase[Checkout],
):
    model = Checkout

    async def get_by_client_secret(
        self, client_secret: str, *, options: Options = ()
    ) -> Checkout | None:
        statement = (
            self.get_base_statement()
            .where(Checkout.client_secret == client_secret)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_id_for_update(
        self, checkout_id: UUID, *, nowait: bool = True, options: Options = ()
    ) -> Checkout | None:
        """
        Get checkout by ID with FOR UPDATE lock.

        Uses FOR UPDATE OF checkouts to lock only the checkout row, allowing
        LEFT OUTER JOINs for eager loading of relationships.

        See: https://www.postgresql.org/docs/current/explicit-locking.html
        """
        statement = (
            self.get_base_statement()
            .where(Checkout.id == checkout_id)
            .options(*options)
            .with_for_update(nowait=nowait, of=Checkout)
        )
        return await self.get_one_or_none(statement)

    async def expire_open_checkouts(self) -> list[UUID]:
        statement = (
            update(Checkout)
            .where(
                Checkout.is_deleted.is_(False),
                Checkout.expires_at <= utc_now(),
                Checkout.status == CheckoutStatus.open,
            )
            .values(status=CheckoutStatus.expired)
            .returning(Checkout.id)
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Checkout]]:
        return self.get_base_statement().where(Checkout.organization_id.in_(org_ids))

    def get_eager_options(self) -> Options:
        return (
            joinedload(Checkout.organization).joinedload(Organization.account),
            joinedload(Checkout.customer),
            joinedload(Checkout.product).options(
                selectinload(Product.product_medias),
                selectinload(Product.attached_custom_fields),
            ),
            selectinload(Checkout.checkout_products).options(
                joinedload(CheckoutProduct.product).options(
                    selectinload(Product.product_medias),
                )
            ),
            joinedload(Checkout.subscription),
            joinedload(Checkout.discount),
            joinedload(Checkout.product_price),
        )

    def get_sorting_clause(self, property: CheckoutSortProperty) -> SortingClause:
        match property:
            case CheckoutSortProperty.created_at:
                return Checkout.created_at
            case CheckoutSortProperty.expires_at:
                return Checkout.expires_at
            case CheckoutSortProperty.status:
                return Checkout.status
