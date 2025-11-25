import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import UUID4
from sqlalchemy import func, or_
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import document, tag, text

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import customer_session as customer_session_service
from polar.kit.pagination import PaginationParamsQuery
from polar.models import Customer, Order, Organization, Product, Subscription
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.sorting import SubscriptionSortProperty
from polar.wallet.service import wallet as wallet_service

from ..components import button, datatable, description_list, modal
from ..formatters import currency
from ..layout import layout
from ..orders.components import orders_datatable
from .components import customers_datatable, email_verified_badge

router = APIRouter()


@router.get("/", name="customers:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    query: str | None = Query(None),
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = CustomerRepository.from_session(session)
    statement = (
        repository.get_base_statement()
        .join(Organization, Customer.organization_id == Organization.id)
        .options(contains_eager(Customer.organization))
    )

    if query is not None:
        try:
            parsed_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(
                    Customer.id == parsed_uuid,
                    Organization.id == parsed_uuid,
                )
            )
        except ValueError:
            query_lower = query.lower()
            statement = statement.where(
                or_(
                    func.lower(Customer.email).ilike(f"%{query_lower}%"),
                    func.lower(Customer.name).ilike(f"%{query_lower}%"),
                    func.lower(Customer.external_id).ilike(f"%{query_lower}%"),
                    func.lower(Organization.slug).ilike(f"%{query_lower}%"),
                    func.lower(Organization.name).ilike(f"%{query_lower}%"),
                )
            )

    statement = statement.order_by(Customer.created_at.desc())
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Customers", str(request.url_for("customers:list"))),
        ],
        "customers:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Customers")
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with tag.input(
                    type="search",
                    name="query",
                    value=query or "",
                    placeholder="Search by email, ID, external ID, or organization...",
                    classes="input input-bordered flex-1",
                ):
                    pass
                with button(type="submit"):
                    text("Search")
            with customers_datatable(request, items):
                pass
            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="customers:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    customer_repository = CustomerRepository.from_session(session)
    customer = await customer_repository.get_by_id(
        id,
        options=(joinedload(Customer.organization),),
    )

    if customer is None:
        raise HTTPException(status_code=404)

    # Get subscriptions
    subscription_repository = SubscriptionRepository.from_session(session)
    subscriptions_statement = (
        subscription_repository.get_base_statement()
        .where(Subscription.customer_id == customer.id)
        .join(Product, Subscription.product_id == Product.id)
        .join(Organization, Product.organization_id == Organization.id)
        .options(
            contains_eager(Subscription.product).contains_eager(Product.organization)
        )
        .order_by(Subscription.started_at.desc())
    )
    subscriptions = await subscription_repository.get_all(subscriptions_statement)

    # Get orders
    order_repository = OrderRepository.from_session(session)
    orders_statement = (
        order_repository.get_base_statement()
        .where(Order.customer_id == customer.id)
        .options(joinedload(Order.customer))
        .order_by(Order.created_at.desc())
        .limit(50)
    )
    orders = await order_repository.get_all(orders_statement)

    # Get credit balance
    credit_balance = await wallet_service.get_billing_wallet_balance(
        session, customer, "usd"
    )

    with layout(
        request,
        [
            (customer.email, str(request.url)),
            ("Customers", str(request.url_for("customers:list"))),
        ],
        "customers:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text(customer.email)
                with button(
                    hx_get=str(
                        request.url_for(
                            "customers:generate_portal_link_modal", id=customer.id
                        )
                    ),
                    hx_target="#modal",
                    variant="primary",
                ):
                    text("Generate Portal Link")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Customer Details
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Customer Details")
                        with description_list.DescriptionList[Customer](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "email", "Email", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem("name", "Name"),
                            description_list.DescriptionListAttrItem(
                                "external_id", "External ID", clipboard=True
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created At"
                            ),
                        ).render(request, customer):
                            pass

                # Organization
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Organization")
                        with description_list.DescriptionList[Customer](
                            description_list.DescriptionListLinkItem[Customer](
                                "organization.name",
                                "Name",
                                href_getter=lambda r, i: str(
                                    r.url_for("organizations:get", id=i.organization_id)
                                ),
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization.slug", "Slug"
                            ),
                        ).render(request, customer):
                            pass

                # Billing Information
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Billing Information")
                        with description_list.DescriptionList[Customer](
                            description_list.DescriptionListAttrItem(
                                "billing_name", "Billing Name"
                            ),
                            description_list.DescriptionListAttrItem(
                                "tax_id", "Tax ID"
                            ),
                        ).render(request, customer):
                            pass

                        if customer.billing_address:
                            with tag.div(classes="mt-4"):
                                with tag.h3(classes="text-lg font-semibold mb-2"):
                                    text("Billing Address")
                                with description_list.DescriptionList[Customer](
                                    description_list.DescriptionListAttrItem(
                                        "billing_address.line1", "Address Line 1"
                                    ),
                                    description_list.DescriptionListAttrItem(
                                        "billing_address.line2", "Address Line 2"
                                    ),
                                    description_list.DescriptionListAttrItem(
                                        "billing_address.city", "City"
                                    ),
                                    description_list.DescriptionListAttrItem(
                                        "billing_address.state", "State"
                                    ),
                                    description_list.DescriptionListAttrItem(
                                        "billing_address.postal_code", "Postal Code"
                                    ),
                                    description_list.DescriptionListAttrItem(
                                        "billing_address.country", "Country"
                                    ),
                                ).render(request, customer):
                                    pass

                # Stripe Information
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Stripe Information")
                        if customer.stripe_customer_id:
                            with description_list.DescriptionList[Customer](
                                description_list.DescriptionListLinkItem[Customer](
                                    "stripe_customer_id",
                                    "Stripe Customer ID",
                                    href_getter=lambda _,
                                    i: f"https://dashboard.stripe.com/customers/{i.stripe_customer_id}",
                                    external=True,
                                ),
                            ).render(request, customer):
                                pass
                        else:
                            with tag.p(classes="text-gray-500"):
                                text("No Stripe customer linked")

                        with tag.div(classes="mt-4"):
                            with tag.div(classes="flex items-center gap-2"):
                                with tag.span(classes="font-semibold"):
                                    text("Email Verified:")
                                with email_verified_badge(customer.email_verified):
                                    pass

                # Credit Balance
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Credit Balance")
                        with tag.div(classes="flex items-center gap-2"):
                            with tag.span(classes="font-semibold"):
                                text("Available Balance:")
                            balance_classes = (
                                "text-lg text-success"
                                if credit_balance > 0
                                else "text-lg"
                            )
                            with tag.span(classes=balance_classes):
                                text(currency(credit_balance, "usd"))

            # Subscriptions Section
            with tag.div(classes="mt-8"):
                with tag.div(classes="flex items-center gap-4 mb-4"):
                    with tag.h2(classes="text-2xl font-bold"):
                        text(f"Subscriptions ({len(subscriptions)})")

                if subscriptions:
                    with datatable.Datatable[Subscription, SubscriptionSortProperty](
                        datatable.DatatableAttrColumn(
                            "id",
                            "ID",
                            clipboard=True,
                            href_route_name="subscriptions:get",
                        ),
                        datatable.DatatableAttrColumn("status", "Status"),
                        datatable.DatatableAttrColumn("product.name", "Product"),
                        datatable.DatatableDateTimeColumn("started_at", "Started At"),
                        datatable.DatatableDateTimeColumn(
                            "current_period_end", "Current Period End"
                        ),
                    ).render(request, subscriptions):
                        pass
                else:
                    with tag.div(classes="text-center py-8 text-gray-500"):
                        text("No subscriptions found")

            # Orders Section
            with tag.div(classes="mt-8"):
                with tag.div(classes="flex items-center gap-4 mb-4"):
                    with tag.h2(classes="text-2xl font-bold"):
                        text(f"Orders ({len(orders)})")

                if orders:
                    with orders_datatable(request, orders):
                        pass
                else:
                    with tag.div(classes="text-center py-8 text-gray-500"):
                        text("No orders found")


@router.get(
    "/{id}/generate_portal_link_modal", name="customers:generate_portal_link_modal"
)
async def generate_portal_link_modal(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    customer_repository = CustomerRepository.from_session(session)
    customer = await customer_repository.get_by_id(
        id, options=(joinedload(Customer.organization),)
    )

    if customer is None:
        raise HTTPException(status_code=404)

    if not customer.organization:
        raise HTTPException(
            status_code=500, detail="Customer organization not properly loaded"
        )

    # Generate customer session token
    token, customer_session = await customer_session_service.create_customer_session(
        session, customer
    )

    # Construct portal URL with organization slug
    frontend_base_url = str(settings.FRONTEND_BASE_URL).rstrip("/")
    org_slug = customer.organization.slug
    portal_url = (
        f"{frontend_base_url}/{org_slug}/portal/overview?customer_session_token={token}"
    )

    # Calculate actual expiration time from settings
    expires_in_hours = int(settings.CUSTOMER_SESSION_TTL.total_seconds() / 3600)
    if expires_in_hours < 1:
        expires_in_minutes = int(settings.CUSTOMER_SESSION_TTL.total_seconds() / 60)
        expiration_message = f"{expires_in_minutes} minutes"
    else:
        expiration_message = (
            f"{expires_in_hours} hour{'s' if expires_in_hours != 1 else ''}"
        )

    with document() as doc:
        with tag.div(id="modal"):
            with modal("Customer Portal Link Generated", open=True):
                with tag.div(classes="alert alert-info mb-4"):
                    with tag.div():
                        with tag.p(classes="text-sm"):
                            text(
                                f"This link will expire in {expiration_message}. "
                                "The customer can use this link to access their portal."
                            )

                with tag.div(classes="form-control w-full mb-4"):
                    with tag.label(classes="label"):
                        with tag.span(classes="label-text font-semibold"):
                            text("Portal URL")
                    with tag.div(classes="flex gap-2 items-center"):
                        with tag.input(
                            type="text",
                            value=portal_url,
                            readonly=True,
                            classes="input input-bordered flex-1 font-mono text-sm",
                        ):
                            pass
                        with tag.a(
                            href=portal_url,
                            target="_blank",
                            rel="noopener noreferrer",
                            classes="btn btn-primary",
                        ):
                            text("Open Portal")

                with tag.div(classes="modal-action"):
                    with tag.form(method="dialog"):
                        with button(variant="primary"):
                            text("Done")

    return HTMLResponse(str(doc))
