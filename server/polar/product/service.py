import builtins
import uuid
from collections.abc import Sequence
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import contains_eager, selectinload

from polar.auth.models import AuthSubject, is_user
from polar.benefit.service import benefit as benefit_service
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.custom_field.service import custom_field as custom_field_service
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import (
    PolarRequestValidationError,
    ValidationError,
)
from polar.file.service import file as file_service
from polar.integrations.loops.service import loops as loops_service
from polar.kit.db.postgres import AsyncReadSession, AsyncSession
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.meter.repository import MeterRepository
from polar.models import (
    Benefit,
    Organization,
    Product,
    ProductBenefit,
    ProductMedia,
    ProductPrice,
    User,
)
from polar.models.product_custom_field import ProductCustomField
from polar.models.product_price import ProductPriceSource
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.repository import OrganizationRepository
from polar.organization.resolver import get_payload_organization
from polar.product.guard import is_legacy_price, is_metered_price, is_static_price
from polar.product.repository import ProductRepository
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .schemas import (
    ExistingProductPrice,
    ProductCreate,
    ProductPriceCreate,
    ProductPriceMeteredCreateBase,
    ProductUpdate,
)
from .sorting import ProductSortProperty


class ProductService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        id: Sequence[uuid.UUID] | None = None,
        organization_id: Sequence[uuid.UUID] | None = None,
        query: str | None = None,
        is_archived: bool | None = None,
        is_recurring: bool | None = None,
        benefit_id: Sequence[uuid.UUID] | None = None,
        metadata: MetadataQuery | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[ProductSortProperty]] = [
            (ProductSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Product], int]:
        repository = ProductRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).join(
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

        if id is not None:
            statement = statement.where(Product.id.in_(id))

        if organization_id is not None:
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

        if metadata is not None:
            statement = apply_metadata_clause(Product, statement, metadata)

        statement = repository.apply_sorting(statement, sorting)

        statement = statement.options(
            selectinload(Product.product_medias),
            selectinload(Product.attached_custom_fields),
        )

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Product | None:
        repository = ProductRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Product.id == id)
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

    async def get_embed(
        self, session: AsyncReadSession, id: uuid.UUID
    ) -> Product | None:
        repository = ProductRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(Product.id == id, Product.is_archived.is_(False))
            .options(selectinload(Product.product_medias))
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        create_schema: ProductCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Product:
        repository = ProductRepository.from_session(session)
        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )

        errors: list[ValidationError] = []
        prices, _, _, prices_errors = await self.get_validated_prices(
            session,
            create_schema.prices,
            create_schema.recurring_interval,
            None,
            auth_subject,
        )
        errors.extend(prices_errors)

        product = await repository.create(
            Product(
                organization=organization,
                prices=prices,
                all_prices=prices,
                product_benefits=[],
                product_medias=[],
                attached_custom_fields=[],
                **create_schema.model_dump(
                    exclude={
                        "organization_id",
                        "prices",
                        "medias",
                        "attached_custom_fields",
                    },
                    by_alias=True,
                ),
            ),
            flush=True,
        )
        assert product.id is not None

        if create_schema.medias is not None:
            for order, file_id in enumerate(create_schema.medias):
                file = await file_service.get_selectable_product_media_file(
                    session, file_id, organization_id=product.organization_id
                )
                if file is None:
                    errors.append(
                        {
                            "type": "value_error",
                            "loc": ("body", "medias", order),
                            "msg": "File does not exist or is not yet uploaded.",
                            "input": file_id,
                        }
                    )
                product.product_medias.append(ProductMedia(file=file, order=order))

        for order, attached_custom_field in enumerate(
            create_schema.attached_custom_fields
        ):
            custom_field = await custom_field_service.get_by_organization_and_id(
                session,
                attached_custom_field.custom_field_id,
                organization.id,
            )
            if custom_field is None:
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "attached_custom_fields", order),
                        "msg": "Custom field does not exist.",
                        "input": attached_custom_field.custom_field_id,
                    }
                )
            product.attached_custom_fields.append(
                ProductCustomField(
                    custom_field=custom_field,
                    order=order,
                    required=attached_custom_field.required,
                )
            )

        if errors:
            raise PolarRequestValidationError(errors)

        await session.flush()

        await self._after_product_created(session, auth_subject, product)

        return product

    async def update(
        self,
        session: AsyncSession,
        product: Product,
        update_schema: ProductUpdate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Product:
        errors: list[ValidationError] = []

        # Validate prices
        existing_prices = set(product.prices)
        added_prices: list[ProductPrice] = []
        if update_schema.prices is not None:
            (
                _,
                existing_prices,
                added_prices,
                prices_errors,
            ) = await self.get_validated_prices(
                session,
                update_schema.prices,
                product.recurring_interval,
                product,
                auth_subject,
            )
            errors.extend(prices_errors)

        # Prevent non-legacy products from changing their recurring interval
        if (
            update_schema.recurring_interval is not None
            and (
                update_schema.recurring_interval != product.recurring_interval
                or update_schema.recurring_interval_count
                != product.recurring_interval_count
            )
            and not all(is_legacy_price(price) for price in product.prices)
        ):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "recurring_interval"),
                    "msg": "Recurring interval cannot be changed.",
                    "input": update_schema.recurring_interval,
                }
            )

        # Prevent trying to add trial configuration to non-recurring products
        if (
            update_schema.trial_interval is not None
            or update_schema.trial_interval_count is not None
        ) and product.recurring_interval is None:
            errors.extend(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "trial_interval"),
                        "msg": "Trial configuration is only supported on recurring products.",
                        "input": update_schema.trial_interval,
                    },
                    {
                        "type": "value_error",
                        "loc": ("body", "trial_interval_count"),
                        "msg": "Trial configuration is only supported on recurring products.",
                        "input": update_schema.trial_interval_count,
                    },
                ]
            )

        if update_schema.medias is not None:
            medias_errors: list[ValidationError] = []
            nested = await session.begin_nested()
            product.medias = []
            await session.flush()

            for order, file_id in enumerate(update_schema.medias):
                file = await file_service.get_selectable_product_media_file(
                    session, file_id, organization_id=product.organization_id
                )
                if file is None:
                    medias_errors.append(
                        {
                            "type": "value_error",
                            "loc": ("body", "medias", order),
                            "msg": "File does not exist or is not yet uploaded.",
                            "input": file_id,
                        }
                    )
                    continue
                product.product_medias.append(ProductMedia(file=file, order=order))

            if medias_errors:
                await nested.rollback()
                errors.extend(medias_errors)

        if update_schema.attached_custom_fields is not None:
            attached_custom_fields_errors: list[ValidationError] = []
            nested = await session.begin_nested()
            product.attached_custom_fields = []
            await session.flush()

            for order, attached_custom_field in enumerate(
                update_schema.attached_custom_fields
            ):
                custom_field = await custom_field_service.get_by_organization_and_id(
                    session,
                    attached_custom_field.custom_field_id,
                    product.organization_id,
                )
                if custom_field is None:
                    attached_custom_fields_errors.append(
                        {
                            "type": "value_error",
                            "loc": ("body", "attached_custom_fields", order),
                            "msg": "Custom field does not exist.",
                            "input": attached_custom_field.custom_field_id,
                        }
                    )
                    continue
                product.attached_custom_fields.append(
                    ProductCustomField(
                        custom_field=custom_field,
                        order=order,
                        required=attached_custom_field.required,
                    )
                )

            if attached_custom_fields_errors:
                await nested.rollback()
                errors.extend(attached_custom_fields_errors)

        if errors:
            raise PolarRequestValidationError(errors)

        if product.is_archived and update_schema.is_archived is False:
            product = await self._unarchive(product)

        if update_schema.name is not None and update_schema.name != product.name:
            product.name = update_schema.name
        if (
            update_schema.description is not None
            and update_schema.description != product.description
        ):
            product.description = update_schema.description

        if update_schema.recurring_interval is not None:
            product.recurring_interval = update_schema.recurring_interval

        deleted_prices = set(product.prices) - existing_prices
        for deleted_price in deleted_prices:
            deleted_price.is_archived = True

        if update_schema.is_archived:
            product = await self._archive(session, product)

        for attr, value in update_schema.model_dump(
            exclude_unset=True,
            exclude={"prices", "medias", "attached_custom_fields"},
            by_alias=True,
        ).items():
            setattr(product, attr, value)

        session.add(product)
        await session.flush()

        await session.refresh(product, {"prices", "all_prices"})

        await self._after_product_updated(session, product)

        return product

    async def update_benefits(
        self,
        session: AsyncSession,
        product: Product,
        benefits: Sequence[uuid.UUID],
        auth_subject: AuthSubject[User | Organization],
    ) -> tuple[Product, set[Benefit], set[Benefit]]:
        previous_benefits = set(product.benefits)
        new_benefits: set[Benefit] = set()

        new_product_benefits: list[ProductBenefit] = []
        for order, benefit_id in enumerate(benefits):
            benefit = await benefit_service.get(session, auth_subject, benefit_id)
            if benefit is None:
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
            new_product_benefits.append(ProductBenefit(benefit=benefit, order=order))

        # Remove all previous benefits: flush to actually remove them
        product.product_benefits = []
        session.add(product)
        await session.flush()

        # Set the new benefits
        product.product_benefits = new_product_benefits

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

        if added_benefits or deleted_benefits:
            enqueue_job(
                "subscription.subscription.update_product_benefits_grants", product.id
            )
            enqueue_job("order.update_product_benefits_grants", product.id)

        await self._after_product_updated(session, product)

        return product, added_benefits, deleted_benefits

    async def get_validated_prices(
        self,
        session: AsyncSession,
        prices_schema: Sequence[ExistingProductPrice | ProductPriceCreate],
        recurring_interval: SubscriptionRecurringInterval | None,
        product: Product | None,
        auth_subject: AuthSubject[User | Organization],
        source: ProductPriceSource = ProductPriceSource.catalog,
        error_prefix: tuple[str, ...] = ("body", "prices"),
    ) -> tuple[
        builtins.list[ProductPrice],
        builtins.set[ProductPrice],
        builtins.list[ProductPrice],
        builtins.list[ValidationError],
    ]:
        meter_repository = MeterRepository.from_session(session)
        prices: list[ProductPrice] = []
        existing_prices: set[ProductPrice] = set()
        added_prices: list[ProductPrice] = []
        errors: list[ValidationError] = []
        meters: set[uuid.UUID] = set()
        for index, price_schema in enumerate(prices_schema):
            if isinstance(price_schema, ExistingProductPrice):
                assert product is not None
                price = product.get_price(price_schema.id)
                if price is None:
                    errors.append(
                        {
                            "type": "value_error",
                            "loc": (*error_prefix, index),
                            "msg": "Price does not exist.",
                            "input": price_schema.id,
                        }
                    )
                    continue
                existing_prices.add(price)
            else:
                model_class = price_schema.get_model_class()
                price = model_class(
                    product=product, source=source, **price_schema.model_dump()
                )
                if is_metered_price(price) and isinstance(
                    price_schema, ProductPriceMeteredCreateBase
                ):
                    if recurring_interval is None:
                        errors.append(
                            {
                                "type": "value_error",
                                "loc": (*error_prefix, index),
                                "msg": "Metered pricing is not supported on one-time products.",
                                "input": price_schema,
                            }
                        )
                        continue

                    if price_schema.meter_id in meters:
                        errors.append(
                            {
                                "type": "value_error",
                                "loc": (*error_prefix, index, "meter_id"),
                                "msg": "Meter is already used for another price.",
                                "input": price_schema.meter_id,
                            }
                        )
                        continue

                    price.meter = await meter_repository.get_readable_by_id(
                        price_schema.meter_id, auth_subject
                    )
                    if price.meter is None:
                        errors.append(
                            {
                                "type": "value_error",
                                "loc": (*error_prefix, index, "meter_id"),
                                "msg": "Meter does not exist.",
                                "input": price_schema.meter_id,
                            }
                        )
                        continue
                    meters.add(price_schema.meter_id)
                added_prices.append(price)
            prices.append(price)

        if len(prices) < 1:
            errors.append(
                {
                    "type": "too_short",
                    "loc": error_prefix,
                    "msg": "At least one price is required.",
                    "input": prices_schema,
                }
            )

        static_prices = [p for p in prices if is_static_price(p)]
        if len(static_prices) > 1:
            # Bypass that rule for legacy recurring products
            if not all(is_legacy_price(p) for p in static_prices):
                errors.append(
                    {
                        "type": "value_error",
                        "loc": error_prefix,
                        "msg": "Only one static price is allowed.",
                        "input": prices_schema,
                    }
                )

        return prices, existing_prices, added_prices, errors

    async def _archive(self, session: AsyncSession, product: Product) -> Product:
        product.is_archived = True

        checkout_link_repository = CheckoutLinkRepository.from_session(session)
        await checkout_link_repository.archive_product(product.id)

        return product

    async def _unarchive(self, product: Product) -> Product:
        product.is_archived = False
        return product

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
        event_type: Literal[
            WebhookEventType.product_created, WebhookEventType.product_updated
        ],
    ) -> None:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(product.organization_id)
        if organization is not None:
            await webhook_service.send(session, organization, event_type, product)


product = ProductService()
