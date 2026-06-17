from uuid import UUID

from fastapi import Depends
from fastapi.responses import RedirectResponse

from polar.exceptions import ResourceNotFound
from polar.file.service import file as file_service
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

from .auth import CaseRead, CaseReply
from .schemas import SupportCaseMessage as SupportCaseMessageSchema
from .schemas import (
    SupportCaseMessageCreate,
    SupportCaseNotFound,
    SupportCaseThread,
)
from .service import SupportCaseClosedError
from .service import support_case as support_case_service

router = APIRouter(prefix="/cases", tags=["cases"])


@router.get(
    "/{id}",
    response_model=SupportCaseThread,
    summary="Get Case",
    responses={404: SupportCaseNotFound},
    tags=[APITag.private],
)
async def get_case(
    context: CaseRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SupportCaseThread:
    """Get a support case and its merchant-visible timeline."""
    is_open, messages, attachments = await support_case_service.get_thread(
        session, context.case, visible_to=SupportCaseAudience.merchant
    )
    return SupportCaseThread.model_validate(
        {
            "case": context.case,
            "is_open": is_open,
            "messages": messages,
            "attachments": attachments,
        }
    )


@router.post(
    "/{id}/messages",
    response_model=SupportCaseMessageSchema,
    summary="Reply to Case",
    responses={
        404: SupportCaseNotFound,
        409: {
            "description": "The case is closed.",
            "model": SupportCaseClosedError.schema(),
        },
    },
    tags=[APITag.private],
)
async def reply_to_case(
    context: CaseReply,
    message: SupportCaseMessageCreate,
    session: AsyncSession = Depends(get_db_session),
) -> SupportCaseMessage:
    """Post a merchant reply (text, attachments, or both) to a support case.

    Attachments must first be uploaded through the files API with service
    ``support_case_attachment``.
    """
    files: list[File] = []
    for file_id in message.file_ids:
        file = await file_service.get(session, context.auth_subject, file_id)
        if (
            file is None
            or file.organization_id != context.organization.id
            or not file.is_uploaded
            or file.service != FileServiceTypes.support_case_attachment
        ):
            raise ResourceNotFound()
        files.append(file)

    return await support_case_service.add_reply(
        session,
        context.case,
        author_kind=SupportCaseMessageAuthorKind.merchant,
        author_user=context.auth_subject.subject,
        body=message.body,
        files=files,
    )


@router.get(
    "/{id}/attachments/{attachment_id}/download",
    summary="Download Case Attachment",
    responses={
        302: {"description": "Redirect to a presigned download URL."},
        404: SupportCaseNotFound,
    },
    tags=[APITag.private],
)
async def download_case_attachment(
    context: CaseRead,
    attachment_id: UUID,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> RedirectResponse:
    """Redirect to a short-lived presigned URL for a merchant-visible attachment."""
    attachment = await support_case_service.get_attachment(
        session, context.case, attachment_id, visible_to=SupportCaseAudience.merchant
    )
    if attachment is None:
        raise ResourceNotFound()

    url, _ = file_service.generate_download_url(attachment.file)
    return RedirectResponse(url, 302)
