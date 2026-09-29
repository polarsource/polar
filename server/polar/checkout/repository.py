import typing
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    ColumnExpressionArgument,
    CursorResult,
    Select,
    func,
    null,
    select,
    update,
)
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


def expired_pending_anonymization(
    older_than: datetime,
) -> tuple[ColumnExpressionArgument[bool], ...]:
    return (
        Checkout.anonymized_at.is_(None),
        Checkout.status == CheckoutStatus.expired,
        Checkout.created_at < older_than,
    )


class CheckoutRepository(
    RepositorySortingMixin[Checkout, CheckoutSortProperty],
    RepositorySoftDeletionIDMixin[Checkout, UUID],
    RepositorySoftDeletionMixin[Checkout],
    RepositoryBase[Checkout],
):
    model = Checkout

    @typing.overload
    async def get_by_client_secret(
        self,
        client_secret: str,
        *,
        options: Options = (),
        for_update: typing.Literal[False] = False,
    ) -> Checkout: ...

    @typing.overload
    async def get_by_client_secret(
        self,
        client_secret: str,
        *,
        options: Options = (),
        for_update: typing.Literal[True],
        nowait: bool = False,
    ) -> Checkout | None: ...

    async def get_by_client_secret(
        self,
        client_secret: str,
        *,
        options: Options = (),
        for_update: bool = False,
        nowait: bool = False,
    ) -> Checkout | None:
        statement = (
            self.get_base_statement()
            .where(Checkout.client_secret == client_secret)
            .options(*options)
        )
        if for_update:
            statement = statement.with_for_update(of=Checkout, nowait=nowait)

        return await self.get_one_or_none(statement)

    async def expire_open_checkouts(self) -> list[UUID]:
        statement = (
            update(Checkout)
            .where(
                ~Checkout.is_deleted,
                Checkout.expires_at <= utc_now(),
                Checkout.status == CheckoutStatus.open,
            )
            .values(status=CheckoutStatus.expired)
            .returning(Checkout.id)
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count_expired_pending_anonymization(self, older_than: datetime) -> int:
        statement = select(func.count(Checkout.id)).where(
            *expired_pending_anonymization(older_than)
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def anonymize_expired(self, older_than: datetime, *, batch_size: int) -> int:
        """
        Scrub customer PII from up to `batch_size` expired checkouts, returning
        how many were scrubbed.

        Soft-deleted checkouts are included, since they still hold the PII.
        """
        # Postgres has no `UPDATE ... LIMIT`, so the batch is bounded by a subquery.
        batch_statement = (
            select(Checkout.id)
            .where(*expired_pending_anonymization(older_than))
            .limit(batch_size)
        )
        statement = (
            update(Checkout)
            .where(Checkout.id.in_(batch_statement))
            .values(
                {
                    Checkout.customer_id: null(),
                    Checkout.external_customer_id: null(),
                    Checkout.customer_name: null(),
                    Checkout.customer_email: null(),
                    Checkout._customer_ip_address: null(),
                    Checkout.customer_billing_name: null(),
                    Checkout.customer_billing_address: null(),
                    Checkout.customer_tax_id: null(),
                    Checkout.customer_metadata: {},
                    Checkout.custom_field_data: {},
                    # Holds the Stripe `cus_` id, which points at the buyer's
                    # name, email and address on Stripe's side.
                    Checkout.payment_processor_metadata: {},
                    # `distinct_id` falls back to the customer's email.
                    # `opened_at` stays: it drives the checkout funnel metrics.
                    Checkout.analytics_metadata: Checkout.analytics_metadata.op("-")(
                        "distinct_id"
                    ),
                    Checkout.anonymized_at: utc_now(),
                }
            )
        )
        result = typing.cast(
            CursorResult[typing.Any], await self.session.execute(statement)
        )
        return result.rowcount

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Checkout]]:
        return self.get_base_statement().where(Checkout.organization_id.in_(org_ids))

    def get_eager_options(self) -> Options:
        return (
            joinedload(Checkout.organization).joinedload(Organization.account),
            joinedload(Checkout.customer),
            selectinload(Checkout.product).options(
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
