from tagflow import tag, text

from polar.models.dispute import DisputeStatus

_DISPUTE_STATUS_BADGES: dict[DisputeStatus, tuple[str, str]] = {
    DisputeStatus.needs_response: ("badge-warning", "Needs response"),
    DisputeStatus.under_review: ("badge-info", "Under review"),
    DisputeStatus.prevented: ("badge-success", "Prevented"),
    DisputeStatus.won: ("badge-success", "Won"),
    DisputeStatus.lost: ("badge-error", "Lost"),
    DisputeStatus.early_warning: ("badge-ghost", "Early warning"),
}


def dispute_status_badge(status: DisputeStatus, *, size: str = "badge-sm") -> None:
    classes, label = _DISPUTE_STATUS_BADGES[status]
    with tag.div(classes=f"badge {classes} {size}"):
        text(label)


__all__ = ["dispute_status_badge"]
