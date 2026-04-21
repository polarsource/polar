import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import UUID4
from sqlalchemy.orm import joinedload
from tagflow import tag, text

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.license_key.repository import LicenseKeyRepository
from polar.models import BenefitGrant, LicenseKey
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession, get_db_read_session

from ..components import description_list
from ..layout import layout

router = APIRouter()


@router.get("/{id}", name="benefit_grants:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> Any:
    repository = BenefitGrantRepository.from_session(session)
    grant = await repository.get_by_id(
        id,
        options=(
            joinedload(BenefitGrant.benefit),
            joinedload(BenefitGrant.customer),
            joinedload(BenefitGrant.subscription),
            joinedload(BenefitGrant.order),
        ),
    )

    if grant is None:
        raise HTTPException(status_code=404)

    license_key: LicenseKey | None = None
    if grant.benefit.type == BenefitType.license_keys:
        license_key_id = grant.properties.get("license_key_id")
        if license_key_id:
            license_key_repository = LicenseKeyRepository.from_session(session)
            license_key = await license_key_repository.get_by_id(UUID(license_key_id))

    with layout(
        request,
        [
            (f"Grant {grant.id}", str(request.url)),
            (
                f"Customer {grant.customer.display_name}",
                str(request.url_for("customers:get", id=grant.customer_id)),
            ),
            ("Customers", str(request.url_for("customers:list"))),
        ],
        "benefit_grants:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text(f"Benefit Grant {grant.id}")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Grant details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Grant Details")
                        with description_list.DescriptionList[BenefitGrant](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "granted_at", "Granted At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "revoked_at", "Revoked At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "modified_at", "Modified At"
                            ),
                        ).render(request, grant):
                            pass

                # Benefit
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Benefit")
                        with description_list.DescriptionList[BenefitGrant](
                            description_list.DescriptionListLinkItem[BenefitGrant](
                                "benefit_id",
                                "ID",
                                clipboard=True,
                                href_getter=lambda r, i: str(
                                    r.url_for("benefits:get", id=i.benefit_id)
                                ),
                            ),
                            description_list.DescriptionListAttrItem(
                                "benefit.description", "Description"
                            ),
                            description_list.DescriptionListAttrItem(
                                "benefit.type", "Type"
                            ),
                        ).render(request, grant):
                            pass

                # Customer
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Customer")
                        with description_list.DescriptionList[BenefitGrant](
                            description_list.DescriptionListLinkItem[BenefitGrant](
                                "customer_id",
                                "ID",
                                clipboard=True,
                                href_getter=lambda r, i: str(
                                    r.url_for("customers:get", id=i.customer_id)
                                ),
                            ),
                            description_list.DescriptionListAttrItem(
                                "customer.email", "Email", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "customer.name", "Name"
                            ),
                        ).render(request, grant):
                            pass

                # Scope
                if grant.subscription_id or grant.order_id:
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Scope")
                            items: list[
                                description_list.DescriptionListItem[BenefitGrant]
                            ] = []
                            if grant.subscription_id:
                                items.append(
                                    description_list.DescriptionListLinkItem[
                                        BenefitGrant
                                    ](
                                        "subscription_id",
                                        "Subscription",
                                        clipboard=True,
                                        href_getter=lambda r, i: str(
                                            r.url_for(
                                                "subscriptions:get",
                                                id=i.subscription_id,
                                            )
                                        ),
                                    )
                                )
                            if grant.order_id:
                                items.append(
                                    description_list.DescriptionListLinkItem[
                                        BenefitGrant
                                    ](
                                        "order_id",
                                        "Order",
                                        clipboard=True,
                                        href_getter=lambda r, i: str(
                                            r.url_for(
                                                "orders:get", id=i.order_id
                                            )
                                        ),
                                    )
                                )
                            with description_list.DescriptionList[BenefitGrant](
                                *items
                            ).render(request, grant):
                                pass

            # License key details if applicable
            if license_key is not None:
                with tag.div(classes="flex flex-col gap-4 pt-8"):
                    with tag.h2(classes="text-2xl"):
                        text("License Key")
                    with description_list.DescriptionList[LicenseKey](
                        description_list.DescriptionListAttrItem(
                            "id", "ID", clipboard=True
                        ),
                        description_list.DescriptionListAttrItem(
                            "key", "Key", clipboard=True
                        ),
                        description_list.DescriptionListAttrItem("status", "Status"),
                        description_list.DescriptionListAttrItem("usage", "Usage"),
                        description_list.DescriptionListAttrItem(
                            "limit_usage", "Usage Limit"
                        ),
                        description_list.DescriptionListAttrItem(
                            "limit_activations", "Activations Limit"
                        ),
                        description_list.DescriptionListAttrItem(
                            "validations", "Validations"
                        ),
                        description_list.DescriptionListDateTimeItem(
                            "last_validated_at", "Last Validated At"
                        ),
                        description_list.DescriptionListDateTimeItem(
                            "expires_at", "Expires At"
                        ),
                    ).render(request, license_key):
                        pass

            # Properties
            with tag.div(classes="flex flex-col gap-4 pt-8"):
                with tag.h2(classes="text-2xl"):
                    text("Properties")
                with tag.div(classes="bg-gray-50 p-4 rounded-lg"):
                    with tag.pre(classes="whitespace-pre-wrap text-sm"):
                        text(json.dumps(grant.properties, indent=2))

            # Error if any
            if grant.error:
                with tag.div(classes="flex flex-col gap-4 pt-8"):
                    with tag.h2(classes="text-2xl"):
                        text("Error")
                    with tag.div(classes="bg-red-50 p-4 rounded-lg"):
                        with tag.pre(classes="whitespace-pre-wrap text-sm"):
                            text(json.dumps(grant.error, indent=2))
