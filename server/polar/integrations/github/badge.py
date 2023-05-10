import structlog

from polar.config import settings
from polar.models import Organization, Repository, Issue
from githubkit import GitHub, AppInstallationAuthStrategy

from . import client as github
from .exceptions import (
    GithubBadgeAlreadyEmbedded,
    GithubBadgeNotEmbeddable,
    GithubBadgeEmbeddingDisabled,
    GithubBadgeNotEmbedded,
)


log = structlog.get_logger()

ShouldEmbed = bool
ShouldEmbedReason = str


PLEDGE_BADGE_COMMENT_LEGACY = "<!-- POLAR PLEDGE BADGE -->"
PLEDGE_BADGE_COMMENT_START = "<!-- POLAR PLEDGE BADGE START -->"
PLEDGE_BADGE_COMMENT_END = "<!-- POLAR PLEDGE BADGE END -->"


class GithubBadge:
    def __init__(
        self, *, organization: Organization, repository: Repository, issue: Issue
    ):
        self.organization = organization
        self.repository = repository
        self.issue = issue

        self.embedded = False

    @classmethod
    def _log_debug(cls, embed: bool, reason: str) -> None:
        log.debug(
            "github.badge.should_embed",
            embed=embed,
            reason=reason,
        )

    @classmethod
    def should_embed(
        cls,
        organization: Organization,
        repository: Repository,
        issue: Issue,
    ) -> tuple[ShouldEmbed, ShouldEmbedReason]:
        if organization.onboarded_at is None:
            return (False, "org_not_onboarded")

        if repository.pledge_badge:
            return (True, "repository_pledge_badge_enabled")

        return (False, "repository_pledge_badge_disabled")

    def generate_svg_url(self, darkmode=False) -> str:
        return "{base}/api/github/{org}/{repo}/issues/{number}/pledge.svg{maybeDarkmode}".format(  # noqa: E501
            base=settings.FRONTEND_BASE_URL,
            org=self.organization.name,
            repo=self.repository.name,
            number=self.issue.number,
            maybeDarkmode="?darkmode=1" if darkmode else "",
        )

    def generate_funding_url(self) -> str:
        return "{base}/{org}/{repo}/issues/{number}".format(
            base=settings.FRONTEND_BASE_URL,
            org=self.organization.name,
            repo=self.repository.name,
            number=self.issue.number,
        )

    def _badge_markdown(self) -> str:
        funding_url = self.generate_funding_url()

        darkmode_url = self.generate_svg_url(darkmode=True)
        lightmode_url = self.generate_svg_url(darkmode=False)

        return f"""{PLEDGE_BADGE_COMMENT_START}
<a href="{funding_url}">
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

    def generate_body_with_badge(self, body: str) -> str:
        return f"{body}\n\n{self._badge_markdown()}"

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

    def badge_is_embedded(self, body: str) -> bool:
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
        if github.is_set(data, "body") and data.body is not None:
            body = str(data.body)
        return body

    async def update_body(
        self, client: GitHub[AppInstallationAuthStrategy], body: str
    ) -> github.rest.Issue:
        updated = await client.rest.issues.async_update(
            owner=self.organization.name,
            repo=self.repository.name,
            issue_number=self.issue.number,
            body=body,
        )
        github.ensure_expected_response(updated)
        return updated.parsed_data

    async def embed(self) -> github.rest.Issue:
        is_embeddable, reason = self.should_embed(
            self.organization, self.repository, self.issue
        )
        if not is_embeddable:
            raise GithubBadgeNotEmbeddable(reason)

        if not settings.GITHUB_BADGE_EMBED:
            raise GithubBadgeEmbeddingDisabled()

        client = github.get_app_installation_client(self.organization.installation_id)

        body = await self.get_current_body(client)
        if self.badge_is_embedded(body):
            self.embedded = True
            raise GithubBadgeAlreadyEmbedded()

        body_with_badge = self.generate_body_with_badge(body)
        updated = await self.update_body(client, body_with_badge)
        return updated

    async def remove(self) -> github.rest.Issue:
        client = github.get_app_installation_client(self.organization.installation_id)

        body = await self.get_current_body(client)
        if not self.badge_is_embedded(body):
            self.embedded = False
            raise GithubBadgeNotEmbedded()

        body_without_badge = self.generate_body_without_badge(body)
        updated = await self.update_body(client, body_without_badge)
        return updated
