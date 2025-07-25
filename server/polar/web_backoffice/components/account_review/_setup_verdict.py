import contextlib
from collections.abc import Generator
from typing import Any
from urllib.parse import urlparse

from tagflow import tag, text


class SetupVerdict:
    """Component for evaluating organization integration setup status."""

    def __init__(self, data: dict[str, Any]) -> None:
        self.data = data

    @property
    def verdict_text(self) -> str:
        """Get the verdict text based on setup score."""
        score = self.data.get("setup_score", 0)
        if score >= 3:
            return "COMPLETE"
        elif score >= 1:
            return "PARTIAL"
        else:
            return "INCOMPLETE"

    def verdict_classes(self, verdict: str) -> str:
        """Get CSS classes for the verdict badge."""
        if verdict.upper() == "COMPLETE":
            return "bg-green-100 text-green-800"
        elif verdict.upper() == "PARTIAL":
            return "bg-yellow-100 text-yellow-800"
        else:  # FAIL
            return "bg-red-100 text-red-800"

    @property
    def assessment_text(self) -> str:
        """Get assessment explanation text."""
        score = self.data.get("setup_score", 0)
        issues = self.data.get("issues", [])

        if score >= 3:
            return "Organization has proper integration setup with domain validation, benefits, and webhooks configured."
        elif score >= 1:
            issue_text = ", ".join(issues) if issues else "incomplete configuration"
            return f"Organization has partial setup but is missing: {issue_text}."
        else:
            return "Organization has minimal integration setup. Missing domain validation, benefits configuration, and webhook setup."

    @property
    def risk_level(self) -> str:
        """Get risk level based on setup score."""
        score = self.data.get("setup_score", 0)
        if score >= 3:
            return "green"  # Complete setup
        elif score >= 1:
            return "yellow"  # Partial setup
        else:
            return "red"  # Incomplete setup

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        """Render the setup verdict component."""
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title flex items-center gap-2"):
                text("Integration Setup")
                # Risk indicator circle
                with tag.div(classes=f"w-3 h-3 rounded-full bg-{self.risk_level}-500"):
                    pass
                # Verdict text
                with tag.span(
                    classes=f"px-2 py-1 text-xs font-medium {self.verdict_classes(self.verdict_text)}"
                ):
                    text(self.verdict_text)

            # Setup details
            with tag.div(classes="space-y-3"):
                # Domain validation
                domain_check = self.data.get("domain_validation", False)
                with tag.div(classes="flex items-center gap-2"):
                    if domain_check:
                        with tag.div(classes="w-2 h-2 rounded-full bg-green-500"):
                            pass
                        text("Success URLs match organization domain")
                    else:
                        with tag.div(classes="w-2 h-2 rounded-full bg-red-500"):
                            pass
                        text("Success URLs do not match organization domain")

                # Benefits configuration
                benefits_check = self.data.get("benefits_configured", False)
                benefits_count = self.data.get("benefits_count", 0)
                with tag.div(classes="flex items-center gap-2"):
                    if benefits_check:
                        with tag.div(classes="w-2 h-2 rounded-full bg-green-500"):
                            pass
                        text(f"Benefits configured ({benefits_count} active)")
                    else:
                        with tag.div(classes="w-2 h-2 rounded-full bg-red-500"):
                            pass
                        text("No benefits configured")

                # Webhook configuration
                webhooks_check = self.data.get("webhooks_configured", False)
                webhooks_count = self.data.get("webhooks_count", 0)
                with tag.div(classes="flex items-center gap-2"):
                    if webhooks_check:
                        with tag.div(classes="w-2 h-2 rounded-full bg-green-500"):
                            pass
                        text(f"Webhooks configured ({webhooks_count} endpoints)")
                    else:
                        with tag.div(classes="w-2 h-2 rounded-full bg-red-500"):
                            pass
                        text("No webhooks configured")

            # Assessment explanation
            with tag.div(classes="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded"):
                with tag.div(classes="text-sm font-medium mb-1"):
                    text("Assessment Details:")
                with tag.p(classes="text-sm text-gray-700 dark:text-gray-300"):
                    text(self.assessment_text)

        yield


def extract_domain(url: str) -> str:
    """Extract domain from URL."""
    if not url:
        return ""

    # Add protocol if missing
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        parsed = urlparse(url)
        return parsed.netloc.lower()
    except Exception:
        return ""


def check_domain_match(org_domain: str, success_urls: list[str]) -> bool:
    """Check if success URLs match organization domain."""
    if not org_domain or not success_urls:
        return False

    org_domain = extract_domain(org_domain)
    if not org_domain:
        return False

    for url in success_urls:
        url_domain = extract_domain(url)
        if url_domain and (
            url_domain == org_domain or url_domain.endswith("." + org_domain)
        ):
            return True

    return False
