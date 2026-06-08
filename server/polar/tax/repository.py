from collections.abc import Sequence
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import Select, case, func, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.sql.expression import asc, desc

from polar.kit.repository import RepositoryBase
from polar.kit.sorting import Sorting
from polar.models import Order, Transaction
from polar.models.transaction import TransactionType

from .sorting import TaxJurisdictionSortProperty

# Transaction types that carry a tax amount. Payments add tax, refunds and
# disputes subtract it, and their reversals add it back, so summing
# `tax_amount` across these types yields the net tax Polar remitted. Other
# types (`balance`, `payout`, `processor_fee`, ...) store `tax_amount=0` but
# still reference an order, so including them would inflate `order_count`.
TAX_BEARING_TRANSACTION_TYPES = (
    TransactionType.payment,
    TransactionType.refund,
    TransactionType.refund_reversal,
    TransactionType.dispute,
    TransactionType.dispute_reversal,
)


class TaxJurisdictionRepository(RepositoryBase[Transaction]):
    model = Transaction

    def get_jurisdictions_statement(
        self,
        organization_ids: Sequence[UUID],
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        sorting: list[Sorting[TaxJurisdictionSortProperty]],
    ) -> Select[tuple[str, str | None, str, int, int]]:
        # Only US and Canada are reported at the state level; everywhere else is
        # aggregated to the country. Transactions already store `tax_state` as
        # NULL outside US/CA (see transaction.service.payment), but we guard
        # explicitly here so the breakdown honors that contract regardless of
        # what is stored — a stray non-US/CA `tax_state` must not fragment a
        # country into spurious sub-jurisdictions. `else_=None` also makes the
        # column correctly nullable despite `tax_state`'s `Mapped[str]` annotation.
        state_column = case(
            (Transaction.tax_country.in_(("US", "CA")), Transaction.tax_state),
            else_=None,
        ).label("state")
        # Sum `tax_amount` across every tax-bearing transaction (payments,
        # refunds, disputes and their reversals — see the `type` filter below),
        # which yields the net tax Polar remitted on the merchant's behalf after
        # refunds and disputes are netted out.
        tax_amount_column = func.sum(Transaction.tax_amount).label("tax_amount")
        order_count_column = func.count(func.distinct(Transaction.order_id)).label(
            "order_count"
        )

        statement = (
            select(
                Transaction.tax_country.label("country"),
                state_column,
                Transaction.currency.label("currency"),
                tax_amount_column,
                order_count_column,
            )
            .join(Order, Order.id == Transaction.order_id)
            .where(
                Transaction.tax_country.is_not(None),
                Transaction.type.in_(TAX_BEARING_TRANSACTION_TYPES),
                Order.organization_id.in_(organization_ids),
            )
            .group_by(
                Transaction.tax_country,
                state_column,
                Transaction.currency,
            )
        )

        if start_date is not None:
            statement = statement.where(Transaction.created_at >= start_date)
        if end_date is not None:
            statement = statement.where(
                Transaction.created_at < end_date + timedelta(days=1)
            )

        order_by_clauses = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == TaxJurisdictionSortProperty.tax_amount:
                order_by_clauses.append(clause_function(tax_amount_column))
            elif criterion == TaxJurisdictionSortProperty.order_count:
                order_by_clauses.append(clause_function(order_count_column))
            elif criterion == TaxJurisdictionSortProperty.country:
                order_by_clauses.append(clause_function(Transaction.tax_country))
        statement = statement.order_by(*order_by_clauses)

        return statement

    def get_summary_statement(
        self,
        organization_ids: Sequence[UUID],
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Select[tuple[str | None, int, int, int]]:
        # Aggregate the per-jurisdiction breakdown into a single net total so
        # the summary reflects the full filtered dataset rather than whatever
        # page the breakdown is currently showing.
        grouped = self.get_jurisdictions_statement(
            organization_ids,
            start_date=start_date,
            end_date=end_date,
            sorting=[],
        ).subquery()

        # Each order belongs to exactly one (country, state, currency) bucket,
        # so summing the per-bucket order counts yields the distinct order
        # total without double counting.
        return select(
            # Representative currency: the one from the largest tax bucket,
            # matching the breakdown's default `-tax_amount` ordering. NULL
            # (no rows) is handled by the caller.
            func.array_agg(
                aggregate_order_by(
                    grouped.c.currency, func.abs(grouped.c.tax_amount).desc()
                )
            )[1].label("currency"),
            func.coalesce(func.sum(grouped.c.tax_amount), 0).label("tax_amount"),
            func.coalesce(func.sum(grouped.c.order_count), 0).label("order_count"),
            func.count().label("jurisdiction_count"),
        ).select_from(grouped)
