from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select, select, update
from sqlalchemy.orm import joinedload, selectinload

from polar.auth.models import AuthSubject, User, is_organization, is_user
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
    UserOrganization,
)
from polar.models.checkout import CheckoutStatus

from .sorting import CheckoutSortProperty

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


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

    async def expire_open_checkouts(self) -> None:
        statement = (
            update(Checkout)
            .where(
                Checkout.deleted_at.is_(None),
                Checkout.expires_at <= utc_now(),
                Checkout.status == CheckoutStatus.open,
            )
            .values(status=CheckoutStatus.expired)
        )
        await self.session.execute(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Checkout]]:
        statement = self.get_base_statement().join(Checkout.product)

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        return statement

    def get_eager_options(
        self, *, product_load: "_AbstractLoad | None" = None
    ) -> Options:
        if product_load is None:
            product_load = joinedload(Checkout.product)
        return (
            joinedload(Checkout.customer),
            product_load.options(
                joinedload(Product.organization).joinedload(Organization.account),
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
            joinedload(Checkout.customer),
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
