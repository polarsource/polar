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
        limit: int = 20,
    ) -> list[SearchResult]:
        results: list[SearchResult] = []

        search_term = f"%{query}%"

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

        for product in products:
            results.append(
                SearchResultProduct(
                    id=product.id,
                    name=product.name,
                    description=product.description,
                )
            )

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

        for customer in customers:
            results.append(
                SearchResultCustomer(
                    id=customer.id,
                    name=customer.name,
                    email=customer.email,
                )
            )

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

        for order in orders:
            if order.product is None or order.customer is None:
                continue
            results.append(
                SearchResultOrder(
                    id=order.id,
                    customer_name=order.customer.name,
                    customer_email=order.customer.email,
                    product_name=order.product.name,
                    amount=order.total_amount,
                )
            )

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

        for subscription in subscriptions:
            if subscription.product is None or subscription.customer is None:
                continue
            results.append(
                SearchResultSubscription(
                    id=subscription.id,
                    customer_name=subscription.customer.name,
                    customer_email=subscription.customer.email,
                    product_name=subscription.product.name,
                    status=subscription.status,
                    amount=subscription.amount,
                )
            )

        return results


search = SearchService()
