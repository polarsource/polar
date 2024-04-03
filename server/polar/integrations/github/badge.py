from dataclasses import dataclass

import structlog
from githubkit import AppInstallationAuthStrategy, GitHub

from polar.config import settings
from polar.kit import template
from polar.models import Issue, Organization, Repository

from . import client as github
from . import types

log = structlog.get_logger()

ShouldEmbed = bool
ShouldEmbedReason = str


PLEDGE_BADGE_COMMENT_LEGACY = "<!-- POLAR PLEDGE BADGE -->"
PLEDGE_BADGE_COMMENT_START = "<!-- POLAR PLEDGE BADGE START -->"
PLEDGE_BADGE_COMMENT_END = "<!-- POLAR PLEDGE BADGE END -->"


@dataclass
class GithubBadge:
    organization: Organization
    repository: Repository
    issue: Issue

    @classmethod
    def should_add_badge(
        cls,
        organization: Organization,
        repository: Repository,
        issue: Issue,
        triggered_from_label: bool,
    ) -> tuple[ShouldEmbed, ShouldEmbedReason]:
        if not settings.GITHUB_BADGE_EMBED:
            return (False, "app_badge_not_enabled")

        if organization.installation_id is None:
            return (False, "org_not_installed")

        # Triggered by label
        if triggered_from_label:
            return (True, "triggered_from_label")

        if issue.pledge_badge_ever_embedded:
            return (False, "badge_previously_embedded")

        # Auto mode is on
        if repository.pledge_badge_auto_embed:
            return (True, "repository_pledge_badge_auto_embed")

        return (False, "fallthrough")

    @classmethod
    def should_remove_badge(
        cls,
        organization: Organization,
        repository: Repository,
        issue: Issue,
        triggered_from_label: bool,
    ) -> tuple[ShouldEmbed, ShouldEmbedReason]:
        if not settings.GITHUB_BADGE_EMBED:
            return (False, "app_badge_not_enabled")

        if organization.installation_id is None:
            return (False, "org_not_installed")

        if triggered_from_label:
            return (True, "triggered_from_label")

        if issue.has_pledge_badge_label:
            return (False, "issue_has_label")

        return (True, "fallthrough")

    def generate_svg_url(self, darkmode: bool = False) -> str:
        return "{base}/api/github/{org}/{repo}/issues/{number}/pledge.svg{maybeDarkmode}".format(  # noqa: E501
            base=settings.FRONTEND_BASE_URL,
            org=self.organization.name,
            repo=self.repository.name,
            number=self.issue.number,
            maybeDarkmode="?darkmode=1" if darkmode else "",
        )

    def generate_funding_url(self) -> str:
        return f"{settings.FRONTEND_BASE_URL}/{self.organization.name}/{self.repository.name}/issues/{self.issue.number}"

    def badge_markdown(self, message: str) -> str:
        funding_url = self.generate_funding_url()

        darkmode_url = self.generate_svg_url(darkmode=True)
        lightmode_url = self.generate_svg_url(darkmode=False)

        message = message.rstrip()
        if message:
            message += "\n\n"

        # Note: the newline between <a> and <picture> is important. GitHubs markdown
        # parser freaks out if it isn't there!
        return f"""{PLEDGE_BADGE_COMMENT_START}
{message}<a href="{funding_url}">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="{darkmode_url}">
  <img alt="Fund with Polar" src="{lightmode_url}">
</picture>
</a>
{PLEDGE_BADGE_COMMENT_END}
"""

    def _legacy_badge_markdown(self) -> str:
        svg_url = self.generate_svg_url()
        funding_url = self.generate_funding_url()
        svg_markdown = f"![Fund with Polar]({svg_url})"
        return f"{PLEDGE_BADGE_COMMENT_LEGACY}\n[{svg_markdown}]({funding_url})"

    @classmethod
    def generate_default_promotion_message(cls, organization: Organization) -> str:
        return template.render(
            template.path(__file__, "templates/badge/promotion.md"),
            polar_site_url=organization.polar_site_url,
        )

    def promotion_message(self) -> str:
        if self.issue.badge_custom_content:
            return self.issue.badge_custom_content
        if self.organization.default_badge_custom_content:
            return self.organization.default_badge_custom_content
        return self.generate_default_promotion_message(self.organization)

    def generate_body_with_badge(self, body: str) -> str:
        promotion = self.promotion_message().rstrip()

        # Remove badge from message if already embedded
        if self.badge_is_embedded(body):
            body = self.generate_body_without_badge(body)

        return f"{body}\n\n{self.badge_markdown(promotion)}"

    def generate_body_without_badge(self, body: str) -> str:
        # Remove content between tags
        if PLEDGE_BADGE_COMMENT_START in body and PLEDGE_BADGE_COMMENT_END in body:
            start_idx = body.rfind(PLEDGE_BADGE_COMMENT_START)
            end_idx = body.rfind(PLEDGE_BADGE_COMMENT_END)
            res = body[0:start_idx] + body[end_idx + len(PLEDGE_BADGE_COMMENT_END) :]
            return res.rstrip()

        legacy_badge_markdown = self._legacy_badge_markdown()

        if body.endswith(legacy_badge_markdown):
            # If the badge is at the end of the body, we remove it plus any trailing
            # whitespace (as we added some)
            return body[: -len(legacy_badge_markdown)].rstrip()
        else:
            # Otherwise, we just remove the (first) badge markdown
            return body.replace(legacy_badge_markdown, "", 1)

    @classmethod
    def badge_is_embedded(cls, body: str) -> bool:
        if PLEDGE_BADGE_COMMENT_START in body or PLEDGE_BADGE_COMMENT_LEGACY in body:
            return True
        return False

    async def get_current_body(
        self, client: GitHub[AppInstallationAuthStrategy]
    ) -> str:
        latest = await client.rest.issues.async_get(
            owner=self.organization.name,
            repo=self.repository.name,
            issue_number=self.issue.number,
        )
        github.ensure_expected_response(latest)
        data = latest.parsed_data
        body = ""
        if data.body:
            body = data.body
        return body

    async def update_body(
        self, client: GitHub[AppInstallationAuthStrategy], body: str
    ) -> types.Issue:
        updated = await client.rest.issues.async_update(
            owner=self.organization.name,
            repo=self.repository.name,
            issue_number=self.issue.number,
            body=body,
        )
        github.ensure_expected_response(updated)
        return updated.parsed_data

    async def embed(self) -> None:
        client = github.get_app_installation_client(
            self.organization.safe_installation_id
        )

        body = await self.get_current_body(client)

        body_with_badge = self.generate_body_with_badge(body)

        if body_with_badge == body:
            log.info("github.badge.embed.is_already_embedded", issue_id=self.issue.id)
            return None

        await self.update_body(client, body_with_badge)
        log.info("github.badge.embed.embedded", issue_id=self.issue.id)
        return None

    async def remove(self) -> None:
        client = github.get_app_installation_client(
            self.organization.safe_installation_id
        )

        body = await self.get_current_body(client)
        if not self.badge_is_embedded(body):
            log.info("github.badge.remove.is_not_embedded", issue_id=self.issue.id)
            return None

        body_without_badge = self.generate_body_without_badge(body)
        await self.update_body(client, body_without_badge)
        log.info("github.badge.remove.removed", issue_id=self.issue.id)
        return None
