import json
import uuid
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import or_
from sqlalchemy.orm import joinedload
from tagflow import tag, text

from polar.backoffice.routing import BackofficeRouter
from polar.config import settings
from polar.file.repository import FileRepository
from polar.file.s3 import S3_SERVICES
from polar.file.sorting import FileSortProperty
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import File
from polar.models.file import FileServiceTypes
from polar.postgres import AsyncSession, get_db_read_session

from .. import formatters
from ..components import button, datatable, description_list, input
from ..components._clipboard_button import clipboard_button
from ..layout import layout

router = BackofficeRouter()


def _get_threats(file: File) -> list[dict[str, Any]]:
    if file.flagged_malicious_details is None:
        return []
    return file.flagged_malicious_details.get("threats") or []


def _get_aws_support_ticket(file: File) -> str:
    assert file.flagged_malicious_at is not None
    details = file.flagged_malicious_details or {}
    lines = [
        "GuardDuty Malware Protection for S3: suspected false positive",
        "",
        f"Region: {settings.AWS_REGION}",
        f"Bucket: {S3_SERVICES[file.service].bucket}",
        f"Object key: {file.path}",
        f"Object version ID: {file.storage_version or 'n/a'}",
        f"Object ETag: {file.checksum_etag or 'n/a'}",
        f"Object SHA-256: {file.checksum_sha256_hex or 'n/a'}",
        f"Object size: {file.size} bytes",
        f"Content type: {file.mime_type}",
        f"File name: {file.name}",
        f"Uploaded at: {file.created_at.isoformat()}",
        f"Scan result received at: {file.flagged_malicious_at.isoformat()}",
        f"Scan result status: {details.get('scanResultStatus', 'n/a')}",
        "",
        "Threats:",
    ]
    for threat in _get_threats(file):
        lines.append(f"- {threat.get('name')} (source: {threat.get('source', 'n/a')})")
        for item in threat.get("itemDetails") or []:
            lines.append(f"  - Item SHA-256: {item.get('hash') or 'n/a'}")
            lines.append(f"    Item path: {item.get('itemPath') or 'n/a'}")
    return "\n".join(lines)


class OrganizationColumn(datatable.DatatableAttrColumn[File, FileSortProperty]):
    def __init__(self) -> None:
        super().__init__("organization.name", "Organization")
        self.href_getter = lambda r, i: str(
            r.url_for("organizations:detail", organization_id=i.organization_id)
        )


class SizeColumn(datatable.DatatableAttrColumn[File, FileSortProperty]):
    def __init__(self) -> None:
        super().__init__("size", "Size")

    def get_value(self, item: File) -> str | None:
        return formatters.file_size(item.size)


@router.get("/", name="files:list")
async def list_files(
    request: Request,
    pagination: PaginationParamsQuery,
    query: str | None = Query(None),
    service: Annotated[
        FileServiceTypes | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    flagged: Annotated[bool | None, BeforeValidator(empty_str_to_none), Query()] = None,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = FileRepository.from_session(session)
    statement = (
        repository.get_base_statement(include_deleted=True)
        .options(joinedload(File.organization))
        .order_by(File.created_at.desc())
    )

    if query:
        try:
            query_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(File.id == query_uuid, File.organization_id == query_uuid)
            )
        except ValueError:
            statement = statement.where(
                or_(
                    File.name.ilike(f"%{query}%"),
                    File.checksum_sha256_hex == query.lower(),
                )
            )

    if service is not None:
        statement = statement.where(File.service == service)

    if flagged is not None:
        statement = statement.where(
            File.flagged_malicious_at.is_not(None)
            if flagged
            else File.flagged_malicious_at.is_(None)
        )

    items, has_more = await repository.paginate_has_more(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [("Files", str(request.url_for("files:list")))],
        "files:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Files")
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    "query",
                    query,
                    placeholder="Search by ID, organization ID, name or SHA-256",
                ):
                    pass
                with input.select(
                    [
                        ("All Services", ""),
                        *[
                            (s.value.replace("_", " ").title(), s.value)
                            for s in FileServiceTypes
                        ],
                    ],
                    service.value if service else "",
                    name="service",
                ):
                    pass
                with input.select(
                    [
                        ("All Files", ""),
                        ("Flagged as malicious", "true"),
                        ("Not flagged", "false"),
                    ],
                    "" if flagged is None else str(flagged).lower(),
                    name="flagged",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            with datatable.Datatable[File, FileSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="files:get", clipboard=True
                ),
                datatable.DatatableDateTimeColumn("created_at", "Created At"),
                datatable.DatatableAttrColumn("name", "Name"),
                OrganizationColumn(),
                datatable.DatatableAttrColumn("service", "Service"),
                SizeColumn(),
                datatable.DatatableDateTimeColumn("flagged_malicious_at", "Flagged At"),
                datatable.DatatableDateTimeColumn("deleted_at", "Deleted At"),
            ).render(request, items):
                pass
            with datatable.pagination_has_more(
                request, pagination, len(items), has_more
            ):
                pass


@router.get("/{id}", name="files:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = FileRepository.from_session(session)
    file = await repository.get_by_id(
        id, include_deleted=True, options=(joinedload(File.organization),)
    )

    if file is None:
        raise HTTPException(status_code=404)

    with layout(
        request,
        [
            (file.name, str(request.url)),
            ("Files", str(request.url_for("files:list"))),
        ],
        "files:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex items-center gap-4"):
                with tag.h1(classes="text-4xl"):
                    text(file.name)
                if file.flagged_malicious_at is not None:
                    with tag.div(classes="badge badge-error"):
                        text("Flagged as malicious")

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("File")
                        with description_list.DescriptionList[File](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem("name", "Name"),
                            description_list.DescriptionListAttrItem(
                                "service", "Service"
                            ),
                            description_list.DescriptionListAttrItem(
                                "mime_type", "Content Type"
                            ),
                            description_list.DescriptionListAttrItem(
                                "size", "Size (bytes)"
                            ),
                            description_list.DescriptionListAttrItem(
                                "path", "Object Key", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "storage_version", "Object Version ID", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "checksum_etag", "ETag", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "checksum_sha256_hex", "SHA-256", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "is_uploaded", "Uploaded"
                            ),
                            description_list.DescriptionListAttrItem(
                                "is_enabled", "Enabled"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "deleted_at", "Deleted At"
                            ),
                        ).render(request, file):
                            pass

                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Organization")
                        with description_list.DescriptionList[File](
                            description_list.DescriptionListLinkItem[File](
                                "organization.name",
                                "Name",
                                href_getter=lambda r, i: str(
                                    r.url_for(
                                        "organizations:detail",
                                        organization_id=i.organization_id,
                                    )
                                ),
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization.slug", "Slug"
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization_id", "ID", clipboard=True
                            ),
                        ).render(request, file):
                            pass

            if file.flagged_malicious_at is None:
                return

            with tag.div(classes="flex flex-col gap-4 pt-8"):
                with tag.h2(classes="text-2xl"):
                    text("Malware Scan")
                with tag.p():
                    text(
                        f"Flagged at {formatters.datetime(file.flagged_malicious_at)} UTC"
                    )
                with tag.div(classes="overflow-x-auto"):
                    with tag.table(classes="table table-zebra w-full"):
                        with tag.thead():
                            with tag.tr():
                                for header in (
                                    "Threat",
                                    "Source",
                                    "Item SHA-256",
                                    "Item Path",
                                ):
                                    with tag.th():
                                        text(header)
                        with tag.tbody():
                            for threat in _get_threats(file):
                                for item in threat.get("itemDetails") or [{}]:
                                    with tag.tr():
                                        with tag.td():
                                            text(threat.get("name") or "—")
                                        with tag.td():
                                            text(threat.get("source") or "—")
                                        with tag.td(classes="font-mono"):
                                            text(item.get("hash") or "—")
                                        with tag.td():
                                            text(item.get("itemPath") or "—")

            with tag.div(classes="flex flex-col gap-4 pt-8"):
                ticket = _get_aws_support_ticket(file)
                with tag.div(classes="flex items-center gap-2"):
                    with tag.h2(classes="text-2xl"):
                        text("AWS Support Ticket")
                    with clipboard_button(ticket):
                        pass
                with tag.div(classes="bg-base-200 p-4 rounded-lg"):
                    with tag.pre(classes="whitespace-pre-wrap text-sm"):
                        text(ticket)

            with tag.div(classes="flex flex-col gap-4 pt-8"):
                with tag.h2(classes="text-2xl"):
                    text("Raw Scan Result")
                with tag.div(classes="bg-base-200 p-4 rounded-lg"):
                    with tag.pre(classes="whitespace-pre-wrap text-sm"):
                        text(json.dumps(file.flagged_malicious_details, indent=2))
