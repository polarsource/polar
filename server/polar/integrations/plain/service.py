# pyright: reportCallIssue=false
import asyncio
import contextlib
import uuid
from collections.abc import AsyncIterator, Coroutine
from typing import Any

import httpx
import pycountry
import pycountry.db
from babel.numbers import format_currency
from plain_client import (
    ComponentContainerContentInput,
    ComponentContainerInput,
    ComponentCopyButtonInput,
    ComponentDividerInput,
    ComponentDividerSpacingSize,
    ComponentInput,
    ComponentLinkButtonInput,
    ComponentRowContentInput,
    ComponentRowInput,
    ComponentSpacerInput,
    ComponentSpacerSize,
    ComponentTextColor,
    ComponentTextInput,
    ComponentTextSize,
    CreateThreadInput,
    CustomerIdentifierInput,
    EmailAddressInput,
    OptionalStringInput,
    Plain,
    UpsertCustomerIdentifierInput,
    UpsertCustomerInput,
    UpsertCustomerOnCreateInput,
    UpsertCustomerOnUpdateInput,
)
from sqlalchemy import func, select
from sqlalchemy.orm import contains_eager

from polar.config import settings
from polar.exceptions import PolarError
from polar.models import (
    Customer,
    Order,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.models.organization_review import OrganizationReview
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository

from .schemas import (
    CustomerCard,
    CustomerCardKey,
    CustomerCardsRequest,
    CustomerCardsResponse,
)


class PlainServiceError(PolarError): ...


class AccountAdminDoesNotExistError(PlainServiceError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        super().__init__(f"Account admin does not exist for account ID {account_id}")


class AccountReviewThreadCreationError(PlainServiceError):
    def __init__(self, account_id: uuid.UUID, message: str) -> None:
        self.account_id = account_id
        self.message = message
        super().__init__(
            f"Error creating thread for account ID {account_id}: {message}"
        )


class NoUserFoundError(PlainServiceError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        super().__init__(f"No user found for organization {organization_id}")


_card_getter_semaphore = asyncio.Semaphore(3)


async def _card_getter_task(
    coroutine: Coroutine[Any, Any, CustomerCard | None],
) -> CustomerCard | None:
    async with _card_getter_semaphore:
        return await coroutine


class PlainService:
    async def get_cards(
        self, session: AsyncSession, request: CustomerCardsRequest
    ) -> CustomerCardsResponse:
        tasks: list[asyncio.Task[CustomerCard | None]] = []
        async with asyncio.TaskGroup() as tg:
            if CustomerCardKey.user in request.cardKeys:
                tasks.append(
                    tg.create_task(
                        _card_getter_task(self._get_user_card(session, request))
                    )
                )
            if CustomerCardKey.organization in request.cardKeys:
                tasks.append(
                    tg.create_task(
                        _card_getter_task(self._get_organization_card(session, request))
                    )
                )
            if CustomerCardKey.customer in request.cardKeys:
                tasks.append(
                    tg.create_task(
                        _card_getter_task(self.get_customer_card(session, request))
                    )
                )
            if CustomerCardKey.order in request.cardKeys:
                tasks.append(
                    tg.create_task(
                        _card_getter_task(self._get_order_card(session, request))
                    )
                )

        cards = [card for task in tasks if (card := task.result()) is not None]
        return CustomerCardsResponse(cards=cards)

    async def create_account_review_thread(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        user_repository = UserRepository.from_session(session)
        if organization.account is None:
            from polar.organization.tasks import OrganizationAccountNotSet

            raise OrganizationAccountNotSet(organization.id)
        admin = await user_repository.get_by_id(organization.account.admin_id)
        if admin is None:
            raise AccountAdminDoesNotExistError(organization.account.admin_id)

        async with self._get_plain_client() as plain:
            customer_result = await plain.upsert_customer(
                UpsertCustomerInput(
                    identifier=UpsertCustomerIdentifierInput(email_address=admin.email),
                    on_create=UpsertCustomerOnCreateInput(
                        external_id=str(admin.id),
                        full_name=admin.email,
                        email=EmailAddressInput(
                            email=admin.email, is_verified=admin.email_verified
                        ),
                    ),
                    on_update=UpsertCustomerOnUpdateInput(
                        external_id=OptionalStringInput(value=str(admin.id)),
                        email=EmailAddressInput(
                            email=admin.email, is_verified=admin.email_verified
                        ),
                    ),
                )
            )
            if customer_result.error is not None:
                raise AccountReviewThreadCreationError(
                    organization.account.id, customer_result.error.message
                )

            thread_result = await plain.create_thread(
                CreateThreadInput(
                    customer_identifier=CustomerIdentifierInput(
                        external_id=str(admin.id)
                    ),
                    title="Account Review",
                    label_type_ids=["lt_01JFG7F4N67FN3MAWK06FJ8FPG"],
                    components=[
                        ComponentInput(
                            component_text=ComponentTextInput(
                                text=f"The organization `{organization.slug}` should be reviewed, as it hit a threshold. It's used by the following organizations:"
                            )
                        ),
                        ComponentInput(
                            component_spacer=ComponentSpacerInput(
                                spacer_size=ComponentSpacerSize.M
                            )
                        ),
                        ComponentInput(
                            component_link_button=ComponentLinkButtonInput(
                                link_button_url=settings.generate_external_url(
                                    f"/backoffice/organizations/{organization.id}"
                                ),
                                link_button_label="Review account ↗",
                            )
                        ),
                    ],
                )
            )
            if thread_result.error is not None:
                raise AccountReviewThreadCreationError(
                    organization.account.id, thread_result.error.message
                )

    async def _get_user_card(
        self, session: AsyncSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        user_repository = UserRepository.from_session(session)
        user = await user_repository.get_by_email(email)

        if user is None:
            return None

        components: list[ComponentInput] = [
            ComponentInput(
                component_container=ComponentContainerInput(
                    container_content=[
                        ComponentContainerContentInput(
                            component_row=ComponentRowInput(
                                row_main_content=[
                                    ComponentRowContentInput(
                                        component_text=ComponentTextInput(
                                            text=user.email
                                        )
                                    ),
                                ],
                                row_aside_content=[
                                    ComponentRowContentInput(
                                        component_link_button=ComponentLinkButtonInput(
                                            link_button_label="Backoffice ↗",
                                            link_button_url=settings.generate_external_url(
                                                f"/backoffice/users/{user.id}"
                                            ),
                                        )
                                    )
                                ],
                            )
                        ),
                        ComponentContainerContentInput(
                            component_divider=ComponentDividerInput(
                                divider_spacing_size=ComponentDividerSpacingSize.M
                            )
                        ),
                        ComponentContainerContentInput(
                            component_row=ComponentRowInput(
                                row_main_content=[
                                    ComponentRowContentInput(
                                        component_text=ComponentTextInput(
                                            text="ID",
                                            text_size=ComponentTextSize.S,
                                            text_color=ComponentTextColor.MUTED,
                                        )
                                    ),
                                    ComponentRowContentInput(
                                        component_text=ComponentTextInput(
                                            text=str(user.id)
                                        )
                                    ),
                                ],
                                row_aside_content=[
                                    ComponentRowContentInput(
                                        component_copy_button=ComponentCopyButtonInput(
                                            copy_button_value=str(user.id),
                                            copy_button_tooltip_label="Copy User ID",
                                        )
                                    )
                                ],
                            )
                        ),
                        ComponentContainerContentInput(
                            component_spacer=ComponentSpacerInput(
                                spacer_size=ComponentSpacerSize.M
                            )
                        ),
                        ComponentContainerContentInput(
                            component_text=ComponentTextInput(
                                text="Created At",
                                text_size=ComponentTextSize.S,
                                text_color=ComponentTextColor.MUTED,
                            )
                        ),
                        ComponentContainerContentInput(
                            component_text=ComponentTextInput(
                                text=user.created_at.date().isoformat()
                            )
                        ),
                        ComponentContainerContentInput(
                            component_row=ComponentRowInput(
                                row_main_content=[
                                    ComponentRowContentInput(
                                        component_text=ComponentTextInput(
                                            text="Identity Verification",
                                            text_size=ComponentTextSize.S,
                                            text_color=ComponentTextColor.MUTED,
                                        )
                                    ),
                                    ComponentRowContentInput(
                                        component_text=ComponentTextInput(
                                            text=user.identity_verification_status
                                        )
                                    ),
                                ],
                                row_aside_content=[
                                    ComponentRowContentInput(
                                        component_link_button=ComponentLinkButtonInput(
                                            link_button_label="Stripe ↗",
                                            link_button_url=f"https://dashboard.stripe.com/identity/verification-sessions/{user.identity_verification_id}",
                                        )
                                    )
                                ]
                                if user.identity_verification_id
                                else [],
                            )
                        ),
                    ]
                )
            )
        ]

        return CustomerCard(
            key=CustomerCardKey.user,
            timeToLiveSeconds=86400,
            components=[
                component.model_dump(by_alias=True, exclude_none=True)
                for component in components
            ],
        )

    async def _get_organization_card(
        self, session: AsyncSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        statement = (
            select(Organization)
            .join(
                UserOrganization,
                Organization.id == UserOrganization.organization_id,
                isouter=True,
            )
            .join(User, User.id == UserOrganization.user_id)
            .where(func.lower(User.email) == email.lower())
        )
        result = await session.execute(statement)
        organizations = result.unique().scalars().all()

        if len(organizations) == 0:
            return None

        components: list[ComponentInput] = []
        for i, organization in enumerate(organizations):
            components.append(
                ComponentInput(
                    component_container=self._get_organization_component_container(
                        organization
                    )
                )
            )
            if i < len(organizations) - 1:
                components.append(
                    ComponentInput(
                        component_divider=ComponentDividerInput(
                            divider_spacing_size=ComponentDividerSpacingSize.M
                        )
                    )
                )

        return CustomerCard(
            key=CustomerCardKey.organization,
            timeToLiveSeconds=86400,
            components=[
                component.model_dump(by_alias=True, exclude_none=True)
                for component in components
            ],
        )

    def _get_organization_component_container(
        self, organization: Organization
    ) -> ComponentContainerInput:
        return ComponentContainerInput(
            container_content=[
                ComponentContainerContentInput(
                    component_row=ComponentRowInput(
                        row_main_content=[
                            ComponentRowContentInput(
                                component_text=ComponentTextInput(
                                    text=organization.name
                                )
                            ),
                            ComponentRowContentInput(
                                component_text=ComponentTextInput(
                                    text=organization.slug,
                                    text_color=ComponentTextColor.MUTED,
                                )
                            ),
                        ],
                        row_aside_content=[
                            ComponentRowContentInput(
                                component_link_button=ComponentLinkButtonInput(
                                    link_button_label="Backoffice ↗",
                                    link_button_url=settings.generate_external_url(
                                        f"/backoffice/organizations/{organization.id}"
                                    ),
                                )
                            )
                        ],
                    )
                ),
                ComponentContainerContentInput(
                    component_divider=ComponentDividerInput(
                        divider_spacing_size=ComponentDividerSpacingSize.M
                    )
                ),
                ComponentContainerContentInput(
                    component_row=ComponentRowInput(
                        row_main_content=[
                            ComponentRowContentInput(
                                component_text=ComponentTextInput(
                                    text="ID",
                                    text_size=ComponentTextSize.S,
                                    text_color=ComponentTextColor.MUTED,
                                )
                            ),
                            ComponentRowContentInput(
                                component_text=ComponentTextInput(
                                    text=str(organization.id)
                                )
                            ),
                        ],
                        row_aside_content=[
                            ComponentRowContentInput(
                                component_copy_button=ComponentCopyButtonInput(
                                    copy_button_value=str(organization.id),
                                    copy_button_tooltip_label="Copy Organization ID",
                                )
                            )
                        ],
                    )
                ),
                *(
                    [
                        ComponentContainerContentInput(
                            component_row=ComponentRowInput(
                                row_main_content=[
                                    ComponentRowContentInput(
                                        component_text=ComponentTextInput(
                                            text="Support Email",
                                            text_size=ComponentTextSize.S,
                                            text_color=ComponentTextColor.MUTED,
                                        )
                                    ),
                                    ComponentRowContentInput(
                                        component_text=ComponentTextInput(
                                            text=organization.email
                                        )
                                    ),
                                ],
                                row_aside_content=[
                                    ComponentRowContentInput(
                                        component_copy_button=ComponentCopyButtonInput(
                                            copy_button_value=organization.email,
                                            copy_button_tooltip_label="Copy Support Email",
                                        )
                                    )
                                ],
                            )
                        ),
                    ]
                    if organization.email
                    else []
                ),
                ComponentContainerContentInput(
                    component_spacer=ComponentSpacerInput(
                        spacer_size=ComponentSpacerSize.M
                    )
                ),
                ComponentContainerContentInput(
                    component_text=ComponentTextInput(
                        text="Created At",
                        text_size=ComponentTextSize.S,
                        text_color=ComponentTextColor.MUTED,
                    )
                ),
                ComponentContainerContentInput(
                    component_text=ComponentTextInput(
                        text=organization.created_at.date().isoformat()
                    )
                ),
            ]
        )

    async def create_appeal_review_thread(
        self,
        session: AsyncSession,
        organization: Organization,
        review: OrganizationReview,
    ) -> None:
        """Create Plain ticket for organization appeal review."""
        user_repository = UserRepository.from_session(session)
        users = await user_repository.get_all_by_organization(organization.id)
        if len(users) == 0:
            raise NoUserFoundError(organization.id)
        user = users[0]

        # Create Plain ticket for appeal review
        async with self._get_plain_client() as plain:
            customer_result = await plain.upsert_customer(
                UpsertCustomerInput(
                    identifier=UpsertCustomerIdentifierInput(email_address=user.email),
                    on_create=UpsertCustomerOnCreateInput(
                        external_id=str(user.id),
                        full_name=user.email,
                        email=EmailAddressInput(
                            email=user.email, is_verified=user.email_verified
                        ),
                    ),
                    on_update=UpsertCustomerOnUpdateInput(
                        external_id=OptionalStringInput(value=str(user.id)),
                        email=EmailAddressInput(
                            email=user.email, is_verified=user.email_verified
                        ),
                    ),
                )
            )

            if customer_result.error is not None:
                raise AccountReviewThreadCreationError(
                    user.id, customer_result.error.message
                )

            # Create the thread with detailed appeal information
            thread_result = await plain.create_thread(
                CreateThreadInput(
                    customer_identifier=CustomerIdentifierInput(
                        external_id=str(user.id)
                    ),
                    title=f"Organization Appeal - {organization.slug}",
                    label_type_ids=["lt_01K3QWYTDV7RSS7MM2RC584X41"],
                    components=[
                        ComponentInput(
                            component_text=ComponentTextInput(
                                text=f"The organization `{organization.slug}` has submitted an appeal for review after AI validation {review.verdict}."
                            )
                        ),
                        ComponentInput(
                            component_container=ComponentContainerInput(
                                container_content=[
                                    ComponentContainerContentInput(
                                        component_text=ComponentTextInput(
                                            text=organization.name or organization.slug
                                        )
                                    ),
                                    ComponentContainerContentInput(
                                        component_divider=ComponentDividerInput(
                                            divider_spacing_size=ComponentDividerSpacingSize.M
                                        )
                                    ),
                                    # Organization ID
                                    ComponentContainerContentInput(
                                        component_row=ComponentRowInput(
                                            row_main_content=[
                                                ComponentRowContentInput(
                                                    component_text=ComponentTextInput(
                                                        text="Organization ID",
                                                        text_size=ComponentTextSize.S,
                                                        text_color=ComponentTextColor.MUTED,
                                                    )
                                                ),
                                                ComponentRowContentInput(
                                                    component_text=ComponentTextInput(
                                                        text=str(organization.id)
                                                    )
                                                ),
                                            ],
                                            row_aside_content=[
                                                ComponentRowContentInput(
                                                    component_copy_button=ComponentCopyButtonInput(
                                                        copy_button_value=str(
                                                            organization.id
                                                        ),
                                                        copy_button_tooltip_label="Copy Organization ID",
                                                    )
                                                )
                                            ],
                                        )
                                    ),
                                    # Admin Dashboard Link
                                    ComponentContainerContentInput(
                                        component_link_button=ComponentLinkButtonInput(
                                            link_button_url=f"{settings.FRONTEND_BASE_URL}/backoffice/organizations/{organization.id}",
                                            link_button_label="View in Admin Dashboard",
                                        )
                                    ),
                                ]
                            )
                        ),
                    ],
                )
            )

            if thread_result.error is not None:
                raise AccountReviewThreadCreationError(
                    user.id, thread_result.error.message
                )

    async def get_customer_card(
        self, session: AsyncSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        # No need to filter out soft deleted. We want to see them in support.
        statement = select(Customer).where(func.lower(Customer.email) == email.lower())
        result = await session.execute(statement)
        customers = result.unique().scalars().all()

        if len(customers) == 0:
            return None

        def _get_customer_container(customer: Customer) -> ComponentContainerInput:
            country: pycountry.db.Country | None = None
            if customer.billing_address and customer.billing_address.country:
                country = pycountry.countries.get(
                    alpha_2=customer.billing_address.country
                )
            return ComponentContainerInput(
                container_content=[
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text=customer.name or customer.email or "Unknown"
                        )
                    ),
                    ComponentContainerContentInput(
                        component_divider=ComponentDividerInput(
                            divider_spacing_size=ComponentDividerSpacingSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_row=ComponentRowInput(
                            row_main_content=[
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text="ID",
                                        text_size=ComponentTextSize.S,
                                        text_color=ComponentTextColor.MUTED,
                                    )
                                ),
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text=str(customer.id)
                                    )
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_copy_button=ComponentCopyButtonInput(
                                        copy_button_value=str(customer.id),
                                        copy_button_tooltip_label="Copy Customer ID",
                                    )
                                )
                            ],
                        )
                    ),
                    ComponentContainerContentInput(
                        component_spacer=ComponentSpacerInput(
                            spacer_size=ComponentSpacerSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text="Created At",
                            text_size=ComponentTextSize.S,
                            text_color=ComponentTextColor.MUTED,
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text=customer.created_at.date().isoformat()
                        )
                    ),
                    *(
                        [
                            ComponentContainerContentInput(
                                component_spacer=ComponentSpacerInput(
                                    spacer_size=ComponentSpacerSize.M
                                )
                            ),
                            ComponentContainerContentInput(
                                component_row=ComponentRowInput(
                                    row_main_content=[
                                        ComponentRowContentInput(
                                            component_text=ComponentTextInput(
                                                text="Country",
                                                text_size=ComponentTextSize.S,
                                                text_color=ComponentTextColor.MUTED,
                                            )
                                        ),
                                        ComponentRowContentInput(
                                            component_text=ComponentTextInput(
                                                text=country.name,
                                            )
                                        ),
                                    ],
                                    row_aside_content=[
                                        ComponentRowContentInput(
                                            component_text=ComponentTextInput(
                                                text=country.flag
                                            )
                                        )
                                    ],
                                )
                            ),
                        ]
                        if country
                        else []
                    ),
                    ComponentContainerContentInput(
                        component_spacer=ComponentSpacerInput(
                            spacer_size=ComponentSpacerSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_row=ComponentRowInput(
                            row_main_content=[
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text="Stripe Customer ID",
                                        text_size=ComponentTextSize.S,
                                        text_color=ComponentTextColor.MUTED,
                                    )
                                ),
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text=customer.stripe_customer_id or "N/A",
                                    )
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_link_button=ComponentLinkButtonInput(
                                        link_button_label="Stripe ↗",
                                        link_button_url=f"https://dashboard.stripe.com/customers/{customer.stripe_customer_id}",
                                    )
                                )
                            ],
                        )
                    ),
                ]
            )

        components: list[ComponentInput] = []
        for i, customer in enumerate(customers):
            components.append(
                ComponentInput(component_container=_get_customer_container(customer))
            )
            if i < len(customers) - 1:
                components.append(
                    ComponentInput(
                        component_divider=ComponentDividerInput(
                            divider_spacing_size=ComponentDividerSpacingSize.M
                        )
                    )
                )

        return CustomerCard(
            key=CustomerCardKey.customer,
            timeToLiveSeconds=86400,
            components=[
                component.model_dump(by_alias=True, exclude_none=True)
                for component in components
            ],
        )

    async def _get_order_card(
        self, session: AsyncSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        statement = (
            (
                select(Order)
                .join(Customer, onclause=Customer.id == Order.customer_id)
                .join(Product, onclause=Product.id == Order.product_id)
                .where(func.lower(Customer.email) == email.lower())
            )
            .order_by(Order.created_at.desc())
            .limit(3)
            .options(
                contains_eager(Order.product),
                contains_eager(Order.customer).joinedload(Customer.organization),
            )
        )
        result = await session.execute(statement)
        orders = result.unique().scalars().all()

        if len(orders) == 0:
            return None

        def _get_order_container(order: Order) -> ComponentContainerInput:
            product = order.product

            return ComponentContainerInput(
                container_content=[
                    ComponentContainerContentInput(
                        component_row=ComponentRowInput(
                            row_main_content=[
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(text=product.name)
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_link_button=ComponentLinkButtonInput(
                                        link_button_label="Backoffice ↗",
                                        link_button_url=settings.generate_external_url(
                                            f"/backoffice/orders/{order.id}"
                                        ),
                                    )
                                )
                            ],
                        )
                    ),
                    ComponentContainerContentInput(
                        component_divider=ComponentDividerInput(
                            divider_spacing_size=ComponentDividerSpacingSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_row=ComponentRowInput(
                            row_main_content=[
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text="Organization",
                                        text_size=ComponentTextSize.S,
                                        text_color=ComponentTextColor.MUTED,
                                    )
                                ),
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text=order.customer.organization.name
                                    )
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_link_button=ComponentLinkButtonInput(
                                        link_button_label="Backoffice ↗",
                                        link_button_url=settings.generate_external_url(
                                            f"/backoffice/organizations/{order.customer.organization_id}"
                                        ),
                                    )
                                )
                            ],
                        )
                    ),
                    ComponentContainerContentInput(
                        component_spacer=ComponentSpacerInput(
                            spacer_size=ComponentSpacerSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_row=ComponentRowInput(
                            row_main_content=[
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text="ID",
                                        text_size=ComponentTextSize.S,
                                        text_color=ComponentTextColor.MUTED,
                                    )
                                ),
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text=str(order.id)
                                    )
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_copy_button=ComponentCopyButtonInput(
                                        copy_button_value=str(order.id),
                                        copy_button_tooltip_label="Copy Order ID",
                                    )
                                )
                            ],
                        )
                    ),
                    ComponentContainerContentInput(
                        component_spacer=ComponentSpacerInput(
                            spacer_size=ComponentSpacerSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text="Date",
                            text_size=ComponentTextSize.S,
                            text_color=ComponentTextColor.MUTED,
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text=order.created_at.date().isoformat()
                        )
                    ),
                    ComponentContainerContentInput(
                        component_spacer=ComponentSpacerInput(
                            spacer_size=ComponentSpacerSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text="Billing Reason",
                            text_size=ComponentTextSize.S,
                            text_color=ComponentTextColor.MUTED,
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(text=order.billing_reason)
                    ),
                    ComponentContainerContentInput(
                        component_divider=ComponentDividerInput(
                            divider_spacing_size=ComponentDividerSpacingSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_spacer=ComponentSpacerInput(
                            spacer_size=ComponentSpacerSize.M
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text="Amount",
                            text_size=ComponentTextSize.S,
                            text_color=ComponentTextColor.MUTED,
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text=format_currency(
                                order.net_amount / 100,
                                order.currency.upper(),
                                locale="en_US",
                            )
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text="Tax Amount",
                            text_size=ComponentTextSize.S,
                            text_color=ComponentTextColor.MUTED,
                        )
                    ),
                    ComponentContainerContentInput(
                        component_text=ComponentTextInput(
                            text=format_currency(
                                order.tax_amount / 100,
                                order.currency.upper(),
                                locale="en_US",
                            )
                        )
                    ),
                ]
            )

        components: list[ComponentInput] = []
        for i, order in enumerate(orders):
            components.append(
                ComponentInput(component_container=_get_order_container(order))
            )
            if i < len(orders) - 1:
                components.append(
                    ComponentInput(
                        component_divider=ComponentDividerInput(
                            divider_spacing_size=ComponentDividerSpacingSize.M
                        )
                    )
                )

        return CustomerCard(
            key=CustomerCardKey.order,
            timeToLiveSeconds=86400,
            components=[
                component.model_dump(by_alias=True, exclude_none=True)
                for component in components
            ],
        )

    @contextlib.asynccontextmanager
    async def _get_plain_client(self) -> AsyncIterator[Plain]:
        token = settings.PLAIN_TOKEN
        async with httpx.AsyncClient(
            headers={"Authorization": f"Bearer {token}"},
            # Set a MockTransport if API key is None
            # Basically, we disable Plain requests.
            transport=(
                httpx.MockTransport(lambda _: httpx.Response(200))
                if token is None
                else None
            ),
        ) as client:
            async with Plain(
                "https://core-api.uk.plain.com/graphql/v1", http_client=client
            ) as plain:
                yield plain


plain = PlainService()
