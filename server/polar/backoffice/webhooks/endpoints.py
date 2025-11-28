import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4
from sqlalchemy import or_
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import attr, tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.models import Organization, WebhookEndpoint
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.webhook.repository import WebhookEndpointRepository
from polar.webhook.schemas import WebhookEndpointUpdate
from polar.webhook.service import webhook as webhook_service
from polar.webhook.sorting import WebhookSortProperty

from ..components import button, confirmation_dialog, datatable, description_list, input
from ..layout import layout
from ..toast import add_toast

router = APIRouter()


@router.get("/", name="webhooks:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    query: str | None = Query(None),
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = WebhookEndpointRepository.from_session(session)
    statement = (
        repository.get_base_statement()
        .join(Organization, WebhookEndpoint.organization_id == Organization.id)
        .options(contains_eager(WebhookEndpoint.organization))
        .order_by(WebhookEndpoint.created_at.desc())
    )

    if query:
        try:
            query_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(
                    WebhookEndpoint.id == query_uuid,
                    WebhookEndpoint.organization_id == query_uuid,
                )
            )
        except ValueError:
            statement = statement.where(
                or_(
                    WebhookEndpoint.url.ilike(f"%{query}%"),
                    Organization.slug.ilike(f"%{query}%"),
                    Organization.name.ilike(f"%{query}%"),
                )
            )

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Webhooks", str(request.url_for("webhooks:list"))),
        ],
        "webhooks:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Webhooks")

            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    "query",
                    query,
                    placeholder="Search by ID, URL, organization name/slug",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            with datatable.Datatable[WebhookEndpoint, WebhookSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="webhooks:get", clipboard=True
                ),
                datatable.DatatableDateTimeColumn("created_at", "Created At"),
                datatable.DatatableAttrColumn("url", "URL"),
                datatable.DatatableAttrColumn("format", "Format"),
                datatable.DatatableAttrColumn("enabled", "Enabled"),
                datatable.DatatableAttrColumn(
                    "organization.name",
                    "Organization",
                    external_href=lambda r, i: str(
                        r.url_for("organizations:get", id=i.organization_id)
                    ),
                ),
            ).render(request, items):
                pass

            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="webhooks:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = WebhookEndpointRepository.from_session(session)
    webhook = await repository.get_by_id(
        id,
        options=(joinedload(WebhookEndpoint.organization),),
    )

    if webhook is None:
        raise HTTPException(status_code=404)

    with layout(
        request,
        [
            (f"{webhook.url}", str(request.url)),
            ("Webhooks", str(request.url_for("webhooks:list"))),
        ],
        "webhooks:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text(f"Webhook: {webhook.url}")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Webhook Details")
                        with tag.div(id="webhook-details-list"):
                            with description_list.DescriptionList[WebhookEndpoint](
                                description_list.DescriptionListAttrItem(
                                    "id", "ID", clipboard=True
                                ),
                                description_list.DescriptionListAttrItem("url", "URL"),
                                description_list.DescriptionListAttrItem(
                                    "format", "Format"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "enabled", "Enabled"
                                ),
                                description_list.DescriptionListDateTimeItem(
                                    "created_at", "Created At"
                                ),
                                description_list.DescriptionListDateTimeItem(
                                    "modified_at", "Modified At"
                                ),
                            ).render(request, webhook):
                                pass

                        with tag.div(classes="divider"):
                            pass

                        with tag.div(
                            id="webhook-enabled-status",
                            classes="flex items-center justify-between",
                        ):
                            with tag.span(classes="label-text font-medium"):
                                text("Enabled")
                            with button(
                                variant="success" if webhook.enabled else "neutral",
                                size="sm",
                                hx_get=str(
                                    request.url_for(
                                        "webhooks:confirm_toggle_enabled", id=webhook.id
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Enabled" if webhook.enabled else "Disabled")

                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Organization")
                        with description_list.DescriptionList[WebhookEndpoint](
                            description_list.DescriptionListLinkItem[WebhookEndpoint](
                                "organization.name",
                                "Name",
                                href_getter=lambda r, i: str(
                                    r.url_for("organizations:get", id=i.organization_id)
                                ),
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization.slug", "Slug"
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization_id", "ID", clipboard=True
                            ),
                        ).render(request, webhook):
                            pass

            with tag.div(classes="flex flex-col gap-4 pt-8"):
                with tag.h2(classes="text-2xl"):
                    text("Subscribed Events")
                if not webhook.events:
                    with tag.div(classes="text-gray-500"):
                        text("No events subscribed")
                else:
                    with tag.div(classes="overflow-x-auto"):
                        with tag.table(classes="table table-zebra w-full"):
                            with tag.thead():
                                with tag.tr():
                                    with tag.th():
                                        text("Event Type")
                            with tag.tbody():
                                for event in webhook.events:
                                    with tag.tr():
                                        with tag.td():
                                            text(event)


@router.get("/{id}/confirm-toggle-enabled", name="webhooks:confirm_toggle_enabled")
async def confirm_toggle_enabled(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = WebhookEndpointRepository.from_session(session)
    webhook = await repository.get_by_id(id)

    if webhook is None:
        raise HTTPException(status_code=404)

    action = "disable" if webhook.enabled else "enable"
    with confirmation_dialog(
        title=f"{action.capitalize()} Webhook",
        message=f"Are you sure you want to {action} this webhook endpoint? "
        + (
            "It will stop receiving events."
            if webhook.enabled
            else "It will start receiving events again."
        ),
        variant="warning",
        confirm_text=action.capitalize(),
        open=True,
    ):
        attr(
            "hx-post",
            str(request.url_for("webhooks:toggle_enabled", id=webhook.id)),
        )
        attr("hx-target", "#modal")


@router.post("/{id}/toggle-enabled", name="webhooks:toggle_enabled")
async def toggle_enabled(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = WebhookEndpointRepository.from_session(session)
    webhook = await repository.get_by_id(id)

    if webhook is None:
        raise HTTPException(status_code=404)

    update_schema = WebhookEndpointUpdate(enabled=not webhook.enabled)
    webhook = await webhook_service.update_endpoint(
        session, endpoint=webhook, update_schema=update_schema
    )
    await session.flush()

    await add_toast(
        request,
        f"Webhook {'enabled' if webhook.enabled else 'disabled'} successfully",
        "success",
    )

    with tag.div(id="modal"):
        pass

    with tag.div(id="webhook-details-list"):
        attr("hx-swap-oob", "true")
        with description_list.DescriptionList[WebhookEndpoint](
            description_list.DescriptionListAttrItem("id", "ID", clipboard=True),
            description_list.DescriptionListAttrItem("url", "URL"),
            description_list.DescriptionListAttrItem("format", "Format"),
            description_list.DescriptionListAttrItem("enabled", "Enabled"),
            description_list.DescriptionListDateTimeItem("created_at", "Created At"),
            description_list.DescriptionListDateTimeItem("modified_at", "Modified At"),
        ).render(request, webhook):
            pass

    with tag.div(
        id="webhook-enabled-status",
        classes="flex items-center justify-between",
    ):
        attr("hx-swap-oob", "true")
        with tag.span(classes="label-text font-medium"):
            text("Enabled")
        with button(
            variant="success" if webhook.enabled else "neutral",
            size="sm",
            hx_get=str(
                request.url_for("webhooks:confirm_toggle_enabled", id=webhook.id)
            ),
            hx_target="#modal",
        ):
            text("Enabled" if webhook.enabled else "Disabled")
