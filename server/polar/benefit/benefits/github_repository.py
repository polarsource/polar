from typing import Any, cast

import structlog
from githubkit import AppInstallationAuthStrategy, GitHub
from githubkit.exception import RateLimitExceeded, RequestError, RequestTimeout

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.authz.service import AccessType, Authz
from polar.config import settings
from polar.integrations.github import client as github
from polar.integrations.github import types
from polar.integrations.github_repository_benefit.service import (
    github_repository_benefit_user_service,
)
from polar.logging import Logger
from polar.models import Organization, User
from polar.models.benefit import (
    BenefitGitHubRepository,
    BenefitGitHubRepositoryProperties,
)
from polar.models.user import OAuthPlatform
from polar.notifications.notification import (
    BenefitPreconditionErrorNotificationContextualPayload,
)
from polar.posthog import posthog
from polar.repository.service import repository as repository_service

from .base import (
    BenefitPreconditionError,
    BenefitPropertiesValidationError,
    BenefitRetriableError,
    BenefitServiceProtocol,
)

log: Logger = structlog.get_logger()

precondition_error_subject_template = "Action required: get access to {extra_context[repository_owner]}/{extra_context[repository_name]} repository"
precondition_error_body_template = """
<h1>Hi,</h1>
<p>You just subscribed to <strong>{scope_name}</strong> from {organization_name}. Thank you!</p>
<p>As you may know, it includes an access to {extra_context[repository_owner]}/{extra_context[repository_name]} repository on GitHub. To grant you access, we need you to link your GitHub account on Polar.</p>
<p>Once done, you'll automatically be invited to the repository.</p>
<!-- Action -->
<table class="body-action" align="center" width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
        <td align="center">
            <!-- Border based button
https://litmus.com/blog/a-guide-to-bulletproof-buttons-in-email-design -->
            <table width="100%" border="0" cellspacing="0" cellpadding="0" role="presentation">
                <tr>
                    <td align="center">
                        <a href="{extra_context[url]}" class="f-fallback button">Link GitHub account</a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
<!-- Sub copy -->
<table class="body-sub" role="presentation">
    <tr>
        <td>
            <p class="f-fallback sub">If you're having trouble with the button above, copy and paste the URL below into
                your web browser.</p>
            <p class="f-fallback sub"><a href="{extra_context[url]}">{extra_context[url]}</a></p>
        </td>
    </tr>
</table>
"""


class BenefitGitHubRepositoryService(
    BenefitServiceProtocol[BenefitGitHubRepository, BenefitGitHubRepositoryProperties]
):
    async def grant(
        self,
        benefit: BenefitGitHubRepository,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            user_id=str(user.id),
        )
        bound_logger.debug("Grant benefit")

        client = await self._get_github_app_client(bound_logger, benefit)

        repository_owner = benefit.properties["repository_owner"]
        repository_name = benefit.properties["repository_name"]
        permission = benefit.properties["permission"]

        # When inviting users: Use the users identity from the "main" Polar GitHub App
        oauth_account = user.get_oauth_account(OAuthPlatform.github)
        if oauth_account is None or oauth_account.account_username is None:
            raise BenefitPreconditionError(
                "GitHub account not linked",
                payload=BenefitPreconditionErrorNotificationContextualPayload(
                    subject_template=precondition_error_subject_template,
                    body_template=precondition_error_body_template,
                    extra_context={
                        "repository_owner": repository_owner,
                        "repository_name": repository_name,
                        "url": settings.generate_frontend_url("/settings"),
                    },
                ),
            )

        # If we already granted this benefit, make sure we revoke the previous config
        if update and grant_properties:
            bound_logger.debug("Grant benefit update")
            invitation = await self._get_invitation(
                client,
                repository_owner=repository_owner,
                repository_name=repository_name,
                user_id=int(oauth_account.account_id),
            )
            # The repository changed, or the invitation is still pending: revoke
            if (
                repository_owner != grant_properties["repository_owner"]
                or repository_name != grant_properties["repository_name"]
                or invitation is not None
            ):
                await self.revoke(benefit, user, grant_properties, attempt=attempt)
            # The permission changed, and the invitation is already accepted
            elif permission != grant_properties["permission"]:
                # The permission change will be handled by the add_collaborator call
                pass

        try:
            await client.rest.repos.async_add_collaborator(
                owner=repository_owner,
                repo=repository_name,
                username=oauth_account.account_username,
                data={"permission": permission},
            )
        except RateLimitExceeded as e:
            raise BenefitRetriableError(int(e.retry_after.total_seconds())) from e
        except (RequestTimeout, RequestError) as e:
            raise BenefitRetriableError(2**attempt) from e

        bound_logger.debug("Benefit granted")

        # Store repository and permission to compare on update
        return {
            "repository_owner": repository_owner,
            "repository_name": repository_name,
            "permission": permission,
        }

    async def revoke(
        self,
        benefit: BenefitGitHubRepository,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            user_id=str(user.id),
        )

        if benefit.properties["repository_id"]:
            bound_logger.info("skipping revoke for old version of this benefit type")
            return {}

        client = await self._get_github_app_client(bound_logger, benefit)

        repository_owner = benefit.properties["repository_owner"]
        repository_name = benefit.properties["repository_name"]

        oauth_account = user.get_oauth_account(OAuthPlatform.github)
        if oauth_account is None or oauth_account.account_username is None:
            raise

        invitation = await self._get_invitation(
            client,
            repository_owner=repository_owner,
            repository_name=repository_name,
            user_id=int(oauth_account.account_id),
        )
        if invitation is not None:
            bound_logger.debug("Invitation not yet accepted, removing it")
            revoke_request = client.rest.repos.async_delete_invitation(
                repository_owner, repository_name, invitation.id
            )
        else:
            bound_logger.debug("Invitation not found, removing the user")
            revoke_request = client.rest.repos.async_remove_collaborator(
                repository_owner, repository_name, oauth_account.account_username
            )

        try:
            await revoke_request
        except RateLimitExceeded as e:
            raise BenefitRetriableError(int(e.retry_after.total_seconds())) from e
        except (RequestTimeout, RequestError) as e:
            raise BenefitRetriableError(2**attempt) from e

        bound_logger.debug("Benefit revoked")

        return {}

    async def requires_update(
        self,
        benefit: BenefitGitHubRepository,
        previous_properties: BenefitGitHubRepositoryProperties,
    ) -> bool:
        new_properties = benefit.properties
        return (
            new_properties["repository_owner"]
            != previous_properties["repository_owner"]
            or new_properties["repository_name"]
            != previous_properties["repository_name"]
            or new_properties["permission"] != previous_properties["permission"]
        )

    async def validate_properties(
        self, auth_subject: AuthSubject[User | Organization], properties: dict[str, Any]
    ) -> BenefitGitHubRepositoryProperties:
        if is_organization(auth_subject):
            # TODO: Support organization tokens
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "invalid_auth_subject",
                        "message": (
                            "We do not yet support creating this benefit "
                            "with an organization token."
                        ),
                        "loc": ("repository_owner",),
                        "input": properties["repository_owner"],
                    }
                ]
            )

        assert is_user(auth_subject)
        user = auth_subject.subject

        # old style
        if properties["repository_id"]:
            return await self._validate_properties_repository_id(user, properties)

        repository_owner = properties["repository_owner"]
        repository_name = properties["repository_name"]

        # new style
        oauth = await github_repository_benefit_user_service.get_oauth_account(
            self.session, user
        )
        if not oauth:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "invalid_user_auth",
                        "message": "You have not authenticated with the github_repository_benefit app",
                        "loc": ("repository_owner",),
                        "input": repository_owner,  # ?
                    }
                ]
            )

        # check that use has access to the app installed on this repository
        has_access = (
            await github_repository_benefit_user_service.user_has_access_to_repository(
                oauth,
                owner=repository_owner,
                name=repository_name,
            )
        )

        if not has_access:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "no_repository_acccess",
                        "message": "You don't have access to this repository.",
                        "loc": ("repository_name",),
                        "input": repository_name,
                    }
                ]
            )

        installation = (
            await github_repository_benefit_user_service.get_repository_installation(
                owner=repository_owner,
                name=repository_name,
            )
        )
        if not installation:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "no_repository_installation_found",
                        "message": "Could not find a installation for this repository.",
                        "loc": ("repository_name",),
                        "input": repository_name,
                    }
                ]
            )

        if posthog.client and not posthog.client.feature_enabled(
            "github-benefit-personal-org", user.posthog_distinct_id
        ):
            plan = await github_repository_benefit_user_service.get_billing_plan(
                oauth, installation
            )
            if not plan or plan.is_personal:
                raise BenefitPropertiesValidationError(
                    [
                        {
                            "type": "personal_organization_repository",
                            "message": "For security reasons, "
                            "repositories on personal organizations are not supported.",
                            "loc": ("repository_name",),
                            "input": repository_name,
                        }
                    ]
                )

        return cast(
            BenefitGitHubRepositoryProperties,
            {
                **properties,
            },
        )

    async def _validate_properties_repository_id(
        self, user: User, properties: dict[str, Any]
    ) -> BenefitGitHubRepositoryProperties:
        repository_id = properties["repository_id"]

        repository = await repository_service.get(
            self.session, repository_id, load_organization=True
        )

        if repository is None:
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "invalid_repository",
                        "message": "This repository does not exist.",
                        "loc": ("repository_id",),
                        "input": repository_id,
                    }
                ]
            )

        authz = Authz(self.session)
        if not await authz.can(user, AccessType.write, repository):
            raise BenefitPropertiesValidationError(
                [
                    {
                        "type": "no_repository_acccess",
                        "message": "You don't have access to this repository.",
                        "loc": ("repository_id",),
                        "input": repository_id,
                    }
                ]
            )

        if posthog.client and not posthog.client.feature_enabled(
            "github-benefit-personal-org", user.posthog_distinct_id
        ):
            if repository.organization.is_personal:
                raise BenefitPropertiesValidationError(
                    [
                        {
                            "type": "personal_organization_repository",
                            "message": "For security reasons, "
                            "repositories on personal organizations are not supported.",
                            "loc": ("repository_id",),
                            "input": repository_id,
                        }
                    ]
                )

        return cast(
            BenefitGitHubRepositoryProperties,
            {
                **properties,
                "repository_owner": repository.organization.name,
                "repository_name": repository.name,
            },
        )

    async def _get_invitation(
        self,
        client: github.GitHub[Any],
        *,
        repository_owner: str,
        repository_name: str,
        user_id: int,
    ) -> types.RepositoryInvitation | None:
        async for invitation in client.paginate(
            client.rest.repos.async_list_invitations,
            owner=repository_owner,
            repo=repository_name,
        ):
            if invitation.invitee and invitation.invitee.id == user_id:
                return invitation

        return None

    async def _get_github_app_client(
        self,
        logger: Logger,
        benefit: BenefitGitHubRepository,
    ) -> GitHub[AppInstallationAuthStrategy]:
        # Old integrations, using the "Polar" GitHub App
        if benefit.properties["repository_id"]:
            logger.debug("using legacy integration")
            repository_id = benefit.properties["repository_id"]
            repository = await repository_service.get(
                self.session, repository_id, load_organization=True
            )
            assert repository is not None
            organization = repository.organization
            assert organization is not None
            installation_id = organization.installation_id
            assert installation_id is not None
            return github.get_app_installation_client(
                installation_id, app=github.GitHubApp.polar
            )

        # New integration, using the "Repository Benefit" GitHub App
        logger.debug("using Repository Benefit app integration")

        repository_owner = benefit.properties["repository_owner"]
        repository_name = benefit.properties["repository_name"]
        installation = (
            await github_repository_benefit_user_service.get_repository_installation(
                owner=repository_owner, name=repository_name
            )
        )
        assert installation is not None
        return github.get_app_installation_client(
            installation.id, app=github.GitHubApp.repository_benefit
        )
