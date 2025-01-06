import asyncio
from typing import Any

import pycountry
import pycountry.db
from sqlalchemy import func, or_, select

from polar.models import Customer, Organization, User, UserOrganization
from polar.postgres import AsyncSession

from .schemas import (
    CustomerCard,
    CustomerCardKey,
    CustomerCardsRequest,
    CustomerCardsResponse,
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

        cards = [card for task in tasks if (card := task.result()) is not None]
        return CustomerCardsResponse(cards=cards)

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

        def _get_organization_container(organization: Organization) -> dict[str, Any]:
            return {
                "componentContainer": {
                    "containerContent": [
                        {"componentText": {"text": organization.name}},
                        {
                            "componentText": {
                                "text": organization.slug,
                                "textColor": "MUTED",
                            }
                        },
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
                                    {"componentText": {"text": organization.id}},
                                ],
                                "rowAsideContent": [
                                    {
                                        "componentCopyButton": {
                                            "copyButtonValue": organization.id,
                                            "copyButtonTooltipLabel": "Copy Organization ID",
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
                                "text": organization.created_at.date().isoformat()
                            }
                        },
                    ]
                }
            }

        components = []
        for i, organization in enumerate(organizations):
            components.append(_get_organization_container(organization))
            if i < len(organizations) - 1:
                components.append({"componentDivider": {"dividerSpacingSize": "M"}})

        return CustomerCard(
            key=CustomerCardKey.organization,
            timeToLiveSeconds=86400,
            components=components,
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
                        {"componentText": {"text": customer.name}},
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


plain = PlainService()
