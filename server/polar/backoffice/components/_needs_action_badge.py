from tagflow import tag, text

from polar.models.support_case import SupportCaseType

_NEEDS_ACTION_LABELS: dict[SupportCaseType, str] = {
    SupportCaseType.dispute: "Review evidence",
    SupportCaseType.review_appeal: "Needs reply",
}


def needs_action_badge(case_type: SupportCaseType, *, size: str = "badge-sm") -> None:
    with tag.div(classes=f"badge badge-neutral {size}"):
        text(_NEEDS_ACTION_LABELS[case_type])


__all__ = ["needs_action_badge"]
