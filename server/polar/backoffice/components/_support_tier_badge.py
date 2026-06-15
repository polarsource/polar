from tagflow import tag, text

from polar.models.organization import SupportTier

# Escalating emphasis with tier. Free / NULL renders nothing — it's the floor,
# so a badge on every free org would just be noise.
_TIER_BADGE_CLASS: dict[SupportTier, str] = {
    SupportTier.pro: "badge-ghost border border-base-300",
    SupportTier.growth: "badge-info",
    SupportTier.scale: "badge-secondary",
    SupportTier.enterprise: "badge-primary",
}


def support_tier_badge(tier: SupportTier | None, *, size: str = "badge-sm") -> None:
    """Render a support-tier badge, or nothing for free / NULL (the floor)."""
    if tier is None or tier == SupportTier.free:
        return
    with tag.span(
        classes=f"badge {size} {_TIER_BADGE_CLASS[tier]}",
        title=f"{tier.get_display_name()} support tier",
        **{"aria-label": "support tier"},
    ):
        text(tier.get_display_name())


__all__ = ["support_tier_badge"]
