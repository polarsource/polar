from collections.abc import Sequence
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import Select, case, func, select
from sqlalchemy.sql.expression import asc, desc

from polar.kit.repository import RepositoryBase
from polar.kit.sorting import Sorting
from polar.models import Transaction

from .sorting import TaxJurisdictionSortProperty


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
        # explicitly here so the grouping honors the requirement regardless of
        # what is stored.
        state_column = case(
            (Transaction.tax_country.in_(("US", "CA")), Transaction.tax_state),
            else_=None,
        ).label("state")
        # `tax_amount` is positive for payments and negative for refunds and
        # disputes, so summing across every tax-bearing transaction yields the
        # net amount Polar remitted on the merchant's behalf.
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
            .where(
                Transaction.tax_country.is_not(None),
                Transaction.payment_organization_id.in_(organization_ids),
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
