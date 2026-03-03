"""Known-good integration platform domains for organization reviews.

Used by the AI review agent to avoid false-positive flags on legitimate
third-party webhook and checkout URL domains.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class KnownDomain:
    """A known-good integration platform domain."""

    pattern: str
    name: str
    category: str

    def matches(self, domain: str) -> bool:
        """Check if *domain* matches this pattern.

        Exact patterns match literally; wildcard patterns (``*.example.com``)
        match any subdomain of ``example.com`` via suffix check on
        ``.example.com``.  The bare root (``example.com``) is **not** matched
        by a wildcard pattern — only actual subdomains qualify.
        """
        if self.pattern.startswith("*."):
            suffix = self.pattern[1:]  # e.g. ".supabase.co"
            return domain.endswith(suffix) and domain != suffix.lstrip(".")
        return domain == self.pattern


# -- Domain whitelist (single source of truth) --

KNOWN_DOMAINS: list[KnownDomain] = [
    # Analytics
    KnownDomain("datafa.st", "Datafast", "analytics"),
    # Messaging
    KnownDomain("discord.com", "Discord", "messaging"),
    KnownDomain("discordapp.com", "Discord", "messaging"),
    KnownDomain("hooks.slack.com", "Slack", "messaging"),
    # Affiliate
    KnownDomain("affonso.io", "Affonso", "affiliate"),
    # Automation
    KnownDomain("hooks.zapier.com", "Zapier", "automation"),
    KnownDomain("*.make.com", "Make.com", "automation"),
    KnownDomain("webhook.ottokit.com", "OttoKit", "automation"),
    KnownDomain("hkdk.events", "Hookdeck", "automation"),
    KnownDomain("play.svix.com", "Svix", "automation"),
    KnownDomain("script.google.com", "Google Apps Script", "automation"),
    # Integration
    KnownDomain("nifty.codes", "Nifty Codes", "integration"),
    # CRM
    KnownDomain("services.leadconnectorhq.com", "GoHighLevel", "crm"),
    # Backend
    KnownDomain("*.supabase.co", "Supabase", "backend"),
    KnownDomain("*.convex.site", "Convex", "backend"),
    KnownDomain("*.convex.cloud", "Convex", "backend"),
]


def match_known_domain(domain: str) -> KnownDomain | None:
    """Return the first matching :class:`KnownDomain`, or ``None``."""
    for kd in KNOWN_DOMAINS:
        if kd.matches(domain):
            return kd
    return None


def known_domains_for_prompt() -> str:
    """Format the whitelist as a block for inclusion in AI prompts."""
    lines: list[str] = []
    for kd in KNOWN_DOMAINS:
        lines.append(f"- {kd.pattern} ({kd.name}, {kd.category})")
    return "\n".join(lines)
