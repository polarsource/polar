import uuid
from collections.abc import Sequence
from typing import Any, cast

import structlog
from sqlalchemy import Select, UnaryExpression, asc, desc, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.discount.service import discount as discount_service
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.crypto import generate_token
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.logging import Logger
from polar.models import (
    CheckoutLink,
    Discount,
    Organization,
    Product,
    ProductPrice,
    User,
    UserOrganization,
)
from polar.postgres import AsyncSession
from polar.product.service.product import product as product_service
from polar.product.service.product_price import product_price as product_price_service

from .schemas import (
    CheckoutLinkCreate,
    CheckoutLinkPriceCreate,
    CheckoutLinkUpdate,
)
from .sorting import CheckoutLinkSortProperty

log: Logger = structlog.get_logger()


class CheckoutLinkError(PolarError): ...


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
            (CheckoutLinkSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[CheckoutLink], int]:
        statement = self._get_readable_checkout_link_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Product.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Product.id.in_(product_id))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CheckoutLinkSortProperty.created_at:
                order_by_clauses.append(clause_function(CheckoutLink.created_at))
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(joinedload(CheckoutLink.discount))

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> CheckoutLink | None:
        statement = (
            self._get_readable_checkout_link_statement(auth_subject)
            .where(CheckoutLink.id == id)
            .options(joinedload(CheckoutLink.discount))
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def create(
        self,
        session: AsyncSession,
        checkout_link_create: CheckoutLinkCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> CheckoutLink:
        price: ProductPrice | None = None
        if isinstance(checkout_link_create, CheckoutLinkPriceCreate):
            product, price = await self._get_validated_price(
                session,
                checkout_link_create.product_price_id,
                auth_subject,
            )
        else:
            product, price = await self._get_validated_product(
                session,
                checkout_link_create.product_id,
                auth_subject,
            )

        discount: Discount | None = None
        if checkout_link_create.discount_id is not None:
            discount = await self._get_validated_discount(
                session, checkout_link_create.discount_id, product
            )

        checkout_link = CheckoutLink(
            client_secret=generate_token(prefix=CHECKOUT_LINK_CLIENT_SECRET_PREFIX),
            product=product,
            product_price=price,
            discount=discount,
            **checkout_link_create.model_dump(
                exclude={"product_price_id", "product_id", "discount_id"},
                by_alias=True,
            ),
        )

        session.add(checkout_link)
        return checkout_link

    async def update(
        self,
        session: AsyncSession,
        checkout_link: CheckoutLink,
        checkout_link_update: CheckoutLinkUpdate,
        auth_subject: AuthSubject[User | Organization],
    ) -> CheckoutLink:
        if "product_price_id" in checkout_link_update.model_fields_set:
            if checkout_link_update.product_price_id is None:
                checkout_link.product_price = None
            else:
                product, price = await self._get_validated_price(
                    session, checkout_link_update.product_price_id, auth_subject
                )
                if product.id != checkout_link.product_id:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "product_price_id"),
                                "msg": "Price does not belong to the same product.",
                                "input": checkout_link_update.product_price_id,
                            }
                        ]
                    )
                checkout_link.product_price = price

        if "discount_id" in checkout_link_update.model_fields_set:
            if checkout_link_update.discount_id is None:
                checkout_link.discount = None
            else:
                discount = await self._get_validated_discount(
                    session, checkout_link_update.discount_id, checkout_link.product
                )
                checkout_link.discount = discount

        for attr, value in checkout_link_update.model_dump(
            exclude_unset=True,
            exclude={"product_price_id", "discount_id"},
            by_alias=True,
        ).items():
            setattr(checkout_link, attr, value)

        session.add(checkout_link)
        return checkout_link

    async def delete(
        self, session: AsyncSession, checkout_link: CheckoutLink
    ) -> CheckoutLink:
        checkout_link.set_deleted_at()
        session.add(checkout_link)
        return checkout_link

    async def get_by_client_secret(
        self, session: AsyncSession, client_secret: str
    ) -> CheckoutLink | None:
        statement = select(CheckoutLink).where(
            CheckoutLink.deleted_at.is_(None),
            CheckoutLink.client_secret == client_secret,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def _get_validated_product(
        self,
        session: AsyncSession,
        product_id: uuid.UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> tuple[Product, None]:
        product = await product_service.get_by_id(session, auth_subject, product_id)
        if not product:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product does not exist.",
                        "input": product_id,
                    }
                ]
            )

        if product.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product is archived.",
                        "input": product_id,
                    }
                ]
            )

        return (product, None)

    async def _get_validated_price(
        self,
        session: AsyncSession,
        price_id: uuid.UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> tuple[Product, ProductPrice]:
        price = await product_price_service.get_writable_by_id(
            session, price_id, auth_subject
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

        product = cast(Product, await product_service.get_loaded(session, product.id))
        return (product, price)

    async def _get_validated_discount(
        self, session: AsyncSession, discount_id: uuid.UUID, product: Product
    ) -> Discount:
        discount = await discount_service.get_by_id_and_product(
            session, discount_id, product, redeemable=False
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

    def _get_readable_checkout_link_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CheckoutLink]]:
        statement = (
            select(CheckoutLink)
            .where(CheckoutLink.deleted_at.is_(None))
            .join(Product, onclause=Product.id == CheckoutLink.product_id)
            .options(
                contains_eager(CheckoutLink.product).options(
                    joinedload(Product.product_medias),
                    joinedload(Product.attached_custom_fields),
                )
            )
        )

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


checkout_link = CheckoutLinkService(CheckoutLink)
