import uuid
from collections.abc import Sequence
from typing import Any, List, Literal, TypeVar  # noqa: UP035

import stripe
from sqlalchemy import Select, UnaryExpression, and_, asc, case, desc, func, or_, select
from sqlalchemy.exc import InvalidRequestError
from sqlalchemy.orm import contains_eager, joinedload, selectinload

from polar.auth.models import (
    AuthSubject,
    Subject,
    is_organization,
    is_user,
)
from polar.authz.service import AccessType, Authz
from polar.benefit.service.benefit import benefit as benefit_service
from polar.exceptions import NotPermitted, PolarError, PolarRequestValidationError
from polar.file.service import file as file_service
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.sorting import Sorting
from polar.models import (
    Benefit,
    Organization,
    Product,
    ProductBenefit,
    ProductMedia,
    ProductPrice,
    User,
    UserOrganization,
)
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceType,
)
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.resolver import get_payload_organization
from polar.organization.service import organization as organization_service
from polar.webhook.service import webhook as webhook_service
from polar.webhook.webhooks import WebhookTypeObject
from polar.worker import enqueue_job

from ..schemas import (
    ExistingProductPrice,
    ProductCreate,
    ProductUpdate,
)
from ..sorting import ProductSortProperty


class ProductError(PolarError): ...


T = TypeVar("T", bound=tuple[Any])


class ProductService(ResourceService[Product, ProductCreate, ProductUpdate]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Subject],
        *,
        organization_id: Sequence[uuid.UUID],
        query: str | None = None,
        is_archived: bool | None = None,
        is_recurring: bool | None = None,
        benefit_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[ProductSortProperty]] = [
            (ProductSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Product], int]:
        statement = self._get_readable_product_statement(auth_subject).join(
            ProductPrice,
            onclause=(
                ProductPrice.id
                == select(ProductPrice)
                .correlate(Product)
                .with_only_columns(ProductPrice.id)
                .where(
                    ProductPrice.product_id == Product.id,
                    ProductPrice.is_archived.is_(False),
                    ProductPrice.deleted_at.is_(None),
                )
                .order_by(ProductPrice.created_at.asc())
                .limit(1)
                .scalar_subquery()
            ),
            isouter=True,
        )

        statement = statement.where(Product.organization_id.in_(organization_id))

        if query is not None:
            statement = statement.where(Product.name.ilike(f"%{query}%"))

        if is_archived is not None:
            statement = statement.where(Product.is_archived.is_(is_archived))

        if is_recurring is not None:
            statement = statement.where(Product.is_recurring.is_(is_recurring))

        if benefit_id is not None:
            statement = (
                statement.join(Product.product_benefits)
                .where(ProductBenefit.benefit_id.in_(benefit_id))
                .options(contains_eager(Product.product_benefits))
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == ProductSortProperty.created_at:
                order_by_clauses.append(clause_function(Product.created_at))
            elif criterion == ProductSortProperty.product_name:
                order_by_clauses.append(clause_function(Product.name))
            elif criterion == ProductSortProperty.price_type:
                order_by_clauses.append(
                    clause_function(
                        case(
                            (ProductPrice.type == ProductPriceType.one_time, 1),
                            (ProductPrice.type == ProductPriceType.recurring, 2),
                        )
                    )
                )
            elif criterion == ProductSortProperty.price_amount_type:
                order_by_clauses.append(
                    clause_function(
                        case(
                            (
                                ProductPrice.amount_type == ProductPriceAmountType.free,
                                1,
                            ),
                            (
                                ProductPrice.amount_type
                                == ProductPriceAmountType.custom,
                                2,
                            ),
                            (
                                ProductPrice.amount_type
                                == ProductPriceAmountType.fixed,
                                3,
                            ),
                        )
                    )
                )
            elif criterion == ProductSortProperty.price_amount:
                order_by_clauses.append(
                    clause_function(
                        case(
                            (
                                ProductPrice.amount_type == ProductPriceAmountType.free,
                                -2,
                            ),
                            (
                                ProductPrice.amount_type
                                == ProductPriceAmountType.custom,
                                func.coalesce(ProductPriceCustom.minimum_amount, -1),
                            ),
                            (
                                ProductPrice.amount_type
                                == ProductPriceAmountType.fixed,
                                ProductPriceFixed.price_amount,
                            ),
                        )
                    )
                )
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(
            selectinload(Product.product_medias),
        )

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self, session: AsyncSession, auth_subject: AuthSubject[Subject], id: uuid.UUID
    ) -> Product | None:
        statement = (
            self._get_readable_product_statement(auth_subject)
            .where(Product.id == id, Product.deleted_at.is_(None))
            .options(
                contains_eager(Product.organization),
                selectinload(Product.product_medias),
            )
            .limit(1)
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_loaded(
        self, session: AsyncSession, id: uuid.UUID, allow_deleted: bool = False
    ) -> Product | None:
        statement = (
            select(Product)
            .where(Product.id == id)
            .options(
                joinedload(Product.organization), selectinload(Product.product_medias)
            )
            .limit(1)
        )

        if not allow_deleted:
            statement = statement.where(Product.deleted_at.is_(None))

        result = await session.execute(statement)

        return result.scalar_one_or_none()

    async def get_free(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
    ) -> Product | None:
        return None

    async def user_create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: ProductCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Product:
        subject = auth_subject.subject

        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )
        if not await authz.can(subject, AccessType.write, organization):
            raise NotPermitted()

        product = Product(
            organization=organization,
            prices=[],
            product_benefits=[],
            product_medias=[],
            **create_schema.model_dump(exclude={"organization_id", "prices", "medias"}),
        )
        session.add(product)
        await session.flush()
        assert product.id is not None

        if create_schema.medias is not None:
            for order, file_id in enumerate(create_schema.medias):
                file = await file_service.get_selectable_product_media_file(
                    session, file_id, organization_id=product.organization_id
                )
                if file is None:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "medias", order),
                                "msg": "File does not exist or is not yet uploaded.",
                                "input": file_id,
                            }
                        ]
                    )
                product.product_medias.append(ProductMedia(file=file, order=order))

        metadata: dict[str, str] = {"product_id": str(product.id)}
        metadata["organization_id"] = str(organization.id)
        metadata["organization_name"] = organization.slug

        stripe_product = await stripe_service.create_product(
            product.get_stripe_name(),
            description=product.description,
            metadata=metadata,
        )
        product.stripe_product_id = stripe_product.id

        for price_create in create_schema.prices:
            stripe_price = await stripe_service.create_price_for_product(
                stripe_product.id, price_create.get_stripe_price_params()
            )
            model_class = price_create.get_model_class()
            price = model_class(
                **price_create.model_dump(),
                stripe_price_id=stripe_price.id,
                product=product,
            )
            session.add(price)

        await session.flush()
        await session.refresh(product, {"prices"})

        await self._after_product_created(session, auth_subject, product)

        return product

    async def user_update(
        self,
        session: AsyncSession,
        authz: Authz,
        product: Product,
        update_schema: ProductUpdate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Product:
        product = await self.with_organization(session, product)
        subject = auth_subject.subject

        if not await authz.can(subject, AccessType.write, product):
            raise NotPermitted()

        if update_schema.prices is not None and len(update_schema.prices) < 1:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "too_short",
                        "loc": (
                            "body",
                            "prices",
                        ),
                        "msg": "At least one price is required.",
                        "input": update_schema.prices,
                    }
                ]
            )

        if update_schema.medias is not None:
            nested = await session.begin_nested()
            product.medias = []
            await session.flush()

            for order, file_id in enumerate(update_schema.medias):
                file = await file_service.get_selectable_product_media_file(
                    session, file_id, organization_id=product.organization_id
                )
                if file is None:
                    await nested.rollback()
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "medias", order),
                                "msg": "File does not exist or is not yet uploaded.",
                                "input": file_id,
                            }
                        ]
                    )
                product.product_medias.append(ProductMedia(file=file, order=order))

        if product.is_archived and update_schema.is_archived is False:
            product = await self._unarchive(product)

        product_update: stripe.Product.ModifyParams = {}
        if update_schema.name is not None and update_schema.name != product.name:
            product.name = update_schema.name
            product_update["name"] = product.get_stripe_name()
        if (
            update_schema.description is not None
            and update_schema.description != product.description
        ):
            product.description = update_schema.description
            product_update["description"] = update_schema.description

        if product_update and product.stripe_product_id is not None:
            await stripe_service.update_product(
                product.stripe_product_id, **product_update
            )

        existing_prices: set[ProductPrice] = set()
        added_prices: list[ProductPrice] = []
        if update_schema.prices is not None:
            for price_update in update_schema.prices:
                if isinstance(price_update, ExistingProductPrice):
                    existing_price = product.get_price(price_update.id)
                    if existing_price is not None:
                        existing_prices.add(existing_price)
                    continue

                assert product.stripe_product_id is not None
                stripe_price = await stripe_service.create_price_for_product(
                    product.stripe_product_id, price_update.get_stripe_price_params()
                )
                model_class = price_update.get_model_class()
                price = model_class(
                    **price_update.model_dump(),
                    stripe_price_id=stripe_price.id,
                    product=product,
                )
                session.add(price)
                added_prices.append(price)

            deleted_prices = set(product.prices) - existing_prices
            updated_prices = list(existing_prices) + added_prices
            if deleted_prices:
                # Make sure to set Stripe's default price to a non-archived price
                assert product.stripe_product_id is not None
                await stripe_service.update_product(
                    product.stripe_product_id,
                    default_price=updated_prices[0].stripe_price_id,
                )
                for deleted_price in deleted_prices:
                    await stripe_service.archive_price(deleted_price.stripe_price_id)
                    deleted_price.is_archived = True
                    session.add(deleted_price)

        if update_schema.is_archived:
            product = await self._archive(product)

        for attr, value in update_schema.model_dump(
            exclude_unset=True, exclude_none=True, exclude={"prices", "medias"}
        ).items():
            setattr(product, attr, value)

        session.add(product)
        await session.flush()
        await session.refresh(product, {"prices"})

        await self._after_product_updated(session, product)

        return product

    async def update_benefits(
        self,
        session: AsyncSession,
        authz: Authz,
        product: Product,
        benefits: List[uuid.UUID],  # noqa: UP006
        auth_subject: AuthSubject[User | Organization],
    ) -> tuple[Product, set[Benefit], set[Benefit]]:
        product = await self.with_organization(session, product)

        subject = auth_subject.subject
        if not await authz.can(subject, AccessType.write, product):
            raise NotPermitted()

        previous_benefits = set(product.benefits)
        new_benefits: set[Benefit] = set()

        nested = await session.begin_nested()

        product.product_benefits = []
        await session.flush()

        for order, benefit_id in enumerate(benefits):
            benefit = await benefit_service.get_by_id(session, auth_subject, benefit_id)
            if benefit is None:
                await nested.rollback()
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "benefits", order),
                            "msg": "Benefit does not exist.",
                            "input": benefit_id,
                        }
                    ]
                )
            if not benefit.selectable and benefit not in previous_benefits:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "benefits", order),
                            "msg": "Benefit is not selectable.",
                            "input": benefit_id,
                        }
                    ]
                )
            new_benefits.add(benefit)
            product.product_benefits.append(
                ProductBenefit(benefit=benefit, order=order)
            )

        added_benefits = new_benefits - previous_benefits
        deleted_benefits = previous_benefits - new_benefits

        for deleted_benefit in deleted_benefits:
            if not deleted_benefit.selectable:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": (
                                "body",
                                "benefits",
                            ),
                            "msg": "Benefit is not selectable.",
                            "input": deleted_benefit.id,
                        }
                    ]
                )

        session.add(product)

        enqueue_job(
            "subscription.subscription.update_product_benefits_grants", product.id
        )
        enqueue_job("order.update_product_benefits_grants", product.id)

        await self._after_product_updated(session, product)

        return product, added_benefits, deleted_benefits

    async def with_organization(
        self, session: AsyncSession, product: Product
    ) -> Product:
        try:
            product.organization
        except InvalidRequestError:
            await session.refresh(product, {"organization"})
        return product

    async def _archive(self, product: Product) -> Product:
        if product.stripe_product_id is not None:
            await stripe_service.archive_product(product.stripe_product_id)

        product.is_archived = True

        return product

    async def _unarchive(self, product: Product) -> Product:
        if product.stripe_product_id is not None:
            await stripe_service.unarchive_product(product.stripe_product_id)

        product.is_archived = False

        return product

    def _get_readable_product_statement(
        self, auth_subject: AuthSubject[Subject]
    ) -> Select[tuple[Product]]:
        statement = (
            select(Product)
            .join(Product.organization)
            .where(
                # Prevent to return `None` objects due to the full outer join
                Product.id.is_not(None),
                Product.deleted_at.is_(None),
            )
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            # Direct product's organization member
            statement = statement.join(
                UserOrganization,
                onclause=and_(
                    UserOrganization.organization_id == Product.organization_id,
                    UserOrganization.user_id == user.id,
                    UserOrganization.deleted_at.is_(None),
                ),
                full=True,
            ).where(
                # Can see archived products if they are a member of the products's org
                or_(
                    Product.is_archived.is_(False),
                    UserOrganization.user_id == user.id,
                ),
            )
        # Organization
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id
            )
        # Anonymous
        else:
            statement = statement.where(
                Product.is_archived.is_(False),
            )

        return statement

    async def _after_product_created(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
    ) -> None:
        await self._send_webhook(session, product, WebhookEventType.product_created)
        if is_user(auth_subject):
            user = auth_subject.subject
            await loops_service.user_created_product(user)

    async def _after_product_updated(
        self, session: AsyncSession, product: Product
    ) -> None:
        await self._send_webhook(session, product, WebhookEventType.product_updated)

    async def _send_webhook(
        self,
        session: AsyncSession,
        product: Product,
        event_type: Literal[WebhookEventType.product_created]
        | Literal[WebhookEventType.product_updated],
    ) -> None:
        # load full tier with relations
        full_product = await self.get_loaded(session, product.id, allow_deleted=True)
        assert full_product

        # mypy 1.9 is does not allow us to do
        #    event = (event_type, subscription)
        # directly, even if it could have...
        event: WebhookTypeObject | None = None
        match event_type:
            case WebhookEventType.product_created:
                event = (event_type, full_product)
            case WebhookEventType.product_updated:
                event = (event_type, full_product)

        if managing_org := await organization_service.get(
            session, product.organization_id
        ):
            await webhook_service.send(session, target=managing_org, we=event)


product = ProductService(Product)
