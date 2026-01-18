import builtins
import uuid
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from markupflow import Fragment
from pydantic import UUID4, BeforeValidator
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from polar.benefit import sorting
from polar.benefit.repository import BenefitRepository
from polar.benefit.sorting import BenefitSortProperty
from polar.benefit.strategies.github_repository.properties import (
    BenefitGitHubRepositoryProperties,
)
from polar.integrations.github import client as github
from polar.integrations.github_repository_benefit.service import (
    github_repository_benefit_user_service,
)
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession, get_db_read_session, get_db_session

from ..components import button, datatable, description_list, input
from ..layout import layout

router = APIRouter()


class BenefitTypeColumn(datatable.DatatableAttrColumn[Benefit, BenefitSortProperty]):
    def get_value(self, item: Benefit) -> str | None:
        return item.type.get_display_name()


class BenefitTypeDescriptionListItem(description_list.DescriptionListAttrItem[Benefit]):
    def get_value(self, item: Benefit) -> str | None:
        return item.type.get_display_name()


class OrganizationColumn(datatable.DatatableAttrColumn[Benefit, BenefitSortProperty]):
    def __init__(self) -> None:
        super().__init__("organization.name", "Organization")
        self.href_getter = lambda r, i: str(
            r.url_for("organizations:get", id=i.organization_id)
        )


@router.get("/", name="benefits:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    benefit_type: Annotated[
        BenefitType | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    session: AsyncSession = Depends(get_db_read_session),
) -> Fragment:
    repository = BenefitRepository.from_session(session)
    statement = repository.get_base_statement().options(
        joinedload(Benefit.organization)
    )

    if query:
        try:
            query_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(Benefit.id == query_uuid, Benefit.organization_id == query_uuid)
            )
        except ValueError:
            statement = statement.where(Benefit.description.ilike(f"%{query}%"))

    if benefit_type:
        statement = statement.where(Benefit.type == benefit_type)

    statement = repository.apply_sorting(statement, sorting)

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("Benefits", str(request.url_for("benefits:list"))),
        ],
        "benefits:list",
    ) as page:
        with page.div(class_="flex flex-col gap-4"):
            with page.h1(class_="text-4xl"):
                page.text("Benefits")

            # Filters
            with page.form(method="GET", class_="w-full flex flex-row gap-2"):
                with input.search(
                    "query", query, placeholder="Search by ID, Organization ID, or name"
                ):
                    pass
                with input.select(
                    [
                        ("All Types", ""),
                        *[
                            (
                                benefit_type.value.replace("_", " ").title(),
                                benefit_type.value,
                            )
                            for benefit_type in BenefitType
                        ],
                    ],
                    benefit_type.value if benefit_type else "",
                    name="benefit_type",
                ):
                    pass
                with button(type="submit"):
                    pass

            # Results table
            with datatable.Datatable[Benefit, BenefitSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="benefits:get", clipboard=True
                ),
                datatable.DatatableDateTimeColumn(
                    "created_at",
                    "Created At",
                    sorting=BenefitSortProperty.created_at,
                ),
                BenefitTypeColumn("type", "Type", sorting=BenefitSortProperty.type),
                datatable.DatatableAttrColumn(
                    "description",
                    "Description",
                    sorting=BenefitSortProperty.description,
                ),
                OrganizationColumn(),
            ).render(request, items, sorting=sorting):
                pass

            with datatable.pagination(request, pagination, count):
                pass
    return page


async def _get_github_repository_invitations(
    benefit: Benefit,
) -> builtins.list[dict[str, Any]]:
    """Get pending GitHub repository invitations for a benefit."""
    if benefit.type != BenefitType.github_repository:
        return []

    try:
        properties = cast(BenefitGitHubRepositoryProperties, benefit.properties)
        repository_owner = properties["repository_owner"]
        repository_name = properties["repository_name"]

        # Get installation for the repository
        installation = (
            await github_repository_benefit_user_service.get_repository_installation(
                owner=repository_owner, name=repository_name
            )
        )
        if not installation:
            return []

        # Get GitHub client for the installation
        async with github.get_app_installation_client(installation.id) as client:
            invitations = []
            async for invitation in client.paginate(
                client.rest.repos.async_list_invitations,
                owner=repository_owner,
                repo=repository_name,
            ):
                invitation_data = {
                    "id": invitation.id,
                    "invitee_login": invitation.invitee.login
                    if invitation.invitee
                    else None,
                    "invitee_id": invitation.invitee.id if invitation.invitee else None,
                    "permissions": invitation.permissions,
                    "created_at": invitation.created_at,
                }
                invitations.append(invitation_data)

            return invitations
    except Exception:
        # If we can't fetch invitations, return empty list
        return []


@router.get("/{id}", name="benefits:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Fragment:
    repository = BenefitRepository.from_session(session)
    benefit = await repository.get_by_id(id)

    if benefit is None:
        raise HTTPException(status_code=404)

    # Get GitHub invitations if it's a GitHub repository benefit
    github_invitations = []
    if benefit.type == BenefitType.github_repository:
        github_invitations = await _get_github_repository_invitations(benefit)

    with layout(
        request,
        [
            (f"Benefit {benefit.description}", str(request.url)),
            ("Benefits", str(request.url_for("benefits:list"))),
        ],
        "benefits:get",
    ) as page:
        with page.div(class_="flex flex-col gap-4"):
            with page.div(class_="flex flex-row items-center gap-2"):
                with page.h1(class_="text-4xl"):
                    page.text(benefit.description)

            # Benefit details
            with description_list.DescriptionList[Benefit](
                description_list.DescriptionListAttrItem("id", "ID", clipboard=True),
                BenefitTypeDescriptionListItem("type", "Type"),
                description_list.DescriptionListAttrItem("description", "Description"),
                description_list.DescriptionListAttrItem(
                    "organization_id", "Organization ID", clipboard=True
                ),
                description_list.DescriptionListDateTimeItem(
                    "created_at", "Created At"
                ),
                description_list.DescriptionListDateTimeItem(
                    "modified_at", "Modified At"
                ),
            ).render(request, benefit):
                pass

            # Properties section
            with page.div(class_="flex flex-col gap-4 pt-8"):
                with page.h2(class_="text-2xl"):
                    page.text("Properties")
                with page.div(class_="bg-gray-50 p-4 rounded-lg"):
                    with page.pre(class_="whitespace-pre-wrap text-sm"):
                        import json

                        page.text(json.dumps(benefit.properties, indent=2))

            # GitHub repository invitations section
            if benefit.type == BenefitType.github_repository:
                with page.div(class_="flex flex-col gap-4 pt-8"):
                    with page.h2(class_="text-2xl"):
                        page.text("Pending GitHub Repository Invitations")
                    if not github_invitations:
                        with page.div(class_="text-gray-500"):
                            page.text("No pending invitations found for this repository.")
                    else:
                        with page.div(class_="overflow-x-auto"):
                            with page.table(class_="table table-zebra w-full"):
                                with page.thead():
                                    with page.tr():
                                        with page.th():
                                            page.text("ID")
                                        with page.th():
                                            page.text("Invitee")
                                        with page.th():
                                            page.text("GitHub ID")
                                        with page.th():
                                            page.text("Permissions")
                                        with page.th():
                                            page.text("Created At")
                                with page.tbody():
                                    for invitation in github_invitations:
                                        with page.tr():
                                            with page.td():
                                                page.text(str(invitation["id"]))
                                            with page.td():
                                                page.text(
                                                    invitation["invitee_login"] or "N/A"
                                                )
                                            with page.td():
                                                page.text(
                                                    str(invitation["invitee_id"])
                                                    if invitation["invitee_id"]
                                                    else "N/A"
                                                )
                                            with page.td():
                                                page.text(invitation["permissions"])
                                            with page.td():
                                                if invitation["created_at"]:
                                                    page.text(
                                                        invitation[
                                                            "created_at"
                                                        ].strftime("%Y-%m-%d %H:%M:%S")
                                                    )
                                                else:
                                                    page.text("N/A")
    return page
