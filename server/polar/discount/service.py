import contextlib
import uuid
from collections.abc import AsyncIterator, Sequence
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, func, or_, select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import (
    Discount,
    DiscountProduct,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.models.discount_redemption import DiscountRedemption
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession
from polar.product.service.product import product as product_service

from .schemas import DiscountCreate, DiscountUpdate
from .sorting import DiscountSortProperty


class DiscountError(PolarError): ...


class DiscountNotRedeemableError(DiscountError):
    def __init__(self, discount: Discount):
        super().__init__(f"Discount {discount.id} is not redeemable.")


class DiscountService(ResourceServiceReader[Discount]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[DiscountSortProperty]] = [
            (DiscountSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Discount], int]:
        statement = self._get_readable_discount_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Discount.organization_id.in_(organization_id))

        if query is not None:
            statement = statement.where(
                or_(
                    Discount.name.like(f"%{query}%"),
                    Discount.code.ilike(f"%{query}%"),
                )
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == DiscountSortProperty.created_at:
                order_by_clauses.append(clause_function(Discount.created_at))
            elif criterion == DiscountSortProperty.discount_name:
                order_by_clauses.append(clause_function(Discount.name))
            elif criterion == DiscountSortProperty.code:
                order_by_clauses.append(clause_function(Discount.code))
            elif criterion == DiscountSortProperty.redemptions_count:
                order_by_clauses.append(clause_function(Discount.redemptions_count))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Discount | None:
        statement = (
            self._get_readable_discount_statement(auth_subject)
            .where(Discount.id == id)
            .options(joinedload(Discount.organization))
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def create(
        self,
        session: AsyncSession,
        authz: Authz,
        discount_create: DiscountCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Discount:
        subject = auth_subject.subject

        organization = await get_payload_organization(
            session, auth_subject, discount_create
        )
        if not await authz.can(subject, AccessType.write, organization):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "organization_id"),
                        "msg": "Organization not found.",
                        "input": discount_create.organization_id,
                    }
                ]
            )

        if discount_create.code is not None:
            existing_discount = await self.get_by_code_and_organization(
                session, discount_create.code, organization, redeemable=False
            )
            if existing_discount is not None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "code"),
                            "msg": "Discount with this code already exists.",
                            "input": discount_create.code,
                        }
                    ]
                )

        discount_products: list[DiscountProduct] = []
        if discount_create.products:
            for index, product_id in enumerate(discount_create.products):
                product = await product_service.get_by_id_and_organization(
                    session, product_id, organization
                )
                if product is None:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "products", index),
                                "msg": "Product not found.",
                                "input": product_id,
                            }
                        ]
                    )
                discount_products.append(DiscountProduct(product=product))

        discount_model = discount_create.type.get_model()
        discount_id = uuid.uuid4()
        discount = discount_model(
            **discount_create.model_dump(exclude={"organization_id", "products"}),
            id=discount_id,
            organization=organization,
            discount_products=discount_products,
            discount_redemptions=[],
            redemptions_count=0,
        )
        stripe_coupon = await stripe_service.create_coupon(
            **discount.get_stripe_coupon_params()
        )
        discount.stripe_coupon_id = stripe_coupon.id

        session.add(discount)

        return discount

    async def update(
        self,
        session: AsyncSession,
        discount: Discount,
        discount_update: DiscountUpdate,
    ) -> Discount:
        if (
            discount_update.duration is not None
            and discount_update.duration != discount.duration
        ):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "duration"),
                        "msg": "Duration cannot be changed.",
                        "input": discount_update.duration,
                    }
                ]
            )

        if discount_update.type is not None and discount_update.type != discount.type:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "type"),
                        "msg": "Type cannot be changed.",
                        "input": discount_update.type,
                    }
                ]
            )

        if discount.redemptions_count > 0:
            forbidden_fields = {"amount", "currency", "basis_points"}
            for field in forbidden_fields:
                discount_update_value = getattr(discount_update, field, None)
                if (
                    discount_update_value is not None
                    and discount_update_value != getattr(discount, field, None)
                ):
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", field),
                                "msg": (
                                    "This field cannot be changed because "
                                    "the discount has already been redeemed."
                                ),
                                "input": getattr(discount, field),
                            }
                        ]
                    )

        if discount_update.products is not None:
            nested = await session.begin_nested()
            discount.discount_products = []
            await session.flush()

            for index, product_id in enumerate(discount_update.products):
                product = await product_service.get_by_id_and_organization(
                    session, product_id, discount.organization
                )
                if product is None:
                    await nested.rollback()
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "products", index),
                                "msg": "Product not found.",
                                "input": product_id,
                            }
                        ]
                    )
                discount.discount_products.append(DiscountProduct(product=product))

        updated_fields = set()
        for attr, value in discount_update.model_dump(
            exclude_unset=True, exclude={"products"}
        ).items():
            if value != getattr(discount, attr):
                setattr(discount, attr, value)
                updated_fields.add(attr)

        sensitive_fields = {
            "starts_at",
            "ends_at",
            "max_redemptions",
            "amount",
            "currency",
            "basis_points",
            "duration_in_months",
        }
        if sensitive_fields.intersection(updated_fields):
            if discount.ends_at is not None and discount.ends_at < utc_now():
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "ends_at"),
                            "msg": "Ends at must be in the future.",
                            "input": discount.ends_at,
                        }
                    ]
                )
            new_stripe_coupon = await stripe_service.create_coupon(
                **discount.get_stripe_coupon_params()
            )
            await stripe_service.delete_coupon(discount.stripe_coupon_id)
            discount.stripe_coupon_id = new_stripe_coupon.id
        elif "name" in updated_fields:
            await stripe_service.update_coupon(
                discount.stripe_coupon_id, name=discount.name
            )

        session.add(discount)
        await session.flush()
        await session.refresh(discount)

        return discount

    async def delete(self, session: AsyncSession, discount: Discount) -> Discount:
        discount.set_deleted_at()

        await stripe_service.delete_coupon(discount.stripe_coupon_id)

        session.add(discount)
        return discount

    async def get_by_id_and_product(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        product: Product,
        *,
        redeemable: bool = True,
    ) -> Discount | None:
        statement = select(Discount).where(
            Discount.id == id,
            Discount.organization_id == product.organization_id,
            Discount.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        discount = result.scalar_one_or_none()

        if discount is None:
            return None

        if len(discount.products) > 0 and product not in discount.products:
            return None

        if redeemable and not await self.is_redeemable_discount(session, discount):
            return None

        return discount

    async def get_by_code_and_organization(
        self,
        session: AsyncSession,
        code: str,
        organization: Organization,
        *,
        redeemable: bool = True,
    ) -> Discount | None:
        statement = select(Discount).where(
            func.upper(Discount.code) == code.upper(),
            Discount.organization_id == organization.id,
            Discount.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        discount = result.scalar_one_or_none()

        if discount is None:
            return None

        if redeemable and not await self.is_redeemable_discount(session, discount):
            return None

        return discount

    async def get_by_code_and_product(
        self,
        session: AsyncSession,
        code: str,
        product: Product,
        *,
        redeemable: bool = True,
    ) -> Discount | None:
        discount = await self.get_by_code_and_organization(
            session, code, product.organization, redeemable=redeemable
        )

        if discount is None:
            return None

        if len(discount.products) > 0 and product not in discount.products:
            return None

        return discount

    async def get_by_stripe_coupon_id(
        self, session: AsyncSession, stripe_coupon_id: str
    ) -> Discount | None:
        statement = select(Discount).where(
            Discount.stripe_coupon_id == stripe_coupon_id
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def is_redeemable_discount(
        self, session: AsyncSession, discount: Discount
    ) -> bool:
        if discount.starts_at is not None and discount.starts_at > utc_now():
            return False

        if discount.ends_at is not None and discount.ends_at < utc_now():
            return False

        if discount.max_redemptions is not None:
            statement = select(func.count(DiscountRedemption.id)).where(
                DiscountRedemption.discount_id == discount.id
            )
            result = await session.execute(statement)
            redemptions_count = result.scalar_one()
            return redemptions_count < discount.max_redemptions

        return True

    @contextlib.asynccontextmanager
    async def redeem_discount(
        self, session: AsyncSession, locker: Locker, discount: Discount
    ) -> AsyncIterator[DiscountRedemption]:
        # The timeout is purposely set to 10 seconds, a high value.
        # We've seen in the past Stripe payment requests taking more than 5 seconds,
        # causing the lock to expire while waiting for the payment to complete.
        async with locker.lock(
            f"discount:{discount.id}", timeout=10, blocking_timeout=10
        ):
            if not await self.is_redeemable_discount(session, discount):
                raise DiscountNotRedeemableError(discount)

            discount_redemption = DiscountRedemption(discount=discount)

            yield discount_redemption

            session.add(discount_redemption)
            await session.flush()

    def _get_readable_discount_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Discount]]:
        statement = select(Discount).where(Discount.deleted_at.is_(None))

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Discount.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Discount.organization_id == auth_subject.subject.id,
            )

        return statement


discount = DiscountService(Discount)
