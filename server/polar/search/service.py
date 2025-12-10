import asyncio
import re
import uuid

import httpx
import structlog
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, User
from polar.config import settings
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
    SearchResultDocs,
    SearchResultOrder,
    SearchResultProduct,
    SearchResultSubscription,
    SearchResultType,
)


class SearchService:
    def _try_parse_uuid(self, query: str) -> uuid.UUID | None:
        try:
            return uuid.UUID(query.strip())
        except (ValueError, AttributeError):
            return None

    def _is_email(self, query: str) -> bool:
        return "@" in query and "." in query.split("@")[-1]

    def _strip_markdown(self, text: str) -> str:
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"!\[([^\]]*)\]\([^\)]+\)", "", text)
        text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
        text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text)
        text = re.sub(r"`{1,3}([^`]+)`{1,3}", r"\1", text)
        text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _generate_breadcrumbs(self, path: str) -> str:
        segments = path.strip("/").split("/")

        breadcrumbs = ["Docs"]

        for segment in segments:
            formatted = segment.replace("-", " ").title()
            breadcrumbs.append(formatted)

        return " > ".join(breadcrumbs)

    async def search(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        *,
        organization_id: uuid.UUID,
        query: str,
        limit: int = 5,
        exclude: list[SearchResultType] | None = None,
    ) -> list[SearchResult]:
        exclude = exclude or []
        exclude_set = set(exclude)

        prefix_term = f"{query}%"
        substring_term = f"%{query}%"
        query_uuid = self._try_parse_uuid(query)
        is_email = self._is_email(query)

        tasks: list = []

        if SearchResultType.product not in exclude_set:
            tasks.append(
                self._search_products(
                    session,
                    auth_subject,
                    organization_id,
                    substring_term,
                    query_uuid,
                    limit,
                )
            )
        else:
            tasks.append(asyncio.create_task(asyncio.sleep(0, result=[])))

        if SearchResultType.customer not in exclude_set:
            tasks.append(
                self._search_customers(
                    session, auth_subject, organization_id, prefix_term, query_uuid, limit
                )
            )
        else:
            tasks.append(asyncio.create_task(asyncio.sleep(0, result=[])))

        if SearchResultType.order not in exclude_set:
            tasks.append(
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
        else:
            tasks.append(asyncio.create_task(asyncio.sleep(0, result=[])))

        if SearchResultType.subscription not in exclude_set:
            tasks.append(
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
        else:
            tasks.append(asyncio.create_task(asyncio.sleep(0, result=[])))

        if (
            SearchResultType.docs not in exclude_set
            and query_uuid is None
            and not is_email
        ):
            tasks.append(self._search_docs(query, 8))
        else:
            tasks.append(asyncio.create_task(asyncio.sleep(0, result=[])))

        products, customers, orders, subscriptions, docs = await asyncio.gather(*tasks)

        # If docs are the only results, return up to 8. Otherwise, limit to 3.
        has_other_results = bool(products or customers or orders or subscriptions)
        if has_other_results and docs:
            docs = docs[:3]

        return [*products, *customers, *orders, *subscriptions, *docs]

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

    async def _search_docs(
        self,
        query: str,
        limit: int,
    ) -> list[SearchResultDocs]:
        if not settings.MINTLIFY_DOMAIN or not settings.MINTLIFY_API_KEY:
            return []

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api-dsc.mintlify.com/v1/search/{settings.MINTLIFY_DOMAIN}",
                    headers={
                        "Authorization": f"Bearer {settings.MINTLIFY_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "query": query,
                        "pageSize": limit,
                    },
                    timeout=5.0,
                )

                if response.status_code != 200:
                    return []

                data = response.json()

                return [
                    SearchResultDocs(
                        id=f"docs-{idx}",
                        title=result.get("metadata", {}).get("title")
                        or result["path"].split("/")[-1].replace("-", " ").title(),
                        content=self._strip_markdown(
                            result.get("metadata", {}).get("description")
                            or result.get("content", "")
                        )[:200],
                        path=result["path"],
                        url=f"https://polar.sh/docs{result['path']}"
                        if result["path"].startswith("/")
                        else f"https://polar.sh/docs/{result['path']}",
                        breadcrumbs=self._generate_breadcrumbs(result["path"]),
                    )
                    for idx, result in enumerate(data)
                ]

        except Exception as e:
            structlog.get_logger().error(
                "mintlify_search_error", error=str(e), error_type=type(e).__name__
            )
            return []


search = SearchService()
