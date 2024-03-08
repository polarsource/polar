from typing import Any, cast

import structlog
from githubkit.exception import RateLimitExceeded, RequestError, RequestTimeout

from polar.authz.service import AccessType, Authz
from polar.config import settings
from polar.integrations.github import client as github
from polar.integrations.github import types
from polar.logging import Logger
from polar.models import Repository, Subscription, User
from polar.models.subscription_benefit import (
    SubscriptionBenefitGitHubRepository,
    SubscriptionBenefitGitHubRepositoryProperties,
)
from polar.models.user import OAuthPlatform
from polar.notifications.notification import (
    SubscriptionBenefitPreconditionErrorNotificationContextualPayload,
)
from polar.posthog import posthog
from polar.repository.service import repository as repository_service

from .base import (
    SubscriptionBenefitPreconditionError,
    SubscriptionBenefitPropertiesValidationError,
    SubscriptionBenefitRetriableError,
    SubscriptionBenefitServiceProtocol,
)

log: Logger = structlog.get_logger()

precondition_error_subject_template = "Action required: get access to {extra_context[repository_owner]}/{extra_context[repository_name]} repository"
precondition_error_body_template = """
<h1>Hi,</h1>
<p>You just subscribed to {organization_name}'s plan, <strong>{subscription_tier_name}</strong>. Thank you!</p>
<p>As you may now, it includes an access to {extra_context[repository_owner]}/{extra_context[repository_name]} repository on GitHub. To grant you access, we need you to link your GitHub account on Polar.</p>
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


class SubscriptionBenefitGitHubRepositoryService(
    SubscriptionBenefitServiceProtocol[
        SubscriptionBenefitGitHubRepository,
        SubscriptionBenefitGitHubRepositoryProperties,
    ]
):
    async def grant(
        self,
        benefit: SubscriptionBenefitGitHubRepository,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            subscription_id=str(subscription.id),
            user_id=str(user.id),
        )
        bound_logger.debug("Grant benefit")

        repository_id = benefit.properties["repository_id"]
        repository = await repository_service.get(
            self.session, repository_id, load_organization=True
        )
        assert repository is not None
        organization = repository.organization
        assert organization is not None
        installation_id = organization.installation_id
        assert installation_id is not None
        permission = benefit.properties["permission"]

        oauth_account = user.get_oauth_account(OAuthPlatform.github)
        if oauth_account is None or oauth_account.account_username is None:
            raise SubscriptionBenefitPreconditionError(
                "GitHub account not linked",
                payload=SubscriptionBenefitPreconditionErrorNotificationContextualPayload(
                    subject_template=precondition_error_subject_template,
                    body_template=precondition_error_body_template,
                    extra_context={
                        "repository_owner": organization.name,
                        "repository_name": repository.name,
                        "url": settings.generate_frontend_url("/settings"),
                    },
                ),
            )

        client = github.get_app_installation_client(installation_id)

        # If we already granted this benefit, make sure we revoke the previous config
        if update and grant_properties:
            bound_logger.debug("Grant benefit update")
            invitation = await self._get_invitation(
                client, repository, int(oauth_account.account_id)
            )
            # The repository changed, or the invitation is still pending: revoke
            if (
                repository_id != grant_properties["repository_id"]
                or invitation is not None
            ):
                await self.revoke(
                    benefit, subscription, user, grant_properties, attempt=attempt
                )
            # The permission changed, and the invitation is already accepted
            elif permission != grant_properties["permission"]:
                # The permission change will be handled by the add_collaborator call
                pass

        try:
            await client.rest.repos.async_add_collaborator(
                owner=organization.name,
                repo=repository.name,
                username=oauth_account.account_username,
                data={"permission": permission},
            )
        except RateLimitExceeded as e:
            raise SubscriptionBenefitRetriableError(
                int(e.retry_after.total_seconds())
            ) from e
        except (RequestTimeout, RequestError) as e:
            raise SubscriptionBenefitRetriableError(2**attempt) from e

        bound_logger.debug("Benefit granted")

        # Store repository and permission to compare on update
        return {
            "repository_id": str(repository_id),
            "permission": permission,
        }

    async def revoke(
        self,
        benefit: SubscriptionBenefitGitHubRepository,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        bound_logger = log.bind(
            benefit_id=str(benefit.id),
            subscription_id=str(subscription.id),
            user_id=str(user.id),
        )

        repository_id = benefit.properties["repository_id"]
        repository = await repository_service.get(
            self.session, repository_id, load_organization=True
        )
        assert repository is not None
        organization = repository.organization
        assert organization is not None
        installation_id = organization.installation_id
        assert installation_id is not None

        oauth_account = user.get_oauth_account(OAuthPlatform.github)
        if oauth_account is None:
            raise

        client = github.get_app_installation_client(installation_id)

        invitation = await self._get_invitation(
            client, repository, int(oauth_account.account_id)
        )
        if invitation is not None:
            bound_logger.debug("Invitation not yet accepted, removing it")
            revoke_request = client.rest.repos.async_delete_invitation(
                organization.name, repository.name, invitation.id
            )
        else:
            bound_logger.debug("Invitation not found, removing the user")
            revoke_request = client.rest.repos.async_remove_collaborator(
                organization.name, repository.name, user.username
            )

        try:
            await revoke_request
        except RateLimitExceeded as e:
            raise SubscriptionBenefitRetriableError(
                int(e.retry_after.total_seconds())
            ) from e
        except (RequestTimeout, RequestError) as e:
            raise SubscriptionBenefitRetriableError(2**attempt) from e

        bound_logger.debug("Benefit revoked")

        return {}

    async def requires_update(
        self,
        benefit: SubscriptionBenefitGitHubRepository,
        previous_properties: SubscriptionBenefitGitHubRepositoryProperties,
    ) -> bool:
        new_properties = benefit.properties
        return (
            new_properties["repository_id"] != previous_properties["repository_id"]
            or new_properties["permission"] != previous_properties["permission"]
        )

    async def validate_properties(
        self, user: User, properties: dict[str, Any]
    ) -> SubscriptionBenefitGitHubRepositoryProperties:
        repository_id = properties["repository_id"]

        repository = await repository_service.get(
            self.session, repository_id, load_organization=True
        )

        if repository is None:
            raise SubscriptionBenefitPropertiesValidationError(
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
            raise SubscriptionBenefitPropertiesValidationError(
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
                raise SubscriptionBenefitPropertiesValidationError(
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
            SubscriptionBenefitGitHubRepositoryProperties,
            {
                **properties,
                "repository_owner": repository.organization.name,
                "repository_name": repository.name,
            },
        )

    async def _get_invitation(
        self, client: github.GitHub[Any], repository: Repository, user_id: int
    ) -> types.RepositoryInvitation | None:
        async for invitation in client.paginate(
            client.rest.repos.async_list_invitations,
            owner=repository.organization.name,
            repo=repository.name,
        ):
            if invitation.invitee and invitation.invitee.id == user_id:
                return invitation

        return None
