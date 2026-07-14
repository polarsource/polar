from fastapi import Depends, Query
from fastapi.responses import RedirectResponse

from polar.dispute.dispute_case import dispute_case as dispute_case_service
from polar.exceptions import (
    PolarError,
    PolarRequestValidationError,
    ResourceNotFound,
)
from polar.file.service import file as file_service
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import File
from polar.models.dispute import DisputeStatus
from polar.models.file import FileServiceTypes
from polar.models.support_case import (
    DisputeSupportCase,
    ReviewAppealSupportCase,
    SupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseType,
)
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.organization_review.appeal_case import CaseClosedError
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import (
    DisputeSupportCaseMessageCreate,
    ReviewAppealSupportCaseMessageCreate,
    SupportCaseAttachmentID,
    SupportCaseID,
    SupportCaseListItem,
    SupportCaseListItemAdapter,
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


def _reply_type_mismatch(
    message: ReviewAppealSupportCaseMessageCreate | DisputeSupportCaseMessageCreate,
) -> PolarRequestValidationError:
    return PolarRequestValidationError(
        [
            {
                "type": "value_error",
                "loc": ("body", "type"),
                "msg": "Reply type does not match the support case type.",
                "input": message.type,
            }
        ]
    )


@router.get(
    "/",
    summary="List Support Cases",
    response_model=ListResource[SupportCaseListItem],
)
async def list_support_cases(
    auth_subject: auth.SupportCasesRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    type: MultipleQueryFilter[SupportCaseType] | None = Query(
        None, title="Type Filter", description="Filter by support case type."
    ),
    dispute_status: MultipleQueryFilter[DisputeStatus] | None = Query(
        None,
        title="DisputeStatus Filter",
        description="Filter dispute cases by the linked dispute's status.",
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[SupportCaseListItem]:
    """List the organization's support cases."""
    results, count = await support_case_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        type=type,
        dispute_status=dispute_status,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(
        [SupportCaseListItemAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


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

    if isinstance(case, ReviewAppealSupportCase):
        if not isinstance(message, ReviewAppealSupportCaseMessageCreate):
            raise _reply_type_mismatch(message)
        return await appeal_case_service.add_reply(
            session,
            case,
            message,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            author_user=auth_subject.subject,
            files=files,
        )
    if isinstance(case, DisputeSupportCase):
        if not isinstance(message, DisputeSupportCaseMessageCreate):
            raise _reply_type_mismatch(message)
        return await dispute_case_service.add_reply(
            session,
            case,
            message,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            author_user=auth_subject.subject,
            files=files,
        )
    raise CaseRepliesNotSupportedError(case)


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
