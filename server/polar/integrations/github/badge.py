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


PLEDGE_BADGE_COMMENT = "<!-- POLAR PLEDGE BADGE -->"


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
        setting_retroactive_override: bool | None = None,
    ) -> tuple[ShouldEmbed, ShouldEmbedReason]:
        if organization.onboarded_at is None:
            return (False, "org_not_onboarded")

        is_retroactive = issue.issue_created_at < organization.onboarded_at
        if not is_retroactive:
            return (True, "new_issue_post_onboarding")

        if setting_retroactive_override is False:
            return (False, "retroactive_disabled_by_override")

        if setting_retroactive_override is True:
            return (True, "retroactive_enforced_by_override")

        if organization.pledge_badge_retroactive:
            return (True, "org_enabled_retroactive_embed")

        return (False, "org_disabled_retroactive_embed")

    def generate_svg_url(self) -> str:
        return "{base}/api/github/{org}/{repo}/issues/{number}/pledge.svg".format(
            base=settings.FRONTEND_BASE_URL,
            org=self.organization.name,
            repo=self.repository.name,
            number=self.issue.number,
        )

    def generate_funding_url(self) -> str:
        return "{base}/{org}/{repo}/issues/{number}".format(
            base=settings.FRONTEND_BASE_URL,
            org=self.organization.name,
            repo=self.repository.name,
            number=self.issue.number,
        )

    def _badge_markdown(self) -> str:
        svg_url = self.generate_svg_url()
        funding_url = self.generate_funding_url()
        svg_markdown = f"![Fund with Polar]({svg_url})"
        return f"{PLEDGE_BADGE_COMMENT}\n[{svg_markdown}]({funding_url})"

    def generate_body_with_badge(self, body: str) -> str:
        return f"{body}\n\n{self._badge_markdown()}"

    def generate_body_without_badge(self, body: str) -> str:
        badge_markdown = self._badge_markdown()
        if body.endswith(badge_markdown):
            # If the badge is at the end of the body, we remove it plus any trailing
            # whitespace (as we added some)
            return body[: -len(badge_markdown)].rstrip()
        else:
            # Otherwise, we just remove the (first) badge markdown
            return body.replace(badge_markdown, "", 1)

    def legacy_badge_is_embedded(self, body: str) -> bool:
        # Search for legacy markdown.
        #
        # TODO: Remove this? Will only impact our internal Polar repositories
        # which had the old format before comment prefix. They would get duplicates.
        markdown_legacy = "![Funding with Polar]("
        index = body.rfind(markdown_legacy)
        if index != -1:
            return True

        svg_url = self.generate_svg_url()
        index = body.rfind(svg_url)
        return index != -1

    def badge_is_embedded(self, body: str) -> bool:
        index = body.rfind(PLEDGE_BADGE_COMMENT)
        if index != -1:
            return True

        return self.legacy_badge_is_embedded(body)

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
