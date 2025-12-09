import asyncio
import uuid

from sqlalchemy import String, cast, or_
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, User
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
    async def search(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        *,
        organization_id: uuid.UUID,
        query: str,
        limit: int = 5,
    ) -> list[SearchResult]:
        search_term = f"%{query}%"

        products_task = self._search_products(
            session, auth_subject, organization_id, search_term, limit
        )
        customers_task = self._search_customers(
            session, auth_subject, organization_id, search_term, limit
        )
        orders_task = self._search_orders(
            session, auth_subject, organization_id, search_term, limit
        )
        subscriptions_task = self._search_subscriptions(
            session, auth_subject, organization_id, search_term, limit
        )

        products, customers, orders, subscriptions = await asyncio.gather(
            products_task, customers_task, orders_task, subscriptions_task
        )

        return [*products, *customers, *orders, *subscriptions]

    async def _search_products(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        organization_id: uuid.UUID,
        search_term: str,
        limit: int,
    ) -> list[SearchResultProduct]:
        product_repository = ProductRepository.from_session(session)
        product_statement = product_repository.get_readable_statement(auth_subject)
        product_statement = product_statement.where(
            Product.organization_id == organization_id,
            or_(
                Product.name.ilike(search_term),
                Product.description.ilike(search_term),
            ),
        ).limit(limit)

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
        limit: int,
    ) -> list[SearchResultCustomer]:
        customer_repository = CustomerRepository.from_session(session)
        customer_statement = customer_repository.get_readable_statement(auth_subject)
        customer_statement = customer_statement.where(
            Customer.organization_id == organization_id,
            or_(
                Customer.email.ilike(search_term),
                Customer.name.ilike(search_term),
            ),
        ).limit(limit)

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
        search_term: str,
        limit: int,
    ) -> list[SearchResultOrder]:
        order_repository = OrderRepository.from_session(session)
        order_statement = (
            order_repository.get_readable_statement(auth_subject)
            .options(
                joinedload(Order.customer),
                joinedload(Order.product),
            )
            .where(
                Product.organization_id == organization_id,
                or_(
                    Customer.email.ilike(search_term),
                    Customer.name.ilike(search_term),
                    Product.name.ilike(search_term),
                    Order.invoice_number.ilike(search_term),
                    Order.stripe_invoice_id.ilike(search_term),
                    cast(Order.id, String).ilike(search_term),
                ),
            )
            .limit(limit)
        )

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
        search_term: str,
        limit: int,
    ) -> list[SearchResultSubscription]:
        subscription_repository = SubscriptionRepository.from_session(session)
        subscription_statement = (
            subscription_repository.get_readable_statement(auth_subject)
            .options(
                joinedload(Subscription.customer),
                joinedload(Subscription.product),
            )
            .where(
                Product.organization_id == organization_id,
                or_(
                    Customer.email.ilike(search_term),
                    Customer.name.ilike(search_term),
                    Product.name.ilike(search_term),
                    cast(Subscription.id, String).ilike(search_term),
                ),
            )
            .limit(limit)
        )

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
