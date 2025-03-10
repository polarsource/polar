# pyright: reportCallIssue=false
import asyncio
import contextlib
import uuid
from collections.abc import AsyncIterator
from typing import Any

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
from sqlalchemy import func, or_, select
from sqlalchemy.orm import contains_eager

from polar.config import settings
from polar.exceptions import PolarError
from polar.models import (
    Account,
    Customer,
    Order,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.postgres import AsyncSession
from polar.user.service.user import user as user_service

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


class PlainService:
    async def get_cards(
        self, session: AsyncSession, request: CustomerCardsRequest
    ) -> CustomerCardsResponse:
        tasks: list[asyncio.Task[CustomerCard | None]] = []
        async with asyncio.TaskGroup() as tg:
            if CustomerCardKey.organization in request.cardKeys:
                tasks.append(
                    tg.create_task(self._get_organization_card(session, request))
                )
            if CustomerCardKey.customer in request.cardKeys:
                tasks.append(tg.create_task(self.get_customer_card(session, request)))
            if CustomerCardKey.order in request.cardKeys:
                tasks.append(tg.create_task(self._get_order_card(session, request)))

        cards = [card for task in tasks if (card := task.result()) is not None]
        return CustomerCardsResponse(cards=cards)

    async def create_account_review_thread(
        self, session: AsyncSession, account: Account
    ) -> None:
        admin = await user_service.get(session, account.admin_id)
        if admin is None:
            raise AccountAdminDoesNotExistError(account.id)

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
                    account.id, customer_result.error.message
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
                                text=f"The account `{account.id}` should be reviewed, as it hit a threshold. It's used by the following organizations:"
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
                                    f"/backoffice/organizations/{account.organizations[0].id}"
                                ),
                                link_button_label="Review account ↗",
                            )
                        ),
                        *(
                            ComponentInput(
                                component_container=self._get_organization_component_container(
                                    organization
                                )
                            )
                            for organization in account.organizations
                        ),
                    ],
                )
            )
            if thread_result.error is not None:
                raise AccountReviewThreadCreationError(
                    account.id, thread_result.error.message
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
            .join(Customer, Customer.organization_id == Organization.id, isouter=True)
            .where(
                or_(
                    func.lower(Customer.email) == email.lower(),
                    func.lower(User.email) == email.lower(),
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
        self, session: AsyncSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        statement = select(Customer).where(func.lower(Customer.email) == email.lower())
        result = await session.execute(statement)
        customers = result.unique().scalars().all()

        if len(customers) == 0:
            return None

        def _get_customer_container(customer: Customer) -> dict[str, Any]:
            country: pycountry.db.Country | None = None
            if customer.billing_address and customer.billing_address.country:
                country = pycountry.countries.get(
                    alpha_2=customer.billing_address.country
                )
            return {
                "componentContainer": {
                    "containerContent": [
                        {"componentText": {"text": customer.name or customer.email}},
                        {"componentDivider": {"dividerSpacingSize": "M"}},
                        {
                            "componentRow": {
                                "rowMainContent": [
                                    {
                                        "componentText": {
                                            "text": "ID",
                                            "textSize": "S",
                                            "textColor": "MUTED",
                                        }
                                    },
                                    {"componentText": {"text": customer.id}},
                                ],
                                "rowAsideContent": [
                                    {
                                        "componentCopyButton": {
                                            "copyButtonValue": customer.id,
                                            "copyButtonTooltipLabel": "Copy Customer ID",
                                        }
                                    }
                                ],
                            }
                        },
                        {"componentSpacer": {"spacerSize": "M"}},
                        {
                            "componentText": {
                                "text": "Created At",
                                "textSize": "S",
                                "textColor": "MUTED",
                            }
                        },
                        {
                            "componentText": {
                                "text": customer.created_at.date().isoformat()
                            }
                        },
                        *(
                            [
                                {"componentSpacer": {"spacerSize": "M"}},
                                {
                                    "componentRow": {
                                        "rowMainContent": [
                                            {
                                                "componentText": {
                                                    "text": "Country",
                                                    "textSize": "S",
                                                    "textColor": "MUTED",
                                                }
                                            },
                                            {
                                                "componentText": {
                                                    "text": country.name,
                                                }
                                            },
                                        ],
                                        "rowAsideContent": [
                                            {"componentText": {"text": country.flag}}
                                        ],
                                    }
                                },
                            ]
                            if country
                            else []
                        ),
                        {"componentSpacer": {"spacerSize": "M"}},
                        {
                            "componentRow": {
                                "rowMainContent": [
                                    {
                                        "componentText": {
                                            "text": "Stripe Customer ID",
                                            "textSize": "S",
                                            "textColor": "MUTED",
                                        }
                                    },
                                    {
                                        "componentText": {
                                            "text": customer.stripe_customer_id,
                                        }
                                    },
                                ],
                                "rowAsideContent": [
                                    {
                                        "componentLinkButton": {
                                            "linkButtonLabel": "Stripe ↗",
                                            "linkButtonUrl": f"https://dashboard.stripe.com/customers/{customer.stripe_customer_id}",
                                        }
                                    }
                                ],
                            }
                        },
                    ]
                }
            }

        components = []
        for i, customer in enumerate(customers):
            components.append(_get_customer_container(customer))
            if i < len(customers) - 1:
                components.append({"componentDivider": {"dividerSpacingSize": "M"}})

        return CustomerCard(
            key=CustomerCardKey.customer,
            timeToLiveSeconds=86400,
            components=components,
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
                contains_eager(Order.customer),
            )
        )
        result = await session.execute(statement)
        orders = result.unique().scalars().all()

        if len(orders) == 0:
            return None

        def _get_order_container(order: Order) -> dict[str, Any]:
            product = order.product

            return {
                "componentContainer": {
                    "containerContent": [
                        {"componentText": {"text": product.name}},
                        {"componentDivider": {"dividerSpacingSize": "M"}},
                        {
                            "componentRow": {
                                "rowMainContent": [
                                    {
                                        "componentText": {
                                            "text": "ID",
                                            "textSize": "S",
                                            "textColor": "MUTED",
                                        }
                                    },
                                    {"componentText": {"text": order.id}},
                                ],
                                "rowAsideContent": [
                                    {
                                        "componentCopyButton": {
                                            "copyButtonValue": order.id,
                                            "copyButtonTooltipLabel": "Copy Order ID",
                                        }
                                    }
                                ],
                            }
                        },
                        {"componentSpacer": {"spacerSize": "M"}},
                        {
                            "componentText": {
                                "text": "Date",
                                "textSize": "S",
                                "textColor": "MUTED",
                            }
                        },
                        {
                            "componentText": {
                                "text": order.created_at.date().isoformat()
                            }
                        },
                        {"componentSpacer": {"spacerSize": "M"}},
                        {
                            "componentText": {
                                "text": "Billing Reason",
                                "textSize": "S",
                                "textColor": "MUTED",
                            }
                        },
                        {"componentText": {"text": order.billing_reason}},
                        {"componentDivider": {"dividerSpacingSize": "M"}},
                        {"componentSpacer": {"spacerSize": "M"}},
                        {
                            "componentText": {
                                "text": "Amount",
                                "textSize": "S",
                                "textColor": "MUTED",
                            }
                        },
                        {
                            "componentText": {
                                "text": format_currency(
                                    order.amount / 100,
                                    order.currency.upper(),
                                    locale="en_US",
                                )
                            }
                        },
                        {
                            "componentText": {
                                "text": "Tax Amount",
                                "textSize": "S",
                                "textColor": "MUTED",
                            }
                        },
                        {
                            "componentText": {
                                "text": format_currency(
                                    order.tax_amount / 100,
                                    order.currency.upper(),
                                    locale="en_US",
                                )
                            }
                        },
                        {
                            "componentRow": {
                                "rowMainContent": [
                                    {
                                        "componentText": {
                                            "text": "Stripe Invoice ID",
                                            "textSize": "S",
                                            "textColor": "MUTED",
                                        }
                                    },
                                    {
                                        "componentText": {
                                            "text": order.stripe_invoice_id,
                                        }
                                    },
                                ],
                                "rowAsideContent": [
                                    {
                                        "componentLinkButton": {
                                            "linkButtonLabel": "Stripe ↗",
                                            "linkButtonUrl": f"https://dashboard.stripe.com/invoices/{order.stripe_invoice_id}",
                                        }
                                    }
                                ],
                            }
                        },
                    ]
                }
            }

        components = []
        for i, order in enumerate(orders):
            components.append(_get_order_container(order))
            if i < len(orders) - 1:
                components.append({"componentDivider": {"dividerSpacingSize": "M"}})

        return CustomerCard(
            key=CustomerCardKey.order,
            timeToLiveSeconds=86400,
            components=components,
        )

    @contextlib.asynccontextmanager
    async def _get_plain_client(self) -> AsyncIterator[Plain]:
        async with Plain(
            "https://core-api.uk.plain.com/graphql/v1",
            {"Authorization": f"Bearer {settings.PLAIN_TOKEN}"},
        ) as plain:
            yield plain


plain = PlainService()
