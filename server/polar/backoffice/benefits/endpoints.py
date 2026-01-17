import builtins
import uuid
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from polar.backoffice.document import get_document
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
) -> None:
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

    doc = get_document(request)
    with layout(
        request,
        [
            ("Benefits", str(request.url_for("benefits:list"))),
        ],
        "benefits:list",
    ):
        with doc.div(classes="flex flex-col gap-4"):
            with doc.h1(classes="text-4xl"):
                doc.doc.text("Benefits")

            # Filters
            with doc.form(method="GET", classes="w-full flex flex-row gap-2"):
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
                    doc.text("Filter")

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
) -> Any:
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
    ):
        with doc.div(classes="flex flex-col gap-4"):
            with doc.div(classes="flex flex-row items-center gap-2"):
                with doc.h1(classes="text-4xl"):
                    doc.text(benefit.description)

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
            with doc.div(classes="flex flex-col gap-4 pt-8"):
                with doc.h2(classes="text-2xl"):
                    doc.text("Properties")
                with doc.div(classes="bg-gray-50 p-4 rounded-lg"):
                    with doc.pre(classes="whitespace-pre-wrap text-sm"):
                        import json

                        doc.text(json.dumps(benefit.properties, indent=2))

            # GitHub repository invitations section
            if benefit.type == BenefitType.github_repository:
                with doc.div(classes="flex flex-col gap-4 pt-8"):
                    with doc.h2(classes="text-2xl"):
                        doc.text("Pending GitHub Repository Invitations")
                    if not github_invitations:
                        with doc.div(classes="text-gray-500"):
                            doc.text(
                                "No pending invitations found for this repository."
                            )
                    else:
                        with doc.div(classes="overflow-x-auto"):
                            with doc.table(classes="table table-zebra w-full"):
                                with doc.thead():
                                    with doc.tr():
                                        with doc.th():
                                            doc.text("ID")
                                        with doc.th():
                                            doc.text("Invitee")
                                        with doc.th():
                                            doc.text("GitHub ID")
                                        with doc.th():
                                            doc.text("Permissions")
                                        with doc.th():
                                            doc.text("Created At")
                                with doc.tbody():
                                    for invitation in github_invitations:
                                        with doc.tr():
                                            with doc.td():
                                                doc.text(str(invitation["id"]))
                                            with doc.td():
                                                doc.text(
                                                    invitation["invitee_login"] or "N/A"
                                                )
                                            with doc.td():
                                                doc.text(
                                                    str(invitation["invitee_id"])
                                                    if invitation["invitee_id"]
                                                    else "N/A"
                                                )
                                            with doc.td():
                                                doc.text(invitation["permissions"])
                                            with doc.td():
                                                if invitation["created_at"]:
                                                    doc.text(
                                                        invitation[
                                                            "created_at"
                                                        ].strftime("%Y-%m-%d %H:%M:%S")
                                                    )
                                                else:
                                                    doc.text("N/A")
