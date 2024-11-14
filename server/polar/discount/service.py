import contextlib
import uuid
from collections.abc import AsyncIterator, Sequence
from typing import Any

from sqlalchemy import Select, UnaryExpression, asc, desc, func, select

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Discount, Organization, User, UserOrganization
from polar.models.discount_redemption import DiscountRedemption
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

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
                Discount.name.ilike(f"%{query}%"),
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == DiscountSortProperty.created_at:
                order_by_clauses.append(clause_function(Discount.created_at))
            elif criterion == DiscountSortProperty.discount_name:
                order_by_clauses.append(clause_function(Discount.name))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Discount | None:
        statement = self._get_readable_discount_statement(auth_subject).where(
            Discount.id == id
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

        discount_model = discount_create.type.get_model()
        discount_id = uuid.uuid4()
        discount = discount_model(
            **discount_create.model_dump(exclude={"organization_id"}),
            id=discount_id,
            organization=organization,
        )
        stripe_coupon = await stripe_service.create_coupon(
            **discount.get_stripe_coupon_params()
        )
        discount.stripe_coupon_id = stripe_coupon.id

        session.add(discount)

        return discount

    async def update(
        self, session: AsyncSession, discount: Discount, discount_update: DiscountUpdate
    ) -> Discount:
        previous_name = discount.name

        for attr, value in discount_update.model_dump(exclude_unset=True).items():
            setattr(discount, attr, value)

        if previous_name != discount.name:
            await stripe_service.update_coupon(
                discount.stripe_coupon_id, name=discount.name
            )

        session.add(discount)
        return discount

    async def delete(self, session: AsyncSession, discount: Discount) -> Discount:
        discount.set_deleted_at()

        await stripe_service.delete_coupon(discount.stripe_coupon_id)

        session.add(discount)
        return discount

    async def get_by_id_and_organization(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        organization: Organization,
        *,
        redeemable: bool = True,
    ) -> Discount | None:
        statement = select(Discount).where(
            Discount.id == id,
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

    async def get_by_code_and_organization(
        self,
        session: AsyncSession,
        code: str,
        organization: Organization,
        *,
        redeemable: bool = True,
    ) -> Discount | None:
        statement = select(Discount).where(
            Discount.code == code,
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
        async with locker.lock(
            f"discount:{discount.id}", timeout=5, blocking_timeout=5
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
