from fastapi import Depends
from fastapi.responses import RedirectResponse

from polar.exceptions import PolarError, ResourceNotFound
from polar.file.service import file as file_service
from polar.models import File
from polar.models.file import FileServiceTypes
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
)
from polar.openapi import APITag
from polar.organization_review.appeal_case import CaseClosedError
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth
from .schemas import (
    SupportCaseAttachmentID,
    SupportCaseID,
    SupportCaseMessageCreate,
    SupportCaseNotFound,
    SupportCaseThread,
)
from .schemas import SupportCaseMessage as SupportCaseMessageSchema
from .service import support_case as support_case_service

router = APIRouter(prefix="/support-cases", tags=["support-cases", APITag.private])


class CaseRepliesNotSupportedError(PolarError):
    def __init__(self, case: SupportCase) -> None:
        super().__init__(f"Replies to {case.type} cases are not supported yet.", 409)


@router.get(
    "/{id}",
    summary="Get Support Case",
    response_model=SupportCaseThread,
    responses={
        200: {"description": "Support case thread returned."},
        404: SupportCaseNotFound,
    },
)
async def get_support_case(
    id: SupportCaseID,
    auth_subject: auth.SupportCasesRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> SupportCaseThread:
    """Get a support case and its merchant-visible timeline."""
    case = await support_case_service.get(session, auth_subject, id)
    if case is None:
        raise ResourceNotFound()

    is_open, messages = await support_case_service.get_thread(
        session, case, visible_to=SupportCaseAudience.merchant
    )
    attachments = await support_case_service.list_attachments(
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
    "/{id}/messages",
    summary="Reply to Support Case",
    response_model=SupportCaseMessageSchema,
    status_code=201,
    responses={
        201: {"description": "Reply posted."},
        404: SupportCaseNotFound,
        409: {
            "description": "The case is closed, or its type does not accept replies.",
            "model": CaseClosedError.schema() | CaseRepliesNotSupportedError.schema(),
        },
    },
)
async def reply_to_support_case(
    id: SupportCaseID,
    message: SupportCaseMessageCreate,
    auth_subject: auth.SupportCasesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> SupportCaseMessage:
    """Post a merchant reply to a support case.

    The reply may carry free text, attachments, or both. Attachments must first
    be uploaded through the files API with service ``support_case_attachment``.
    """
    case = await support_case_service.get(session, auth_subject, id)
    if case is None:
        raise ResourceNotFound()
    if not isinstance(case, ReviewAppealSupportCase):
        raise CaseRepliesNotSupportedError(case)

    files: list[File] = []
    for file_id in message.file_ids:
        file = await file_service.get(session, auth_subject, file_id)
        if (
            file is None
            or file.organization_id != case.organization_id
            or not file.is_uploaded
            or file.service != FileServiceTypes.support_case_attachment
        ):
            raise ResourceNotFound()
        files.append(file)

    return await appeal_case_service.add_reply(
        session,
        case,
        author_kind=SupportCaseMessageAuthorKind.merchant,
        author_user=auth_subject.subject,
        body=message.body,
        files=files,
    )


@router.get(
    "/{id}/attachments/{attachment_id}/download",
    summary="Download Support Case Attachment",
    responses={
        302: {"description": "Redirect to a presigned download URL."},
        404: SupportCaseNotFound,
    },
)
async def download_support_case_attachment(
    id: SupportCaseID,
    attachment_id: SupportCaseAttachmentID,
    auth_subject: auth.SupportCasesRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> RedirectResponse:
    """Redirect to a short-lived presigned URL for a merchant-visible attachment."""
    case = await support_case_service.get(session, auth_subject, id)
    if case is None:
        raise ResourceNotFound()

    attachment = await support_case_service.get_attachment(
        session, case, attachment_id, visible_to=SupportCaseAudience.merchant
    )
    if attachment is None:
        raise ResourceNotFound()

    url, _ = file_service.generate_download_url(attachment.file)
    return RedirectResponse(url, 302)
