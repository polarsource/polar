import uuid
from typing import Any

from sqlalchemy import (
    ColumnElement,
    Integer,
    Select,
    String,
    func,
    literal,
    or_,
    select,
    union_all,
)

from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.kit.db.postgres import AsyncReadSession
from polar.models import (
    Customer,
    Order,
    Organization,
    Product,
    Subscription,
    UserOrganization,
)

from .schemas import (
    SearchResult,
    SearchResultTypeAdapter,
)


class SearchService:
    def _try_parse_uuid(self, query: str) -> uuid.UUID | None:
        try:
            return uuid.UUID(query.strip())
        except (ValueError, AttributeError):
            return None

    def _has_products_scope(self, auth_subject: AuthSubject[User]) -> bool:
        return bool(
            auth_subject.scopes
            & {
                Scope.web_read,
                Scope.web_write,
                Scope.products_read,
                Scope.products_write,
            }
        )

    def _has_customers_scope(self, auth_subject: AuthSubject[User]) -> bool:
        return bool(
            auth_subject.scopes
            & {
                Scope.web_read,
                Scope.web_write,
                Scope.customers_read,
                Scope.customers_write,
            }
        )

    def _has_orders_scope(self, auth_subject: AuthSubject[User]) -> bool:
        return bool(
            auth_subject.scopes & {Scope.web_read, Scope.web_write, Scope.orders_read}
        )

    def _has_subscriptions_scope(self, auth_subject: AuthSubject[User]) -> bool:
        return bool(
            auth_subject.scopes
            & {
                Scope.web_read,
                Scope.web_write,
                Scope.subscriptions_read,
                Scope.subscriptions_write,
            }
        )

    async def search(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        *,
        organization_id: uuid.UUID,
        query: str,
        limit: int = 20,
    ) -> list[SearchResult]:
        query_uuid = self._try_parse_uuid(query)

        ts_query_simple = func.websearch_to_tsquery("simple", query)
        ts_query_english = func.websearch_to_tsquery("english", query)
        ilike_term = f"%{query}%"

        organization_subquery = (
            select(Organization.id)
            .join(UserOrganization, Organization.id == UserOrganization.organization_id)
            .where(
                Organization.id == organization_id,
                UserOrganization.user_id == auth_subject.subject.id,
                UserOrganization.deleted_at.is_(None),
            )
        )

        subqueries: list[Select[Any]] = []
        if self._has_products_scope(auth_subject):
            products_subquery = self._build_products_subquery(
                organization_subquery, query_uuid, ts_query_english
            )
            subqueries.append(products_subquery)

        if self._has_customers_scope(auth_subject):
            customers_subquery = self._build_customers_subquery(
                organization_subquery, query_uuid, ts_query_simple, ilike_term
            )
            subqueries.append(customers_subquery)

        if self._has_orders_scope(auth_subject):
            orders_subquery = self._build_orders_subquery(
                organization_subquery,
                query_uuid,
                ts_query_simple,
                ts_query_english,
                ilike_term,
            )
            subqueries.append(orders_subquery)

        if self._has_subscriptions_scope(auth_subject):
            subscriptions_subquery = self._build_subscriptions_subquery(
                organization_subquery,
                query_uuid,
                ts_query_simple,
                ts_query_english,
                ilike_term,
            )
            subqueries.append(subscriptions_subquery)

        if not subqueries:
            return []

        union_query = union_all(*subqueries).subquery()

        final_query = (
            select(union_query).order_by(union_query.c.rank.desc()).limit(limit)
        )

        result = await session.execute(final_query)
        return [SearchResultTypeAdapter.validate_python(row) for row in result.all()]

    def _build_products_subquery(
        self,
        organization_subquery: Select[tuple[uuid.UUID]],
        query_uuid: uuid.UUID | None,
        ts_query_english: ColumnElement[Any],
    ) -> Select[Any]:
        rank_expr = func.ts_rank(Product.search_vector, ts_query_english)

        stmt = select(
            Product.id,
            literal("product").label("type"),
            rank_expr.label("rank"),
            Product.name.label("name"),
            Product.description.label("description"),
            literal(None).cast(String).label("email"),
            literal(None).cast(String).label("customer_name"),
            literal(None).cast(String).label("customer_email"),
            literal(None).cast(String).label("product_name"),
            literal(None).cast(Integer).label("amount"),
            literal(None).cast(String).label("status"),
        ).where(
            Product.organization_id.in_(organization_subquery),
            Product.deleted_at.is_(None),
        )

        if query_uuid:
            stmt = stmt.where(Product.id == query_uuid)
        else:
            stmt = stmt.where(Product.search_vector.op("@@")(ts_query_english))

        return stmt

    def _build_customers_subquery(
        self,
        organization_subquery: Select[tuple[uuid.UUID]],
        query_uuid: uuid.UUID | None,
        ts_query_simple: ColumnElement[Any],
        ilike_term: str,
    ) -> Select[Any]:
        rank_expr = func.ts_rank(Customer.search_vector, ts_query_simple)

        stmt = select(
            Customer.id,
            literal("customer").label("type"),
            rank_expr.label("rank"),
            Customer.name.label("name"),
            literal(None).cast(String).label("description"),
            Customer.email.label("email"),
            literal(None).cast(String).label("customer_name"),
            literal(None).cast(String).label("customer_email"),
            literal(None).cast(String).label("product_name"),
            literal(None).cast(Integer).label("amount"),
            literal(None).cast(String).label("status"),
        ).where(
            Customer.organization_id.in_(organization_subquery),
            Customer.deleted_at.is_(None),
        )

        if query_uuid:
            stmt = stmt.where(Customer.id == query_uuid)
        else:
            stmt = stmt.where(
                or_(
                    Customer.search_vector.op("@@")(ts_query_simple),
                    Customer.email.ilike(ilike_term),
                )
            )

        return stmt

    def _build_orders_subquery(
        self,
        organization_subquery: Select[tuple[uuid.UUID]],
        query_uuid: uuid.UUID | None,
        ts_query_simple: ColumnElement[Any],
        ts_query_english: ColumnElement[Any],
        ilike_term: str,
    ) -> Select[Any]:
        rank_expr = func.greatest(
            func.ts_rank(Order.search_vector, ts_query_simple),
            func.ts_rank(Customer.search_vector, ts_query_simple),
            func.ts_rank(Product.search_vector, ts_query_english),
        )

        stmt = (
            select(
                Order.id,
                literal("order").label("type"),
                rank_expr.label("rank"),
                literal(None).cast(String).label("name"),
                literal(None).cast(String).label("description"),
                literal(None).cast(String).label("email"),
                Customer.name.label("customer_name"),
                Customer.email.label("customer_email"),
                Product.name.label("product_name"),
                (
                    Order.subtotal_amount - Order.discount_amount + Order.tax_amount
                ).label("amount"),
                literal(None).cast(String).label("status"),
            )
            .join(Customer, Order.customer_id == Customer.id)
            .join(Product, Order.product_id == Product.id)
            .where(
                Customer.organization_id.in_(organization_subquery),
                Order.deleted_at.is_(None),
            )
        )

        if query_uuid:
            stmt = stmt.where(Order.id == query_uuid)
        else:
            stmt = stmt.where(
                or_(
                    Order.search_vector.op("@@")(ts_query_simple),
                    Customer.search_vector.op("@@")(ts_query_simple),
                    Product.search_vector.op("@@")(ts_query_english),
                    Customer.email.ilike(ilike_term),
                )
            )

        return stmt

    def _build_subscriptions_subquery(
        self,
        organization_subquery: Select[tuple[uuid.UUID]],
        query_uuid: uuid.UUID | None,
        ts_query_simple: ColumnElement[Any],
        ts_query_english: ColumnElement[Any],
        ilike_term: str,
    ) -> Select[Any]:
        rank_expr = func.greatest(
            func.ts_rank(Customer.search_vector, ts_query_simple),
            func.ts_rank(Product.search_vector, ts_query_english),
        )

        stmt = (
            select(
                Subscription.id,
                literal("subscription").label("type"),
                rank_expr.label("rank"),
                literal(None).cast(String).label("name"),
                literal(None).cast(String).label("description"),
                literal(None).cast(String).label("email"),
                Customer.name.label("customer_name"),
                Customer.email.label("customer_email"),
                Product.name.label("product_name"),
                Subscription.amount.label("amount"),
                Subscription.status.label("status"),
            )
            .join(Customer, Subscription.customer_id == Customer.id)
            .join(Product, Subscription.product_id == Product.id)
            .where(
                Customer.organization_id.in_(organization_subquery),
                Subscription.deleted_at.is_(None),
            )
        )

        if query_uuid:
            stmt = stmt.where(Subscription.id == query_uuid)
        else:
            stmt = stmt.where(
                or_(
                    Customer.search_vector.op("@@")(ts_query_simple),
                    Product.search_vector.op("@@")(ts_query_english),
                    Customer.email.ilike(ilike_term),
                )
            )

        return stmt


search = SearchService()
