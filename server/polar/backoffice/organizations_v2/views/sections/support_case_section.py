"""Support case section: a support-case thread (appeal or dispute) and staff
actions. Appeals carry an approve/deny decision; disputes are bank-decided and
read-only beyond the staff ↔ merchant conversation, with a facts panel for the
chargeback itself (amount, reason, evidence deadline)."""

import contextlib
from collections.abc import Generator, Sequence
from urllib.parse import urlencode
from uuid import UUID

from fastapi import Request
from tagflow import attr, tag, text

from polar.enums import PaymentProcessor
from polar.models import Dispute, Organization
from polar.models.support_case import (
    DisputeSupportCase,
    DisputeWinReason,
    SupportCase,
    SupportCaseAttachment,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseType,
)
from polar.support_case.pdf import is_mergeable

from .... import formatters
from ....components import button, card, dispute_status_badge
from ....support_cases.urls import append_return_to

_AUTHOR_LABELS: dict[SupportCaseMessageAuthorKind, str] = {
    SupportCaseMessageAuthorKind.platform: "Support",
    SupportCaseMessageAuthorKind.merchant: "Merchant",
    SupportCaseMessageAuthorKind.customer: "Customer",
    SupportCaseMessageAuthorKind.system: "System",
}

_CASE_TITLES: dict[SupportCaseType, str] = {
    SupportCaseType.review_appeal: "Appeal Support Case",
    SupportCaseType.dispute: "Dispute Support Case",
}

_WIN_REASON_LABELS: dict[DisputeWinReason, str] = {
    DisputeWinReason.cardholder_withdrew: "The cardholder withdrew the dispute",
    DisputeWinReason.cardholder_refunded: "The cardholder was refunded",
    DisputeWinReason.rightful_cardholder: (
        "The purchase was made by the rightful cardholder"
    ),
    DisputeWinReason.other: "Other",
}

# The "opened" milestone reads differently per case type (a merchant-requested
# appeal vs. a system-opened dispute).
_OPENED_TITLES: dict[SupportCaseType, str] = {
    SupportCaseType.review_appeal: "Human review requested",
    SupportCaseType.dispute: "Dispute opened",
}

# Outcome milestones surfaced as header badges: (badge classes, icon, label).
_OUTCOMES: dict[SupportCaseMessageType, tuple[str, str, str]] = {
    SupportCaseMessageType.appeal_approved: (
        "badge-success",
        "icon-check",
        "Appeal approved",
    ),
    SupportCaseMessageType.appeal_denied: ("badge-error", "icon-x", "Appeal denied"),
    SupportCaseMessageType.dispute_won: ("badge-success", "icon-check", "Dispute won"),
    SupportCaseMessageType.dispute_lost: ("badge-error", "icon-x", "Dispute lost"),
    SupportCaseMessageType.dispute_prevented: (
        "badge-success",
        "icon-shield-check",
        "Dispute prevented",
    ),
}

# Milestone events: title + (lucide icon, node circle classes). These render as
# timeline milestones, visually distinct from conversation messages.
_EVENT_TITLES: dict[SupportCaseMessageType, str] = {
    SupportCaseMessageType.opened: "Case opened",
    SupportCaseMessageType.closed: "Case closed",
    SupportCaseMessageType.appeal_approved: "Appeal approved",
    SupportCaseMessageType.appeal_denied: "Appeal denied",
    SupportCaseMessageType.info_requested: "Information requested",
    SupportCaseMessageType.dispute_under_review: "Dispute under review",
    SupportCaseMessageType.dispute_won: "Dispute won",
    SupportCaseMessageType.dispute_lost: "Dispute lost",
    SupportCaseMessageType.dispute_prevented: "Dispute prevented",
    SupportCaseMessageType.merchant_accepted: "Merchant accepted the dispute",
    SupportCaseMessageType.assigned: "Case assigned",
    SupportCaseMessageType.released: "Case unassigned",
}

_DARK_NODE = "bg-neutral text-neutral-content"
_MUTED_NODE = "bg-base-200 text-base-content/70"
_EVENT_NODES: dict[SupportCaseMessageType, tuple[str, str]] = {
    SupportCaseMessageType.opened: ("icon-circle-dot", _DARK_NODE),
    SupportCaseMessageType.closed: ("icon-square", _DARK_NODE),
    SupportCaseMessageType.appeal_approved: (
        "icon-check",
        "bg-success text-success-content",
    ),
    SupportCaseMessageType.appeal_denied: ("icon-x", "bg-error text-error-content"),
    SupportCaseMessageType.info_requested: (
        "icon-message-square-text",
        "bg-info text-info-content",
    ),
    SupportCaseMessageType.dispute_under_review: (
        "icon-gavel",
        "bg-info text-info-content",
    ),
    SupportCaseMessageType.dispute_won: (
        "icon-check",
        "bg-success text-success-content",
    ),
    SupportCaseMessageType.dispute_lost: ("icon-x", "bg-error text-error-content"),
    SupportCaseMessageType.dispute_prevented: (
        "icon-shield-check",
        "bg-success text-success-content",
    ),
    SupportCaseMessageType.merchant_accepted: ("icon-x", _MUTED_NODE),
    SupportCaseMessageType.assigned: ("icon-user-check", _MUTED_NODE),
    SupportCaseMessageType.released: ("icon-user-x", _MUTED_NODE),
}

Thread = tuple[SupportCase, bool, Sequence[SupportCaseMessage]]

MERGED_PDFS_REGION_ID = "merged-pdfs"
MERGE_POLL_MAX_ATTEMPTS = 60


def render_attachment_pill(request: Request, attachment: SupportCaseAttachment) -> None:
    file = attachment.file
    url = str(
        request.url_for(
            "support_cases:attachment_download", attachment_id=attachment.id
        )
    )
    with tag.a(
        href=url,
        target="_blank",
        classes="flex items-center gap-3 max-w-md rounded-lg border "
        "border-base-300 bg-base-100 px-3 py-2 hover:bg-base-200",
    ):
        if file.mime_type.startswith("image/"):
            with tag.img(
                src=url,
                alt=file.name,
                loading="lazy",
                classes="h-12 w-12 flex-none rounded-md object-cover bg-base-200",
            ):
                pass
        else:
            with tag.div(
                classes="flex h-12 w-12 flex-none items-center "
                "justify-center rounded-md bg-base-200 "
                "text-base-content/40"
            ):
                with tag.span(classes="icon-paperclip"):
                    pass
        with tag.div(classes="min-w-0"):
            with tag.div(classes="text-sm font-medium truncate"):
                text(file.name)
            with tag.div(classes="text-xs text-base-content/50"):
                text(_format_size(file.size))


def render_merged_pdfs_region(
    request: Request,
    case_id: UUID,
    merged_files: Sequence[SupportCaseAttachment],
    *,
    expected: int | None = None,
    merging: int | None = None,
    attempts: int = 0,
) -> None:
    """The "Merged PDFs" block below the evidence list.

    While fewer files than ``expected`` exist, the region polls itself until
    the new PDF appears, giving up after ``MERGE_POLL_MAX_ATTEMPTS``."""
    pending = expected is not None and len(merged_files) < expected
    timed_out = pending and attempts >= MERGE_POLL_MAX_ATTEMPTS
    with tag.div(id=MERGED_PDFS_REGION_ID, classes="flex flex-col gap-2"):
        if pending and not timed_out:
            partial_url = str(
                request.url_for(
                    "support_cases:attachments_merged_partial", case_id=case_id
                )
            )
            attr(
                "hx-get",
                f"{partial_url}?expected={expected}"
                f"&merging={merging or 0}&attempts={attempts + 1}",
            )
            attr("hx-trigger", "every 2s")
            attr("hx-swap", "outerHTML")
        if merged_files or pending:
            with tag.div(
                classes="text-xs uppercase tracking-wide text-base-content/40 mt-2"
            ):
                text(f"Merged PDFs ({len(merged_files)})")
        for attachment in merged_files:
            with tag.div(classes="flex"):
                render_attachment_pill(request, attachment)
        if timed_out:
            with tag.div(classes="text-sm text-error"):
                text(
                    "The merge did not complete. Reload the page to check "
                    "for the file, or try again."
                )
        elif pending:
            with tag.div(
                classes="flex items-center gap-2 text-sm text-base-content/60"
            ):
                with tag.span(classes="loading loading-spinner loading-xs"):
                    pass
                text(f"Merging {merging} files…" if merging else "Merging files…")


def _format_size(size: int) -> str:
    value = float(size)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024:
            return f"{value:.0f} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"


class SupportCaseSection:
    """Render a support case: status header, timeline and actions."""

    def __init__(
        self,
        organization: Organization,
        thread: Thread | None = None,
        author_emails: dict[UUID, str] | None = None,
        current_user_id: UUID | None = None,
        attachments_by_message: dict[UUID, list[SupportCaseAttachment]] | None = None,
        attachments: Sequence[SupportCaseAttachment] | None = None,
        dispute: Dispute | None = None,
        return_to: str | None = None,
    ) -> None:
        self.org = organization
        self.thread = thread
        self.author_emails = author_emails or {}
        self.current_user_id = current_user_id
        self.attachments_by_message = attachments_by_message or {}
        self.attachments = attachments or []
        # The dispute behind a dispute case, surfaced as a read-only facts panel.
        self.dispute = dispute
        # Origin to come back to after an action (e.g. the org page), threaded
        # through every action URL so the flow stays anchored to it.
        self.return_to = return_to
        # Set from the thread's case at render time; drives type-aware labels.
        self._case_type: SupportCaseType = SupportCaseType.review_appeal

    def _with_return_to(self, url: str) -> str:
        return append_return_to(url, self.return_to)

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        with tag.div(classes="space-y-6"):
            if self.thread is None:
                with card(bordered=True):
                    with tag.h2(classes="text-lg font-semibold mb-1"):
                        text("Support Case")
                    with tag.p(classes="text-sm text-base-content/50"):
                        text("No support case for this organization.")
                yield
                return

            case, is_open, messages = self.thread
            self._case_type = case.type
            with card(bordered=True):
                self._render_header(request, case, is_open, messages)
                if self.dispute is not None:
                    self._render_dispute_details(request, self.dispute)
                self._render_timeline(request, messages)
                self._render_composer(request, case, is_open)
            yield

    # -- Header -------------------------------------------------------------

    def _outcome(
        self, messages: Sequence[SupportCaseMessage]
    ) -> SupportCaseMessageType | None:
        for message in messages:
            if message.type in _OUTCOMES:
                return message.type
        return None

    def _render_header(
        self,
        request: Request,
        case: SupportCase,
        is_open: bool,
        messages: Sequence[SupportCaseMessage],
    ) -> None:
        outcome = self._outcome(messages)
        is_appeal = self._case_type == SupportCaseType.review_appeal
        with tag.div(classes="flex items-start justify-between gap-4 mb-8"):
            with tag.div(classes="flex items-start gap-4"):
                with tag.div(
                    classes="flex-none w-11 h-11 rounded-xl bg-base-200 "
                    "flex items-center justify-center"
                ):
                    with tag.span(
                        classes="icon-message-square text-lg text-base-content/70"
                    ):
                        pass
                with tag.div(classes="flex flex-col gap-2"):
                    with tag.h2(classes="text-xl font-semibold leading-none"):
                        text(_CASE_TITLES.get(self._case_type, "Support Case"))
                    with tag.div(classes="flex items-center gap-2"):
                        status = "badge-success" if is_open else "badge-neutral"
                        with tag.div(classes=f"badge {status} badge-sm"):
                            text("Open" if is_open else "Closed")
                        if outcome is not None:
                            badge, icon, label = _OUTCOMES[outcome]
                            with tag.div(classes=f"badge {badge} badge-sm gap-1"):
                                with tag.span(classes=icon):
                                    pass
                                text(label)
                        elif is_open and is_appeal:
                            with tag.div(classes="badge badge-ghost badge-sm"):
                                text("Awaiting decision")
                        if is_open:
                            self._render_assignment_chip(case)
            # Right-side controls: a link to the org overview (appeals) plus the
            # actions while the case is open. Assignment is advisory on any open
            # case; the approve/deny decision is appeal-only (disputes are
            # bank-decided).
            if is_appeal or is_open:
                with tag.div(classes="flex-none flex items-center gap-2"):
                    if is_appeal:
                        self._render_org_link(request)
                    if is_open:
                        self._render_assignment_button(request, case)
                        if is_appeal:
                            self._render_appeal_decision_buttons(request)

    def _render_assignment_chip(self, case: SupportCase) -> None:
        assignee_id = case.assigned_user_id
        if assignee_id is None:
            icon, label = "icon-user", "Unassigned"
        elif assignee_id == self.current_user_id:
            icon, label = "icon-user-check", "Assigned to you"
        else:
            email = self.author_emails.get(assignee_id, "another agent")
            icon, label = "icon-user-check", f"Assigned to {email}"
        with tag.div(classes="badge badge-ghost badge-sm gap-1"):
            with tag.span(classes=icon):
                pass
            text(label)

    def _assignment_urls(self, request: Request, case: SupportCase) -> tuple[str, str]:
        # Assignment is advisory and generic to any case type, so it posts to
        # the case-keyed support_cases endpoints and returns to the case detail
        # page afterwards — keeping the original origin so the back link holds.
        detail_path = append_return_to(
            request.url_for("support_cases:detail", case_id=case.id).path,
            self.return_to,
        )
        take_url = f"{request.url_for('support_cases:take', case_id=case.id)}?{urlencode({'return_to': detail_path})}"
        release_url = f"{request.url_for('support_cases:release', case_id=case.id)}?{urlencode({'return_to': detail_path})}"
        return take_url, release_url

    def _render_org_link(self, request: Request) -> None:
        url = str(request.url_for("organizations:detail", organization_id=self.org.id))
        with tag.a(href=url, classes="btn btn-sm btn-outline gap-1"):
            attr("target", "_blank")
            attr("rel", "noopener noreferrer")
            text("View organization")
            with tag.div(classes="icon-external-link"):
                pass

    def _render_assignment_button(self, request: Request, case: SupportCase) -> None:
        take_url, release_url = self._assignment_urls(request, case)
        if case.assigned_user_id == self.current_user_id:
            with button(size="sm", outline=True, hx_post=release_url):
                text("Release")
        else:
            label = "Take over" if case.assigned_user_id is not None else "Take case"
            with button(variant="neutral", size="sm", hx_post=take_url):
                text(label)

    def _render_appeal_decision_buttons(self, request: Request) -> None:
        approve_url = self._with_return_to(
            str(
                request.url_for(
                    "organizations:appeal_case_approve_dialog",
                    organization_id=self.org.id,
                )
            )
        )
        deny_url = self._with_return_to(
            str(
                request.url_for(
                    "organizations:appeal_case_deny_dialog",
                    organization_id=self.org.id,
                )
            )
        )
        with button(
            variant="error",
            size="sm",
            outline=True,
            hx_get=deny_url,
            hx_target="#modal",
        ):
            text("Deny appeal")
        with button(
            variant="primary", size="sm", hx_get=approve_url, hx_target="#modal"
        ):
            text("Approve appeal")

    # -- Dispute details ----------------------------------------------------

    def _render_dispute_details(self, request: Request, dispute: Dispute) -> None:
        """Read-only facts about the chargeback: what is owed, why, and by when."""
        order_url = str(request.url_for("orders:get", id=dispute.order_id))
        with tag.div(classes="mb-8 rounded-xl border border-base-300"):
            with tag.div(
                classes="flex items-center justify-between gap-2 px-4 py-3 "
                "border-b border-base-300"
            ):
                with tag.div(classes="flex items-center gap-2"):
                    with tag.span(classes="icon-gavel text-base-content/60"):
                        pass
                    with tag.span(classes="text-sm font-medium"):
                        text("Dispute details")
                dispute_status_badge(dispute.status)
            with tag.div(
                classes="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 px-4 py-4"
            ):
                with self._fact("Amount at risk"):
                    text(
                        formatters.currency(
                            dispute.amount + dispute.tax_amount, dispute.currency
                        )
                    )
                with self._fact("Reason"):
                    text(self._dispute_reason(dispute))
                with self._fact("Evidence due"):
                    self._render_evidence_due(dispute)
                with self._fact("Evidence"):
                    if dispute.has_evidence:
                        text(f"Submitted ({dispute.submission_count})")
                    else:
                        with tag.span(classes="text-base-content/50"):
                            text("Not submitted")
                with self._fact("Order"):
                    with tag.a(href=order_url, classes="link"):
                        text("View order")
                if dispute.payment_processor_id:
                    with self._fact("Processor dispute ID"):
                        self._render_processor_id(dispute)
                with self._fact("Why they should win"):
                    self._render_win_reason()
            self._render_evidence_files(request)

    def _render_win_reason(self) -> None:
        case = self.thread[0] if self.thread else None
        if not isinstance(case, DisputeSupportCase) or case.win_reason is None:
            with tag.span(classes="text-base-content/50"):
                text("Not provided")
            return
        label = _WIN_REASON_LABELS.get(case.win_reason, case.win_reason.value)
        if case.win_reason == DisputeWinReason.other and case.win_reason_other:
            text(f"{label} — {case.win_reason_other}")
        else:
            text(label)

    def _merchant_attachments(self) -> list[SupportCaseAttachment]:
        """Attachments carried by merchant-authored messages — internal
        case-level files must not appear under a "merchant submitted" heading."""
        if self.thread is None:
            return []
        _case, _is_open, messages = self.thread
        merchant_message_ids = {
            message.id
            for message in messages
            if message.author_kind == SupportCaseMessageAuthorKind.merchant
        }
        return [
            attachment
            for attachment in self.attachments
            if attachment.message_id in merchant_message_ids
        ]

    def _render_evidence_files(self, request: Request) -> None:
        """All merchant evidence consolidated, with checkboxes feeding the
        "Merge into PDF" action for mergeable files."""
        if self.thread is None:
            return
        attachments = self._merchant_attachments()
        merged_files = [a for a in self.attachments if a.message_id is None]
        if not attachments and not merged_files:
            return
        case = self.thread[0]
        merge_url = str(
            request.url_for("support_cases:attachments_merge", case_id=case.id)
        )
        with tag.form(
            method="post",
            action=merge_url,
            hx_post=merge_url,
            hx_target=f"#{MERGED_PDFS_REGION_ID}",
            hx_swap="outerHTML",
            _="on htmx:afterRequest[detail.elt is me and detail.successful] "
            "from me reset() me "
            "then add @disabled to first <button[type='submit']/> in me",
            classes="flex flex-col gap-2 px-4 pb-4 border-t border-base-300 pt-4",
        ):
            with tag.div(
                classes="text-xs uppercase tracking-wide text-base-content/40"
            ):
                text(f"Merchant submitted files ({len(attachments)})")
            mergeable_count = 0
            for attachment in attachments:
                with tag.div(classes="flex items-center gap-3"):
                    if is_mergeable(attachment.file.mime_type):
                        mergeable_count += 1
                        with tag.input(
                            type="checkbox",
                            name="attachment_ids",
                            value=str(attachment.id),
                            classes="checkbox checkbox-sm flex-none",
                        ):
                            pass
                    else:
                        with tag.div(classes="w-5 flex-none"):
                            pass
                    render_attachment_pill(request, attachment)
            if mergeable_count > 0:
                with tag.div(classes="mt-2"):
                    with button(
                        size="sm",
                        outline=True,
                        type="submit",
                        disabled=True,
                        _="on change from closest <form/> "
                        "if <input[name='attachment_ids']:checked/> "
                        "in closest <form/> is empty "
                        "add @disabled else remove @disabled",
                    ):
                        with tag.span(classes="icon-file-text"):
                            pass
                        text("Merge into PDF")
            render_merged_pdfs_region(request, case.id, merged_files)

    @contextlib.contextmanager
    def _fact(self, label: str) -> Generator[None]:
        with tag.div(classes="flex flex-col gap-1 min-w-0"):
            with tag.div(
                classes="text-xs uppercase tracking-wide text-base-content/40"
            ):
                text(label)
            with tag.div(classes="text-sm"):
                yield

    def _render_processor_id(self, dispute: Dispute) -> None:
        processor_id = dispute.payment_processor_id
        assert processor_id is not None
        if dispute.payment_processor == PaymentProcessor.stripe:
            with tag.a(
                href=f"https://dashboard.stripe.com/disputes/{processor_id}",
                classes="link inline-flex items-center gap-1 font-mono text-xs "
                "break-all",
            ):
                attr("target", "_blank")
                attr("rel", "noopener noreferrer")
                text(processor_id)
                with tag.div(classes="icon-external-link flex-none not-italic"):
                    pass
        else:
            with tag.span(classes="font-mono text-xs break-all"):
                text(processor_id)

    def _render_evidence_due(self, dispute: Dispute) -> None:
        if dispute.evidence_due_by is None:
            with tag.span(classes="text-base-content/50"):
                text("—")
            return
        when = dispute.evidence_due_by.strftime(f"%b {dispute.evidence_due_by.day}, %Y %H:%M UTC")
        if dispute.past_due:
            with tag.span(classes="text-error font-medium"):
                text(f"{when} · Past due")
        else:
            text(when)

    @staticmethod
    def _dispute_reason(dispute: Dispute) -> str:
        if dispute.reason is None:
            return "—"
        label = dispute.reason.replace("_", " ").capitalize()
        if dispute.network_reason_code:
            return f"{label} ({dispute.network_reason_code})"
        return label

    # -- Timeline -----------------------------------------------------------

    def _render_timeline(
        self, request: Request, messages: Sequence[SupportCaseMessage]
    ) -> None:
        with tag.div(classes="relative"):
            # The rail line, centered under the icon nodes (w-9 → center 18px).
            with tag.div(
                classes="absolute left-[18px] top-5 bottom-5 w-px bg-base-300"
            ):
                pass
            with tag.div(
                classes="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-x-6 gap-y-10"
            ):
                for message in messages:
                    self._render_entry(request, message)

    def _render_entry(self, request: Request, message: SupportCaseMessage) -> None:
        is_event = message.type != SupportCaseMessageType.chat
        internal = not message.audience

        # Left cell: icon node + title + muted metadata.
        with tag.div(classes="flex gap-3"):
            icon, node = self._node(message, internal)
            # Opaque base hides the rail line behind translucent node tints.
            with tag.div(
                classes="relative z-10 flex-none w-9 h-9 rounded-full bg-base-100"
            ):
                with tag.div(
                    classes="w-full h-full rounded-full "
                    f"flex items-center justify-center {node}"
                ):
                    with tag.span(classes=f"{icon} text-base"):
                        pass
            with tag.div(classes="min-w-0 pt-1"):
                with tag.div(classes="text-sm font-medium leading-tight"):
                    text(self._title(message, internal))
                for line in self._meta_lines(message, is_event, internal):
                    with tag.div(classes="text-xs text-base-content/40 mt-0.5"):
                        text(line)

        # Right cell: conversation content (empty for pure milestones).
        self._render_content(request, message, is_event, internal)

    def _node(self, message: SupportCaseMessage, internal: bool) -> tuple[str, str]:
        if message.type != SupportCaseMessageType.chat:
            return _EVENT_NODES[message.type]
        if internal:
            return "icon-lock", "bg-warning/20 text-warning"
        if message.author_kind == SupportCaseMessageAuthorKind.merchant:
            return "icon-store", "bg-base-200 text-base-content/70"
        return "icon-headset", "bg-info/15 text-info"

    def _title(self, message: SupportCaseMessage, internal: bool) -> str:
        if message.type == SupportCaseMessageType.opened:
            return _OPENED_TITLES.get(self._case_type, "Case opened")
        if message.type != SupportCaseMessageType.chat:
            return _EVENT_TITLES[message.type]
        if internal:
            return "Internal note"
        return _AUTHOR_LABELS.get(message.author_kind, str(message.author_kind))

    def _meta_lines(
        self, message: SupportCaseMessage, is_event: bool, internal: bool
    ) -> list[str]:
        when = message.created_at.strftime(f"%b {message.created_at.day}, %H:%M UTC")
        email = (
            self.author_emails.get(message.author_user_id)
            if message.author_user_id
            else None
        )
        # The title carries the role for chat; events/notes name the actor. The
        # email is the concrete identity. One piece of metadata per line.
        if is_event or internal:
            who = email or _AUTHOR_LABELS.get(
                message.author_kind, str(message.author_kind)
            )
            return [f"by {who}", when]
        return [email, when] if email else [when]

    def _render_content(
        self,
        request: Request,
        message: SupportCaseMessage,
        is_event: bool,
        internal: bool,
    ) -> None:
        attachments = self.attachments_by_message.get(message.id, [])
        if not message.body and not attachments:
            # Milestone with no body still occupies its grid cell.
            with tag.div():
                pass
            return

        merchant = message.author_kind == SupportCaseMessageAuthorKind.merchant
        justify = "justify-end" if merchant else "justify-start"
        with tag.div(classes="flex flex-col gap-2"):
            if message.body:
                with tag.div(classes=f"flex {justify}"):
                    with tag.div(
                        classes=f"max-w-md text-sm leading-relaxed whitespace-pre-wrap p-3 rounded-s {self._bubble(message, internal)}"
                    ):
                        text(message.body)
            for attachment in attachments:
                with tag.div(classes=f"flex {justify}"):
                    render_attachment_pill(request, attachment)

    def _bubble(self, message: SupportCaseMessage, internal: bool) -> str:
        if internal:
            return (
                "bg-warning/10 border-l-2 border-warning rounded-2xl px-5 py-3.5 "
                "text-base-content/80"
            )
        if message.type == SupportCaseMessageType.appeal_approved:
            return "bg-success/10 rounded-2xl px-5 py-3.5"
        if message.type == SupportCaseMessageType.appeal_denied:
            return "bg-error/10 rounded-2xl px-5 py-3.5"
        if message.author_kind == SupportCaseMessageAuthorKind.merchant:
            return "bg-info/10 rounded-2xl px-5 py-3.5"
        return "bg-base-200 rounded-2xl px-5 py-3.5"

    # -- Composer -----------------------------------------------------------

    def _render_composer(
        self, request: Request, case: SupportCase, is_open: bool
    ) -> None:
        reply_url = self._with_return_to(
            str(request.url_for("support_cases:reply", case_id=case.id))
        )
        # A closed case only takes internal follow-ups after the decision.
        internal_only = not is_open
        with tag.div(classes="mt-8 pt-6 border-t border-base-300"):
            if not is_open:
                with tag.div(
                    classes="flex items-center gap-2 mb-3 text-sm text-base-content/60"
                ):
                    with tag.span(classes="icon-square"):
                        pass
                    text("This case is closed — only internal notes can be added.")
            with tag.form(hx_post=reply_url, classes="flex flex-col gap-3"):
                with tag.textarea(
                    name="body",
                    classes="textarea textarea-bordered w-full rounded-lg",
                    placeholder="Add an internal note…"
                    if internal_only
                    else "Write a reply to the merchant…",
                    rows="3",
                    required=True,
                ):
                    pass
                with tag.div(classes="flex items-center justify-between"):
                    if internal_only:
                        with tag.span(
                            classes="flex items-center gap-2 text-sm "
                            "text-base-content/60"
                        ):
                            with tag.span(classes="icon-lock"):
                                pass
                            text("Internal note — not visible to the merchant")
                    else:
                        with tag.label(
                            classes="flex items-center gap-2 cursor-pointer "
                            "text-sm text-base-content/60"
                        ):
                            with tag.input(
                                type="checkbox",
                                name="internal",
                                value="1",
                                classes="checkbox checkbox-sm",
                            ):
                                pass
                            text("Internal note — not visible to the merchant")
                    with button(variant="primary", size="sm", type="submit"):
                        text("Add note" if internal_only else "Send")


__all__ = ["SupportCaseSection"]
