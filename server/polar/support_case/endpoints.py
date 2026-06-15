from uuid import UUID

from fastapi import Depends
from fastapi.responses import RedirectResponse

from polar.exceptions import ResourceNotFound
from polar.file.service import file as file_service
from polar.kit.pagination import (
    ListResource,
    PaginationParamsQuery,
    paginate,
)
from polar.models import File
from polar.models.file import FileServiceTypes
from polar.models.support_case import (
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
)
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .auth import SupportCaseRead, SupportCaseReply
from .repository import SupportCaseRepository
from .schemas import (
    SupportCaseListItem,
    SupportCaseMessageCreate,
    SupportCaseNotFound,
    SupportCaseThread,
)
from .schemas import SupportCaseMessage as SupportCaseMessageSchema
from .service import SupportCaseClosedError
from .service import support_case as support_case_service

router = APIRouter(prefix="/organizations/{id}/support", tags=["support"])


@router.get(
    "/cases",
    response_model=ListResource[SupportCaseListItem],
    summary="List Support Cases",
    tags=[APITag.private],
)
async def list_support_cases(
    authz: SupportCaseRead,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[SupportCaseListItem]:
    """List the organization's support cases (any type), newest activity first."""
    repository = SupportCaseRepository.from_session(session)
    statement = repository.get_org_cases_statement(authz.organization.id)
    results, count = await paginate(session, statement, pagination=pagination)
    items = [
        SupportCaseListItem(
            id=case.id,
            type=case.type,
            created_at=case.created_at,
            modified_at=case.modified_at,
            is_open=is_open,
            awaiting_platform=awaiting_platform,
            last_message_at=last_message_at,
        )
        for case, is_open, awaiting_platform, last_message_at in results
    ]
    return ListResource.from_paginated_results(items, count, pagination)


@router.get(
    "/cases/{case_id}",
    response_model=SupportCaseThread,
    summary="Get Support Case",
    responses={404: SupportCaseNotFound},
    tags=[APITag.private],
)
async def get_support_case(
    authz: SupportCaseRead,
    case_id: UUID,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SupportCaseThread:
    """Get a support case and its merchant-visible timeline."""
    case = await support_case_service.get_org_case(
        session, organization_id=authz.organization.id, case_id=case_id
    )
    if case is None:
        raise ResourceNotFound()

    _, is_open, messages, attachments = await support_case_service.get_thread(
        session, case, visible_to=SupportCaseAudience.merchant
    )
    return SupportCaseThread.model_validate(
        {
            "case": case,
            "is_open": is_open,
            "messages": messages,
            "attachments": attachments,
        }
    )


@router.post(
    "/cases/{case_id}/messages",
    response_model=SupportCaseMessageSchema,
    summary="Reply to Support Case",
    responses={
        404: SupportCaseNotFound,
        409: {
            "description": "The case is closed.",
            "model": SupportCaseClosedError.schema(),
        },
    },
    tags=[APITag.private],
)
async def reply_to_support_case(
    authz: SupportCaseReply,
    case_id: UUID,
    message: SupportCaseMessageCreate,
    session: AsyncSession = Depends(get_db_session),
) -> SupportCaseMessage:
    """Post a merchant reply (text, attachments, or both) to a support case.

    Attachments must first be uploaded through the files API with service
    ``support_case_attachment``.
    """
    case = await support_case_service.get_org_case(
        session, organization_id=authz.organization.id, case_id=case_id
    )
    if case is None:
        raise ResourceNotFound()

    files: list[File] = []
    for file_id in message.file_ids:
        file = await file_service.get(session, authz.auth_subject, file_id)
        if (
            file is None
            or file.organization_id != authz.organization.id
            or not file.is_uploaded
            or file.service != FileServiceTypes.support_case_attachment
        ):
            raise ResourceNotFound()
        files.append(file)

    return await support_case_service.reply(
        session,
        case,
        author_kind=SupportCaseMessageAuthorKind.merchant,
        author_user=authz.auth_subject.subject,
        body=message.body,
        files=files,
    )


@router.get(
    "/cases/{case_id}/attachments/{attachment_id}/download",
    summary="Download Support Case Attachment",
    responses={
        302: {"description": "Redirect to a presigned download URL."},
        404: SupportCaseNotFound,
    },
    tags=[APITag.private],
)
async def download_support_case_attachment(
    authz: SupportCaseRead,
    case_id: UUID,
    attachment_id: UUID,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> RedirectResponse:
    """Redirect to a short-lived presigned URL for a merchant-visible attachment."""
    case = await support_case_service.get_org_case(
        session, organization_id=authz.organization.id, case_id=case_id
    )
    if case is None:
        raise ResourceNotFound()

    attachment = await support_case_service.get_attachment(
        session, case, attachment_id, visible_to=SupportCaseAudience.merchant
    )
    if attachment is None:
        raise ResourceNotFound()

    url, _ = file_service.generate_download_url(attachment.file)
    return RedirectResponse(url, 302)
