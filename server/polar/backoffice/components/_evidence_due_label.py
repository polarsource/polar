from datetime import datetime

from tagflow import tag, text

from polar.models.dispute import DisputeStatus


def evidence_due_label(
    evidence_due_by: datetime | None,
    past_due: bool | None,
    status: DisputeStatus | None,
) -> None:
    """Dispute evidence deadline. The red "Past due" marker only shows while a
    response is still owed: resolved or under-review disputes keep their stale
    ``past_due`` flag and deadline stamped, so status is the discriminator."""
    if evidence_due_by is None:
        with tag.span(classes="text-base-content/50"):
            text("—")
        return
    when = evidence_due_by.strftime("%b %-d, %Y %H:%M UTC")
    if past_due and status == DisputeStatus.needs_response:
        with tag.span(classes="text-error font-medium"):
            text(f"{when} · Past due")
    else:
        text(when)


__all__ = ["evidence_due_label"]
