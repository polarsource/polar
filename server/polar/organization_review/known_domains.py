"""Known-good integration platform domains for organization reviews.

Used by the AI review agent to avoid false-positive flags on legitimate
third-party webhook and checkout URL domains.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

KnownDomainCategory = Literal[
    "affiliate",
    "analytics",
    "automation",
    "backend",
    "cloud",
    "crm",
    "integration",
    "messaging",
    "no-code-builder",
    "tunneling",
]


@dataclass(frozen=True, slots=True)
class KnownDomain:
    """A known-good integration platform domain."""

    pattern: str
    name: str
    category: KnownDomainCategory

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
    KnownDomain("*.xano.io", "Xano", "backend"),
    # No-code builders
    KnownDomain("lovable.dev", "Lovable", "no-code-builder"),
    KnownDomain("*.lovable.dev", "Lovable", "no-code-builder"),
    KnownDomain("lovable.app", "Lovable", "no-code-builder"),
    KnownDomain("*.lovable.app", "Lovable", "no-code-builder"),
    KnownDomain("*.lovableproject.com", "Lovable", "no-code-builder"),
    # Cloud platforms (managed hosting where merchants run their own backend).
    # Mismatching declared website on these is normal: the website is on a custom
    # domain while the backend lives on the cloud platform's subdomain.
    KnownDomain("*.run.app", "Google Cloud Run", "cloud"),
    KnownDomain("*.cloudfunctions.net", "Google Cloud Functions", "cloud"),
    KnownDomain("*.gateway.dev", "Google API Gateway", "cloud"),
    KnownDomain("*.appspot.com", "Google App Engine", "cloud"),
    KnownDomain("*.firebaseapp.com", "Firebase Hosting", "cloud"),
    KnownDomain("*.web.app", "Firebase Hosting", "cloud"),
    KnownDomain("*.vercel.app", "Vercel", "cloud"),
    KnownDomain("*.netlify.app", "Netlify", "cloud"),
    KnownDomain("*.fly.dev", "Fly.io", "cloud"),
    KnownDomain("*.onrender.com", "Render", "cloud"),
    KnownDomain("*.up.railway.app", "Railway", "cloud"),
    KnownDomain("*.koyeb.app", "Koyeb", "cloud"),
    KnownDomain("*.deno.dev", "Deno Deploy", "cloud"),
    KnownDomain("*.workers.dev", "Cloudflare Workers", "cloud"),
    KnownDomain("*.pages.dev", "Cloudflare Pages", "cloud"),
    KnownDomain("*.amazonaws.com", "AWS", "cloud"),
    KnownDomain("*.execute-api.amazonaws.com", "AWS API Gateway", "cloud"),
    KnownDomain("*.lambda-url.amazonaws.com", "AWS Lambda Function URL", "cloud"),
    KnownDomain("*.azurewebsites.net", "Azure App Service", "cloud"),
    KnownDomain("*.zeabur.app", "Zeabur", "cloud"),
    KnownDomain("*.hstgr.cloud", "Hostinger Cloud", "cloud"),
    # Tunneling (legitimate dev/test webhook destinations)
    KnownDomain("*.ngrok-free.app", "ngrok", "tunneling"),
    KnownDomain("*.ngrok.io", "ngrok", "tunneling"),
    KnownDomain("*.trycloudflare.com", "Cloudflare Tunnel", "tunneling"),
    # Low-code / workflow automation hubs
    KnownDomain("*.app.n8n.cloud", "n8n", "automation"),
    KnownDomain("webhook.suretriggers.com", "SureTriggers", "automation"),
    KnownDomain("hook.us1.make.com", "Make.com", "automation"),
    KnownDomain("hook.eu1.make.com", "Make.com", "automation"),
    KnownDomain("hook.eu2.make.com", "Make.com", "automation"),
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
