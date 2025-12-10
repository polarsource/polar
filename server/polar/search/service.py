import asyncio
import uuid
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.customer.repository import CustomerRepository
from polar.kit.db.postgres import AsyncReadSession
from polar.models import (
    Customer,
    Order,
    Product,
    Subscription,
)
from polar.order.repository import OrderRepository
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository

from .schemas import (
    SearchResult,
    SearchResultCustomer,
    SearchResultOrder,
    SearchResultProduct,
    SearchResultSubscription,
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
        limit: int = 5,
    ) -> list[SearchResult]:
        prefix_term = f"{query}%"
        substring_term = f"%{query}%"
        query_uuid = self._try_parse_uuid(query)

        tasks: list[asyncio.Task[Any]] = []

        if self._has_products_scope(auth_subject):
            tasks.append(
                asyncio.create_task(
                    self._search_products(
                        session,
                        auth_subject,
                        organization_id,
                        substring_term,
                        query_uuid,
                        limit,
                    )
                )
            )

        if self._has_customers_scope(auth_subject):
            tasks.append(
                asyncio.create_task(
                    self._search_customers(
                        session,
                        auth_subject,
                        organization_id,
                        prefix_term,
                        query_uuid,
                        limit,
                    )
                )
            )

        if self._has_orders_scope(auth_subject):
            tasks.append(
                asyncio.create_task(
                    self._search_orders(
                        session,
                        auth_subject,
                        organization_id,
                        prefix_term,
                        substring_term,
                        query_uuid,
                        limit,
                    )
                )
            )

        if self._has_subscriptions_scope(auth_subject):
            tasks.append(
                asyncio.create_task(
                    self._search_subscriptions(
                        session,
                        auth_subject,
                        organization_id,
                        prefix_term,
                        substring_term,
                        query_uuid,
                        limit,
                    )
                )
            )

        if not tasks:
            return []

        results = await asyncio.gather(*tasks)
        return [item for sublist in results for item in sublist]

    async def _search_products(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        organization_id: uuid.UUID,
        search_term: str,
        query_uuid: uuid.UUID | None,
        limit: int,
    ) -> list[SearchResultProduct]:
        product_repository = ProductRepository.from_session(session)
        product_statement = product_repository.get_readable_statement(
            auth_subject
        ).where(Product.organization_id == organization_id)

        if query_uuid:
            product_statement = product_statement.where(Product.id == query_uuid)
        else:
            product_statement = product_statement.where(
                or_(
                    Product.name.ilike(search_term),
                    Product.description.ilike(search_term),
                )
            )

        product_statement = product_statement.limit(limit)
        products = await product_repository.get_all(product_statement)

        return [
            SearchResultProduct(
                id=product.id,
                name=product.name,
                description=product.description,
            )
            for product in products
        ]

    async def _search_customers(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        organization_id: uuid.UUID,
        search_term: str,
        query_uuid: uuid.UUID | None,
        limit: int,
    ) -> list[SearchResultCustomer]:
        customer_repository = CustomerRepository.from_session(session)
        customer_statement = customer_repository.get_readable_statement(
            auth_subject
        ).where(Customer.organization_id == organization_id)

        if query_uuid:
            customer_statement = customer_statement.where(Customer.id == query_uuid)
        else:
            customer_statement = customer_statement.where(
                or_(
                    Customer.email.ilike(search_term),
                    Customer.name.ilike(search_term),
                )
            )

        customer_statement = customer_statement.limit(limit)
        customers = await customer_repository.get_all(customer_statement)

        return [
            SearchResultCustomer(
                id=customer.id,
                name=customer.name,
                email=customer.email,
            )
            for customer in customers
        ]

    async def _search_orders(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        organization_id: uuid.UUID,
        prefix_term: str,
        substring_term: str,
        query_uuid: uuid.UUID | None,
        limit: int,
    ) -> list[SearchResultOrder]:
        order_repository = OrderRepository.from_session(session)

        order_statement = (
            order_repository.get_readable_statement(auth_subject)
            .options(
                joinedload(Order.customer),
                joinedload(Order.product),
            )
            .where(Product.organization_id == organization_id)
        )

        if query_uuid:
            order_statement = order_statement.where(Order.id == query_uuid)
        else:
            order_statement = order_statement.where(
                or_(
                    Customer.email.ilike(prefix_term),
                    Customer.name.ilike(prefix_term),
                    Product.name.ilike(substring_term),
                    Order.invoice_number.ilike(substring_term),
                    Order.stripe_invoice_id.ilike(substring_term),
                )
            )

        order_statement = order_statement.limit(limit)
        orders = await order_repository.get_all(order_statement)

        return [
            SearchResultOrder(
                id=order.id,
                customer_name=order.customer.name,
                customer_email=order.customer.email,
                product_name=order.product.name,
                amount=order.total_amount,
            )
            for order in orders
            if order.product is not None and order.customer is not None
        ]

    async def _search_subscriptions(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        organization_id: uuid.UUID,
        prefix_term: str,
        substring_term: str,
        query_uuid: uuid.UUID | None,
        limit: int,
    ) -> list[SearchResultSubscription]:
        subscription_repository = SubscriptionRepository.from_session(session)

        subscription_statement = (
            subscription_repository.get_readable_statement(auth_subject)
            .options(
                joinedload(Subscription.customer),
                joinedload(Subscription.product),
            )
            .where(Product.organization_id == organization_id)
        )

        if query_uuid:
            subscription_statement = subscription_statement.where(
                Subscription.id == query_uuid
            )
        else:
            subscription_statement = subscription_statement.where(
                or_(
                    Customer.email.ilike(prefix_term),
                    Customer.name.ilike(prefix_term),
                    Product.name.ilike(substring_term),
                )
            )

        subscription_statement = subscription_statement.limit(limit)
        subscriptions = await subscription_repository.get_all(subscription_statement)

        return [
            SearchResultSubscription(
                id=subscription.id,
                customer_name=subscription.customer.name,
                customer_email=subscription.customer.email,
                product_name=subscription.product.name,
                status=subscription.status,
                amount=subscription.amount,
            )
            for subscription in subscriptions
            if subscription.product is not None and subscription.customer is not None
        ]


search = SearchService()
