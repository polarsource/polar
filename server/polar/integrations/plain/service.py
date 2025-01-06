import asyncio

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
        organization = result.unique().scalar_one_or_none()

        if organization is None:
            return None

        return CustomerCard(
            key=CustomerCardKey.organization,
            timeToLiveSeconds=86400,
            components=[
                {
                    "componentContainer": {
                        "containerContent": [
                            {
                                "componentRow": {
                                    "rowMainContent": [
                                        {"componentText": {"text": organization.name}},
                                        {
                                            "componentText": {
                                                "text": organization.slug,
                                                "textColor": "MUTED",
                                            }
                                        },
                                    ],
                                    "rowAsideContent": [
                                        {
                                            "componentLinkButton": {
                                                "linkButtonLabel": "Omni ↗",
                                                "linkButtonUrl": "https://example.com",
                                            }
                                        }
                                    ],
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
            ],
        )

    async def get_customer_card(
        self, session: AsyncSession, request: CustomerCardsRequest
    ) -> CustomerCard | None:
        email = request.customer.email

        statement = select(Customer).where(func.lower(Customer.email) == email.lower())
        result = await session.execute(statement)
        customer = result.unique().scalar_one_or_none()

        if customer is None:
            return None

        country: pycountry.db.Country | None = None
        if customer.billing_address and customer.billing_address.country:
            country = pycountry.countries.get(alpha_2=customer.billing_address.country)

        return CustomerCard(
            key=CustomerCardKey.customer,
            timeToLiveSeconds=86400,
            components=[
                {
                    "componentContainer": {
                        "containerContent": [
                            {
                                "componentRow": {
                                    "rowMainContent": [
                                        {"componentText": {"text": customer.name}},
                                    ],
                                    "rowAsideContent": [
                                        {
                                            "componentLinkButton": {
                                                "linkButtonLabel": "Omni ↗",
                                                "linkButtonUrl": "https://example.com",
                                            }
                                        }
                                    ],
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
                                                {
                                                    "componentText": {
                                                        "text": country.flag
                                                    }
                                                }
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
            ],
        )


plain = PlainService()
