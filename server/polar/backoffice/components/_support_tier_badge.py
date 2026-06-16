from tagflow import tag, text

from polar.models.organization import SupportTier

_TIER_BADGE_CLASS: dict[SupportTier, str] = {
    SupportTier.pro: "badge-ghost border border-base-300",
    SupportTier.growth: "badge-info",
    SupportTier.scale: "badge-secondary",
}


def support_tier_badge(level: int | None, *, size: str = "badge-sm") -> None:
    tier = SupportTier.from_level(level)
    if tier is None:
        return
    with tag.span(
        classes=f"badge {size} {_TIER_BADGE_CLASS[tier]}",
        title=f"{tier.get_display_name()} support tier",
        **{"aria-label": "support tier"},
    ):
        text(tier.get_display_name())


__all__ = ["support_tier_badge"]
