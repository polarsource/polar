import uuid
from collections.abc import Sequence
from typing import Any, cast

from sqlalchemy import UnaryExpression, asc, desc
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.discount.service import discount as discount_service
from polar.exceptions import PolarRequestValidationError, ValidationError
from polar.kit.crypto import generate_token
from polar.kit.pagination import PaginationParams
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import (
    CheckoutLink,
    CheckoutLinkProduct,
    Discount,
    Organization,
    Product,
    ProductPrice,
    User,
)
from polar.postgres import AsyncSession
from polar.product.repository import ProductPriceRepository, ProductRepository
from polar.product.service import product as product_service

from .schemas import (
    CheckoutLinkCreate,
    CheckoutLinkCreateProduct,
    CheckoutLinkCreateProductPrice,
    CheckoutLinkCreateProducts,
    CheckoutLinkUpdate,
)
from .sorting import CheckoutLinkSortProperty

CHECKOUT_LINK_CLIENT_SECRET_PREFIX = "polar_cl_"


class CheckoutLinkService(ResourceServiceReader[CheckoutLink]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CheckoutLinkSortProperty]] = [
            (CheckoutLinkSortProperty.created_at, False)
        ],
    ) -> tuple[Sequence[CheckoutLink], int]:
        repository = CheckoutLinkRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)
        checkout_link_product_load = None

        if organization_id is not None:
            statement = statement.where(
                CheckoutLink.organization_id.in_(organization_id)
            )

        if product_id is not None:
            statement = statement.join(
                CheckoutLinkProduct,
                onclause=CheckoutLinkProduct.checkout_link_id == CheckoutLink.id,
            ).where(CheckoutLinkProduct.product_id.in_(product_id))
            checkout_link_product_load = contains_eager(
                CheckoutLink.checkout_link_products
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CheckoutLinkSortProperty.created_at:
                order_by_clauses.append(clause_function(CheckoutLink.created_at))
            elif criterion == CheckoutLinkSortProperty.label:
                order_by_clauses.append(clause_function(CheckoutLink.label))
            elif criterion == CheckoutLinkSortProperty.success_url:
                order_by_clauses.append(clause_function(CheckoutLink._success_url))
            elif criterion == CheckoutLinkSortProperty.allow_discount_codes:
                order_by_clauses.append(
                    clause_function(CheckoutLink.allow_discount_codes)
                )
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(
            *repository.get_eager_options(
                checkout_link_product_load=checkout_link_product_load
            )
        )

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> CheckoutLink | None:
        repository = CheckoutLinkRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(CheckoutLink.id == id)
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        checkout_link_create: CheckoutLinkCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> CheckoutLink:
        if isinstance(checkout_link_create, CheckoutLinkCreateProducts):
            products = await self._get_validated_products(
                session, checkout_link_create.products, auth_subject
            )
        elif isinstance(checkout_link_create, CheckoutLinkCreateProduct):
            products = await self._get_validated_products(
                session, [checkout_link_create.product_id], auth_subject
            )
        elif isinstance(checkout_link_create, CheckoutLinkCreateProductPrice):
            product, _ = await self._get_validated_price(
                session, checkout_link_create.product_price_id, auth_subject
            )
            products = [product]
        organization = products[0].organization

        discount: Discount | None = None
        if checkout_link_create.discount_id is not None:
            discount = await self._get_validated_discount(
                session, checkout_link_create.discount_id, organization, products
            )

        checkout_link = CheckoutLink(
            client_secret=generate_token(prefix=CHECKOUT_LINK_CLIENT_SECRET_PREFIX),
            organization=organization,
            discount=discount,
            checkout_link_products=[
                CheckoutLinkProduct(product=product, order=i)
                for i, product in enumerate(products)
            ],
            **checkout_link_create.model_dump(
                exclude={
                    "products",
                    "product_id",
                    "product_price_id",
                    "discount_id",
                },
                by_alias=True,
            ),
        )

        repository = CheckoutLinkRepository.from_session(session)
        return await repository.create(checkout_link)

    async def update(
        self,
        session: AsyncSession,
        checkout_link: CheckoutLink,
        checkout_link_update: CheckoutLinkUpdate,
        auth_subject: AuthSubject[User | Organization],
    ) -> CheckoutLink:
        if checkout_link_update.products is not None:
            products = await self._get_validated_products(
                session, checkout_link_update.products, auth_subject
            )
            if checkout_link.organization_id != products[0].organization_id:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "products"),
                            "msg": (
                                "Products don't belong to "
                                "the checkout link's organization."
                            ),
                            "input": checkout_link_update.products,
                        }
                    ]
                )
            checkout_link.checkout_link_products = []
            await session.flush()
            checkout_link.checkout_link_products = [
                CheckoutLinkProduct(product=product, order=i)
                for i, product in enumerate(products)
            ]

        if "discount_id" in checkout_link_update.model_fields_set:
            if checkout_link_update.discount_id is None:
                checkout_link.discount = None
            else:
                discount = await self._get_validated_discount(
                    session,
                    checkout_link_update.discount_id,
                    checkout_link.organization,
                    checkout_link.products,
                )
                checkout_link.discount = discount

        repository = CheckoutLinkRepository.from_session(session)
        return await repository.update(
            checkout_link,
            update_dict=checkout_link_update.model_dump(
                exclude_unset=True,
                exclude={"products", "discount_id"},
                by_alias=True,
            ),
        )

    async def delete(
        self, session: AsyncSession, checkout_link: CheckoutLink
    ) -> CheckoutLink:
        repository = CheckoutLinkRepository.from_session(session)
        return await repository.soft_delete(checkout_link)

    async def _get_validated_products(
        self,
        session: AsyncSession,
        product_ids: Sequence[uuid.UUID],
        auth_subject: AuthSubject[User | Organization],
    ) -> Sequence[Product]:
        products: list[Product] = []
        errors: list[ValidationError] = []

        for index, product_id in enumerate(product_ids):
            product = await product_service.get(session, auth_subject, product_id)

            if product is None:
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "products", index),
                        "msg": "Product does not exist.",
                        "input": product_id,
                    }
                )
                continue

            if product.is_archived:
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "products", index),
                        "msg": "Product is archived.",
                        "input": product_id,
                    }
                )
                continue

            products.append(product)

        organization_ids = {product.organization_id for product in products}
        if len(organization_ids) > 1:
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "products"),
                    "msg": "Products must all belong to the same organization.",
                    "input": products,
                }
            )

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        return products

    async def _get_validated_price(
        self,
        session: AsyncSession,
        price_id: uuid.UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> tuple[Product, ProductPrice]:
        product_price_repository = ProductPriceRepository.from_session(session)
        price = await product_price_repository.get_readable_by_id(
            price_id, auth_subject
        )

        if price is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Price does not exist.",
                        "input": price_id,
                    }
                ]
            )

        if price.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Price is archived.",
                        "input": price_id,
                    }
                ]
            )

        product = price.product
        if product.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Product is archived.",
                        "input": price_id,
                    }
                ]
            )

        product_repository = ProductRepository.from_session(session)
        product = cast(
            Product,
            await product_repository.get_by_id(
                product.id, options=product_repository.get_eager_options()
            ),
        )
        return (product, price)

    async def _get_validated_discount(
        self,
        session: AsyncSession,
        discount_id: uuid.UUID,
        organization: Organization,
        products: Sequence[Product],
    ) -> Discount:
        discount = await discount_service.get_by_id_and_organization(
            session,
            discount_id,
            organization,
            products=products,
            redeemable=False,
        )

        if discount is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "discount_id"),
                        "msg": (
                            "Discount does not exist or "
                            "is not applicable to this product."
                        ),
                        "input": discount_id,
                    }
                ]
            )

        return discount


checkout_link = CheckoutLinkService(CheckoutLink)
