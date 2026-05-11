# pyright: reportCallIssue=false
import asyncio
import contextlib
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable

import httpx
import pycountry
import pycountry.db
import structlog
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
    CreateNoteInput,
    CreateThreadInput,
    CustomerIdentifierInput,
    EmailAddressInput,
    Plain,
    ThreadsFilter,
    ThreadStatus,
    UpsertCustomerIdentifierInput,
    UpsertCustomerInput,
    UpsertCustomerOnCreateInput,
    UpsertCustomerOnUpdateInput,
    UpsertCustomerUpsertCustomer,
)
from sqlalchemy import func, or_, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarError
from polar.kit.currency import format_currency
from polar.kit.db.postgres import AsyncReadSessionMaker
from polar.models import (
    Customer,
    Feedback,
    FeedbackType,
    OAuthAccount,
    Order,
    Organization,
    User,
    UserOrganization,
)
from polar.order.repository import OrderRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.user.repository import UserRepository

from .schemas import (
    CustomerCard,
    CustomerCardKey,
    CustomerCardsRequest,
    CustomerCardsResponse,
)

log = structlog.get_logger(__name__)

PLAIN_WORKSPACE_ID = "w_01JE9TRRX9KT61D8P2CH77XDQM"


def plain_thread_url(thread_id: str) -> str:
    return f"https://app.plain.com/workspace/{PLAIN_WORKSPACE_ID}/thread/{thread_id}"


class PlainServiceError(PolarError): ...


class AccountReviewThreadCreationError(PlainServiceError):
    def __init__(self, account_id: uuid.UUID, message: str) -> None:
        self.account_id = account_id
        self.message = message
        super().__init__(
            f"Error creating thread for account ID {account_id}: {message}"
        )


class PlainCustomerError(PlainServiceError):
    def __init__(self, user_id: uuid.UUID, message: str) -> None:
        self.user_id = user_id
        self.message = message
        super().__init__(f"Error with Plain customer for user ID {user_id}: {message}")


class FeedbackThreadCreationError(PlainServiceError):
    def __init__(self, feedback_id: uuid.UUID, message: str) -> None:
        self.feedback_id = feedback_id
        self.message = message
        super().__init__(
            f"Error creating Plain thread for feedback {feedback_id}: {message}"
        )


_card_getter_semaphore = asyncio.Semaphore(3)

CardGetter = Callable[
    [AsyncReadSession, CustomerCardsRequest], Awaitable[CustomerCard | None]
]


async def _card_getter_task(
    sessionmaker: AsyncReadSessionMaker,
    getter: CardGetter,
    request: CustomerCardsRequest,
) -> CustomerCard | None:
    async with _card_getter_semaphore:
        async with sessionmaker() as session:
            return await getter(session, request)


class PlainService:
    enabled = settings.PLAIN_TOKEN is not None

    async def get_cards(
        self,
        sessionmaker: AsyncReadSessionMaker,
        request: CustomerCardsRequest,
    ) -> CustomerCardsResponse:
        getters: list[CardGetter] = []
        if CustomerCardKey.user in request.cardKeys:
            getters.append(self._get_user_card)
        if CustomerCardKey.organization in request.cardKeys:
            getters.append(self._get_organization_card)
        if CustomerCardKey.customer in request.cardKeys:
            getters.append(self.get_customer_card)
        if CustomerCardKey.order in request.cardKeys:
            getters.append(self._get_order_card)
        if CustomerCardKey.snippets in request.cardKeys:
            getters.append(self._get_snippets_card)

        tasks: list[asyncio.Task[CustomerCard | None]] = []
        async with asyncio.TaskGroup() as tg:
            for getter in getters:
                tasks.append(
                    tg.create_task(_card_getter_task(sessionmaker, getter, request))
                )

        cards = [card for task in tasks if (card := task.result()) is not None]
        return CustomerCardsResponse(cards=cards)

    async def create_organization_deletion_thread(
        self,
        session: AsyncSession,
        organization: Organization,
        requesting_user: User,
        blocked_reasons: list[str],
    ) -> None:
        """Create Plain ticket for organization deletion request."""
        if not self.enabled:
            return

        async with self._get_plain_client() as plain:
            try:
                customer_identifier = await self._get_or_create_customer(
                    plain, requesting_user
                )
            except PlainCustomerError as e:
                raise AccountReviewThreadCreationError(
                    organization.id, e.message
                ) from e

            reasons_text = ", ".join(blocked_reasons) if blocked_reasons else "unknown"

            thread_result = await plain.create_thread(
                CreateThreadInput(
                    customer_identifier=customer_identifier,
                    title=f"Organization Deletion Request - {organization.slug}",
                    components=[
                        ComponentInput(
                            component_text=ComponentTextInput(
                                text=f"User has requested deletion of organization `{organization.slug}`."
                            )
                        ),
                        ComponentInput(
                            component_text=ComponentTextInput(
                                text=f"Blocked reasons: {reasons_text}",
                                text_color=ComponentTextColor.MUTED,
                            )
                        ),
                        ComponentInput(
                            component_spacer=ComponentSpacerInput(
                                spacer_size=ComponentSpacerSize.M
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
                                    ComponentContainerContentInput(
                                        component_link_button=ComponentLinkButtonInput(
                                            link_button_url=settings.generate_backoffice_url(
                                                f"/organizations/{organization.id}"
                                            ),
                                            link_button_label="View in Backoffice",
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
                    organization.id, thread_result.error.message
                )

    async def _get_user_card(
        self, session: AsyncReadSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        user_repository = UserRepository.from_session(session)
        users = await user_repository.get_all_by_any_email(email)

        if not users:
            return None

        def _get_user_container(user: User) -> ComponentContainerInput:
            return ComponentContainerInput(
                container_content=[
                    ComponentContainerContentInput(
                        component_row=ComponentRowInput(
                            row_main_content=[
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(text=user.email)
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_link_button=ComponentLinkButtonInput(
                                        link_button_label="Backoffice ↗",
                                        link_button_url=settings.generate_backoffice_url(
                                            f"/users/{user.id}"
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
                                    component_text=ComponentTextInput(text=str(user.id))
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

        components: list[ComponentInput] = []
        for i, user in enumerate(users):
            components.append(
                ComponentInput(component_container=_get_user_container(user))
            )
            if i < len(users) - 1:
                components.append(
                    ComponentInput(
                        component_divider=ComponentDividerInput(
                            divider_spacing_size=ComponentDividerSpacingSize.M
                        )
                    )
                )

        return CustomerCard(
            key=CustomerCardKey.user,
            timeToLiveSeconds=86400,
            components=[
                component.model_dump(by_alias=True, exclude_none=True)
                for component in components
            ],
        )

    async def _get_organization_card(
        self, session: AsyncReadSession, request: CustomerCardsRequest
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
            .outerjoin(OAuthAccount, OAuthAccount.user_id == User.id)
            .where(
                or_(
                    func.lower(User.email) == email.lower(),
                    func.lower(OAuthAccount.account_email) == email.lower(),
                )
            )
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
                                    link_button_url=settings.generate_backoffice_url(
                                        f"/organizations/{organization.id}"
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
                ComponentContainerContentInput(
                    component_row=ComponentRowInput(
                        row_main_content=[
                            ComponentRowContentInput(
                                component_text=ComponentTextInput(
                                    text="Customer Portal",
                                    text_size=ComponentTextSize.S,
                                    text_color=ComponentTextColor.MUTED,
                                )
                            ),
                            ComponentRowContentInput(
                                component_text=ComponentTextInput(
                                    text=settings.generate_frontend_url(
                                        f"/{organization.slug}/portal"
                                    )
                                )
                            ),
                        ],
                        row_aside_content=[
                            ComponentRowContentInput(
                                component_copy_button=ComponentCopyButtonInput(
                                    copy_button_value=settings.generate_frontend_url(
                                        f"/{organization.slug}/portal"
                                    ),
                                    copy_button_tooltip_label="Copy URL",
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

    async def get_customer_card(
        self, session: AsyncReadSession, request: CustomerCardsRequest
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
        self, session: AsyncReadSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        customer_repository = CustomerRepository.from_session(session)
        customer_ids = await customer_repository.get_ids_by_email(email)
        if not customer_ids:
            return None

        order_repository = OrderRepository.from_session(session)
        orders = await order_repository.get_latest_by_customer_ids(
            customer_ids,
            limit=3,
            options=(
                contains_eager(Order.product),
                contains_eager(Order.customer),
                joinedload(Order.organization),
            ),
        )

        if len(orders) == 0:
            return None

        def _get_order_container(order: Order) -> ComponentContainerInput:
            organization = order.organization

            return ComponentContainerInput(
                container_content=[
                    ComponentContainerContentInput(
                        component_row=ComponentRowInput(
                            row_main_content=[
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text=order.description
                                    )
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_link_button=ComponentLinkButtonInput(
                                        link_button_label="Backoffice ↗",
                                        link_button_url=settings.generate_backoffice_url(
                                            f"/orders/{order.id}"
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
                                        text=organization.name
                                    )
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_link_button=ComponentLinkButtonInput(
                                        link_button_label="Backoffice ↗",
                                        link_button_url=settings.generate_backoffice_url(
                                            f"/organizations/{organization.id}"
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
                                        text="Customer Portal",
                                        text_size=ComponentTextSize.S,
                                        text_color=ComponentTextColor.MUTED,
                                    )
                                ),
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text=settings.generate_frontend_url(
                                            f"/{organization.slug}/portal"
                                        )
                                    )
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_copy_button=ComponentCopyButtonInput(
                                        copy_button_value=settings.generate_frontend_url(
                                            f"/{organization.slug}/portal"
                                        ),
                                        copy_button_tooltip_label="Copy URL",
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
                            text=format_currency(order.net_amount, order.currency)
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
                            text=format_currency(order.tax_amount, order.currency)
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

    async def _get_snippets_card(
        self, session: AsyncReadSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        statement = (
            select(Organization)
            .join(Customer, Customer.organization_id == Organization.id)
            .where(func.lower(Customer.email) == email.lower())
        )
        result = await session.execute(statement)
        organizations = result.unique().scalars().all()

        if len(organizations) == 0:
            return None

        snippets: list[tuple[str, str]] = [
            (
                "Looping In",
                (
                    "I'm looping in the {organization_name} team to the conversation so that they can help you."
                ),
            ),
            (
                "Looping In with guidelines",
                (
                    "I'm looping in the {organization_name} team to the conversation so that they can help you. "
                    "Please allow them up to 48 hours to get back to you ([guidelines for merchants on Polar](https://polar.sh/docs/merchant-of-record/account-reviews#operational-guidelines))."
                ),
            ),
            (
                "Cancellation Portal",
                (
                    "You can perform the cancellation on the following URL: https://polar.sh/{organization_slug}/portal\n"
                ),
            ),
            (
                "Invoice Generation",
                (
                    "You can generate the invoice on the following URL: https://polar.sh/{organization_slug}/portal\n"
                ),
            ),
            (
                "Follow-up 48 hours",
                (
                    "I'm looping in the {organization_name} team again to the conversation. "
                    "Please allow them another 48 hours to get back to you before we [proceed with the documented resolution](https://polar.sh/docs/merchant-of-record/account-reviews#expected-responsiveness)."
                ),
            ),
            (
                "Follow-up Reply All",
                (
                    "I'm looping in the {organization_name} team again to the conversation. "
                    'Please use "Reply All" so as to keep everyone involved in the conversation.'
                ),
            ),
            (
                "Subscription Cancellation",
                ("I have cancelled the subscription immediately."),
            ),
        ]

        def _get_snippet_container(
            organization: Organization,
        ) -> ComponentContainerInput:
            snippets_rows: list[ComponentContainerContentInput] = [
                ComponentContainerContentInput(
                    component_text=ComponentTextInput(
                        text=f"Snippets for {organization.name}",
                    )
                ),
                ComponentContainerContentInput(
                    component_divider=ComponentDividerInput(
                        divider_spacing_size=ComponentDividerSpacingSize.M
                    )
                ),
            ]
            for i, (snippet_name, snippet_text) in enumerate(snippets):
                text = snippet_text.format(
                    organization_name=organization.name,
                    organization_slug=organization.slug,
                )
                snippets_rows.append(
                    ComponentContainerContentInput(
                        component_row=ComponentRowInput(
                            row_main_content=[
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(
                                        text_size=ComponentTextSize.S,
                                        text_color=ComponentTextColor.MUTED,
                                        text=snippet_name,
                                    ),
                                ),
                                ComponentRowContentInput(
                                    component_text=ComponentTextInput(text=text)
                                ),
                            ],
                            row_aside_content=[
                                ComponentRowContentInput(
                                    component_copy_button=ComponentCopyButtonInput(
                                        copy_button_value=text,
                                        copy_button_tooltip_label="Copy Snippet",
                                    )
                                )
                            ],
                        )
                    )
                )
                if i < len(snippets) - 1:
                    snippets_rows.append(
                        ComponentContainerContentInput(
                            component_spacer=ComponentSpacerInput(
                                spacer_size=ComponentSpacerSize.M
                            )
                        )
                    )

            return ComponentContainerInput(container_content=snippets_rows)

        components: list[ComponentInput] = []
        for i, organization in enumerate(organizations):
            components.append(
                ComponentInput(component_container=_get_snippet_container(organization))
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
            key=CustomerCardKey.snippets,
            timeToLiveSeconds=86400,
            components=[
                component.model_dump(by_alias=True, exclude_none=True)
                for component in components
            ],
        )

    def _get_customer_identifier(
        self,
        customer_result: UpsertCustomerUpsertCustomer,
        email: str,
    ) -> CustomerIdentifierInput:
        """
        Get customer identifier for Plain thread creation.

        Prefers external_id if set on the customer result, otherwise falls back to email.
        This handles cases where external_id might not be set on the Plain customer.
        """
        if customer_result.customer is None:
            raise ValueError(
                "Customer not found when creating thread", customer_result, email
            )

        if customer_result.customer.external_id:
            return CustomerIdentifierInput(
                external_id=customer_result.customer.external_id
            )

        return CustomerIdentifierInput(email_address=email)

    async def _get_or_create_customer(
        self,
        plain: Plain,
        user: User,
    ) -> CustomerIdentifierInput:
        """
        Get or create a Plain customer, handling email changes gracefully.

        1. Try to find by email (handles legacy customers)
        2. If not found, upsert with external_id (handles email changes + new customers)

        This approach avoids duplicate customer creation when users change their email.
        """
        # Step 1: Try read-only lookup by email (handles legacy customers)
        customer = await plain.customer_by_email(email=user.email)

        if customer:
            # Found by email - use external_id if available, otherwise email
            if customer.external_id:
                return CustomerIdentifierInput(external_id=customer.external_id)
            return CustomerIdentifierInput(email_address=user.email)

        # Step 2: Not found by email - upsert with external_id as identifier
        # This handles:
        # - Users who changed their email (finds by external_id, updates email)
        # - New users (creates with external_id)
        customer_result = await plain.upsert_customer(
            UpsertCustomerInput(
                identifier=UpsertCustomerIdentifierInput(external_id=str(user.id)),
                on_create=UpsertCustomerOnCreateInput(
                    external_id=str(user.id),
                    full_name=user.email,
                    email=EmailAddressInput(
                        email=user.email, is_verified=user.email_verified
                    ),
                ),
                on_update=UpsertCustomerOnUpdateInput(
                    email=EmailAddressInput(
                        email=user.email, is_verified=user.email_verified
                    ),
                ),
            )
        )

        if customer_result.error is not None:
            raise PlainCustomerError(user.id, customer_result.error.message)

        return self._get_customer_identifier(customer_result, user.email)

    async def _upsert_customer_id_for_user(self, plain: Plain, user: User) -> str:
        """
        Resolve the Plain customer ID for a Polar user, creating the customer
        if it doesn't exist yet.

        Mirrors `_get_or_create_customer` but returns the concrete Plain
        `customer.id` string, which is required by APIs like `create_note`
        that don't accept the polymorphic `CustomerIdentifierInput`.
        """
        existing = await plain.customer_by_email(email=user.email)
        if existing is not None:
            return existing.id

        customer_result = await plain.upsert_customer(
            UpsertCustomerInput(
                identifier=UpsertCustomerIdentifierInput(external_id=str(user.id)),
                on_create=UpsertCustomerOnCreateInput(
                    external_id=str(user.id),
                    full_name=user.email,
                    email=EmailAddressInput(
                        email=user.email, is_verified=user.email_verified
                    ),
                ),
                on_update=UpsertCustomerOnUpdateInput(
                    email=EmailAddressInput(
                        email=user.email, is_verified=user.email_verified
                    ),
                ),
            )
        )
        if customer_result.error is not None:
            raise PlainCustomerError(user.id, customer_result.error.message)
        if customer_result.customer is None:
            raise PlainCustomerError(user.id, "No customer returned by upsert")
        return customer_result.customer.id

    async def create_feedback_thread(self, feedback: Feedback) -> str:
        """
        Open a Plain thread for a feedback record and attach the original
        feedback message as an internal note. Returns the URL of the new
        thread.

        Requires `feedback.user` to be loaded (e.g. via `joinedload`).
        """
        if not self.enabled:
            raise FeedbackThreadCreationError(
                feedback.id, "Plain integration is disabled"
            )

        noun_by_type = {
            FeedbackType.bug: "bug report",
            FeedbackType.feedback: "feedback",
            FeedbackType.question: "question",
        }
        title = f"Re: your recent {noun_by_type[feedback.type]}"

        async with self._get_plain_client() as plain:
            try:
                customer_id = await self._upsert_customer_id_for_user(
                    plain, feedback.user
                )
            except PlainCustomerError as e:
                raise FeedbackThreadCreationError(feedback.id, e.message) from e

            thread_result = await plain.create_thread(
                CreateThreadInput(
                    customer_identifier=CustomerIdentifierInput(
                        customer_id=customer_id
                    ),
                    title=title,
                )
            )
            if thread_result.error is not None:
                raise FeedbackThreadCreationError(
                    feedback.id, thread_result.error.message
                )
            if thread_result.thread is None:
                raise FeedbackThreadCreationError(
                    feedback.id, "No thread returned by create_thread"
                )

            note_result = await plain.create_note(
                CreateNoteInput(
                    customer_id=customer_id,
                    thread_id=thread_result.thread.id,
                    text=feedback.message,
                )
            )
            if note_result.error is not None:
                raise FeedbackThreadCreationError(
                    feedback.id, note_result.error.message
                )

            return plain_thread_url(thread_result.thread.id)

    async def check_thread_exists(
        self, customer_email: str, thread_title: str, fuzzy: bool = False
    ) -> bool:
        """
        Check if a thread with the given title exists for a customer.
        Only considers threads that are not done/closed.
        """
        if not self.enabled:
            log.warning("Plain integration is disabled, assuming no thread exists")
            return False

        log.info("Checking thread existence", customer_email=customer_email)

        async with self._get_plain_client() as plain:
            user = await plain.customer_by_email(email=customer_email)
            log.info("User found", user_id=user)
            if not user:
                log.warning("User not found", email=customer_email)
                return False
            filters = ThreadsFilter(
                customer_ids=[user.id],
                statuses=[ThreadStatus.TODO, ThreadStatus.SNOOZED],
            )
            threads = await plain.threads(filters=filters)
            nr_threads = 0
            for edge in threads.edges:
                thread = edge.node
                if fuzzy:
                    match = thread_title.lower() in thread.title.lower()
                else:
                    match = thread.title == thread_title
                if match:
                    nr_threads += 1
            log.info(f"There are {nr_threads} threads for user {customer_email}")
            return nr_threads > 0

    @contextlib.asynccontextmanager
    async def _get_plain_client(self) -> AsyncIterator[Plain]:
        async with httpx.AsyncClient(
            headers={"Authorization": f"Bearer {settings.PLAIN_TOKEN}"},
            # Set a MockTransport if not enabled
            # Basically, we disable Plain requests.
            transport=(
                httpx.MockTransport(lambda _: httpx.Response(200))
                if not self.enabled
                else None
            ),
        ) as client:
            async with Plain(
                "https://core-api.uk.plain.com/graphql/v1", http_client=client
            ) as plain:
                yield plain

    async def create_manual_organization_thread(
        self,
        session: AsyncSession,
        organization: Organization,
        admin: User,
        title: str,
    ) -> str:
        """Create a manual thread for an organization with the admin user."""
        if not self.enabled:
            return ""

        async with self._get_plain_client() as plain:
            try:
                customer_identifier = await self._get_or_create_customer(plain, admin)
            except PlainCustomerError as e:
                raise AccountReviewThreadCreationError(
                    organization.id, e.message
                ) from e

            thread_result = await plain.create_thread(
                CreateThreadInput(
                    customer_identifier=customer_identifier,
                    title=title,
                    components=[
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
                                    # Next Review Threshold
                                    ComponentContainerContentInput(
                                        component_row=ComponentRowInput(
                                            row_main_content=[
                                                ComponentRowContentInput(
                                                    component_text=ComponentTextInput(
                                                        text="Next Review Threshold",
                                                        text_size=ComponentTextSize.S,
                                                        text_color=ComponentTextColor.MUTED,
                                                    )
                                                ),
                                                ComponentRowContentInput(
                                                    component_text=ComponentTextInput(
                                                        text=format_currency(
                                                            organization.next_review_threshold,
                                                            "usd",
                                                        )
                                                    )
                                                ),
                                            ],
                                            row_aside_content=[],
                                        )
                                    ),
                                    # Backoffice Link
                                    ComponentContainerContentInput(
                                        component_link_button=ComponentLinkButtonInput(
                                            link_button_url=settings.generate_backoffice_url(
                                                f"/organizations/{organization.id}"
                                            ),
                                            link_button_label="View in Backoffice",
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
                    organization.id, thread_result.error.message
                )

            if thread_result.thread is None:
                raise AccountReviewThreadCreationError(
                    organization.id, "Failed to create thread: no thread returned"
                )

            return thread_result.thread.id


plain = PlainService()
