from typing import Any

from fastapi import Depends
from pydantic import Field

from polar.exceptions import PolarRequestValidationError
from polar.kit.schemas import Schema
from polar.openapi import APITag
from polar.organization.resolver import get_payload_organization
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from ...auth import BenefitsWrite
from .schemas import ChannelNameTemplate
from .template import (
    InvalidTemplateError,
    TemplateContext,
    render_channel_name,
    validate_template,
)

router = APIRouter(
    prefix="/benefits/slack",
    tags=["benefits", APITag.private],
)


class ChannelNamePreviewRequest(Schema):
    organization_id: OrganizationID | None = None
    template: ChannelNameTemplate
    customer_name: str = Field(default="Sample Customer")
    customer_email: str = Field(default="customer@example.com")
    customer_metadata: dict[str, str | int | float | bool] = Field(default_factory=dict)


class ChannelNamePreviewResponse(Schema):
    channel_name: str


class ChannelNamePreviewValidationErrorResponse(Schema):
    error: str
    detail: list[dict[str, Any]]


@router.post(
    "/preview-channel-name",
    response_model=ChannelNamePreviewResponse,
    responses={
        422: {
            "description": "Invalid channel name template.",
            "model": ChannelNamePreviewValidationErrorResponse,
        },
    },
)
async def preview_channel_name(
    payload: ChannelNamePreviewRequest,
    auth_subject: BenefitsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ChannelNamePreviewResponse:
    await get_payload_organization(session, auth_subject, payload)

    try:
        validate_template(payload.template)
    except InvalidTemplateError as e:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "template"),
                    "msg": str(e),
                    "input": payload.template,
                }
            ]
        ) from e

    email = payload.customer_email
    context = TemplateContext(
        customer_name=payload.customer_name,
        customer_email_local=email.split("@", 1)[0] if email else "customer",
        metadata=dict(payload.customer_metadata),
    )
    try:
        channel_name = render_channel_name(payload.template, context, tolerant=True)
    except InvalidTemplateError as e:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "template"),
                    "msg": str(e),
                    "input": payload.template,
                }
            ]
        ) from e

    return ChannelNamePreviewResponse(channel_name=channel_name)
