"""Shared query for backoffice support-case lists.

Both the dedicated Cases list and an organization's Support Cases tab read the
same polymorphic ``SupportCase`` set. The organization is resolved per type:
appeals link through their review, disputes through their dispute → order.
"""

from collections.abc import Sequence
from typing import Any, cast
from uuid import UUID

from sqlalchemy import Select, and_, func, or_, select

from polar.models import Dispute, Order, Organization, User
from polar.models.dispute import DisputeStatus
from polar.models.organization_review import OrganizationReview
from polar.models.support_case import (
    DisputeSupportCase,
    ReviewAppealSupportCase,
    SupportCase,
    SupportCaseMessage,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
    SupportCaseType,
)
from polar.support_case.repository import SupportCaseMessageRepository

# (case, organization, is_open, assignee_email, awaiting_platform, unread,
#  dispute_status) — dispute_status is None for non-dispute cases.
Row = tuple[
    SupportCase, Organization, bool, str | None, bool, bool, DisputeStatus | None
]

# Human-readable label per case type, shared by every case list.
TYPE_LABELS: dict[SupportCaseType, str] = {
    SupportCaseType.review_appeal: "Review appeal",
    SupportCaseType.dispute: "Dispute",
}

_TYPE_FILTERS = {SupportCaseType.review_appeal.value, SupportCaseType.dispute.value}


def cases_statement(
    *,
    organization_id: UUID | None = None,
    status: str = "all",
    assigned: str = "all",
    assigned_user_id: UUID | None = None,
    viewer_user_id: UUID | None = None,
    case_type: str = "all",
    sort: str = "recency",
) -> Select[Row]:
    """Polymorphic case list with its organization, open state and assignee.

    ``status`` (open/closed/all), ``assigned`` (me/unassigned/all) and
    ``case_type`` (review_appeal/dispute/all) narrow the set; ``sort`` is either
    pure recency or support tier first with recency as the tiebreaker.
    """
    is_open = SupportCaseMessageRepository.is_open_expression()
    awaiting_platform = SupportCaseMessageRepository.awaiting_platform_expression()

    latest_activity = (
        select(func.max(SupportCaseMessage.created_at))
        .where(
            SupportCaseMessage.case_id == SupportCase.id,
            SupportCaseMessage.type.notin_(
                [
                    SupportCaseMessageType.assigned,
                    SupportCaseMessageType.released,
                ]
            ),
        )
        .scalar_subquery()
    )
    viewer_read_at = (
        select(SupportCaseParticipant.last_read_at)
        .where(
            SupportCaseParticipant.case_id == SupportCase.id,
            SupportCaseParticipant.kind == SupportCaseParticipantKind.platform,
            SupportCaseParticipant.platform_user_id == viewer_user_id,
            SupportCaseParticipant.deleted_at.is_(None),
        )
        .scalar_subquery()
    )
    unread = and_(
        latest_activity.isnot(None),
        or_(viewer_read_at.is_(None), viewer_read_at < latest_activity),
    )

    statement = (
        select(
            SupportCase,
            Organization,
            is_open.label("is_open"),
            User.email.label("assignee_email"),
            awaiting_platform.label("awaiting_platform"),
            unread.label("unread"),
            Dispute.status.label("dispute_status"),
        )
        .outerjoin(
            OrganizationReview,
            ReviewAppealSupportCase.organization_review_id == OrganizationReview.id,
        )
        .outerjoin(Dispute, DisputeSupportCase.dispute_id == Dispute.id)
        .outerjoin(Order, Dispute.order_id == Order.id)
        .join(
            Organization,
            Organization.id
            == func.coalesce(OrganizationReview.organization_id, Order.organization_id),
        )
        .outerjoin(User, SupportCase.assigned_user_id == User.id)
        .where(SupportCase.deleted_at.is_(None))
    )

    if organization_id is not None:
        statement = statement.where(Organization.id == organization_id)
    if status == "open":
        statement = statement.where(is_open)
    elif status == "closed":
        statement = statement.where(~is_open)
    if assigned == "me" and assigned_user_id is not None:
        statement = statement.where(SupportCase.assigned_user_id == assigned_user_id)
    elif assigned == "unassigned":
        statement = statement.where(SupportCase.assigned_user_id.is_(None))
    if case_type in _TYPE_FILTERS:
        statement = statement.where(SupportCase.type == case_type)

    order_by: tuple[Any, ...]
    if sort == "tier":
        order_by = (
            Organization.support_tier.desc().nullslast(),
            SupportCase.created_at.desc(),
        )
    else:
        order_by = (SupportCase.created_at.desc(),)
    # ``assignee_email`` is NULL for unassigned cases (outer join), which the
    # column type doesn't capture; ``Row`` models it as ``str | None``.
    return cast("Select[Row]", statement.order_by(*order_by))


def open_case_organization_ids(
    *,
    organization_ids: Sequence[UUID] | None = None,
    awaiting_reply: bool = False,
) -> Select[tuple[UUID]]:
    """Distinct ids of organizations with at least one open support case of any
    type. With ``awaiting_reply``, only those whose open case is waiting on a
    platform reply. ``organization_ids`` narrows the scan to a known page.
    """
    organization_id = func.coalesce(
        OrganizationReview.organization_id, Order.organization_id
    )
    statement = (
        select(organization_id)
        .select_from(SupportCase)
        .outerjoin(
            OrganizationReview,
            ReviewAppealSupportCase.organization_review_id == OrganizationReview.id,
        )
        .outerjoin(Dispute, DisputeSupportCase.dispute_id == Dispute.id)
        .outerjoin(Order, Dispute.order_id == Order.id)
        .where(
            SupportCase.deleted_at.is_(None),
            SupportCaseMessageRepository.is_open_expression(),
        )
        .distinct()
    )
    if awaiting_reply:
        statement = statement.where(
            SupportCaseMessageRepository.awaiting_platform_expression()
        )
    if organization_ids is not None:
        statement = statement.where(organization_id.in_(organization_ids))
    return statement


__all__ = [
    "TYPE_LABELS",
    "Row",
    "cases_statement",
    "open_case_organization_ids",
]
