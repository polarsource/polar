from dataclasses import dataclass
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends

from polar.account.repository import AccountRepository
from polar.auth.dependencies import Authenticator, WebUserSession
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import Organization as OrganizationModel
from polar.models import PayoutAccount as PayoutAccountModel
from polar.models.account import Account as AccountModel
from polar.oauth2.exceptions import InsufficientScopeError
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import OrganizationID
from polar.payout_account.repository import PayoutAccountRepository
from polar.postgres import AsyncSession, get_db_session

from .policies import finance as finance_policy
from .policies import members
from .policies import organization as org_policy
from .service import get_accessible_org_ids, get_accessible_organization
from .types import PolicyFn


@dataclass(frozen=True)
class AuthzContext[S: User | Organization]:
    """Result of an OrgPolicyGuard dependency.

    Contains both the resolved organization and the authenticated subject,
    so endpoints have a single entry point for auth context.

    The type parameter ``S`` reflects which subject types the guard allows,
    giving endpoints automatic type narrowing without ``assert is_user()``.
    """

    organization: OrganizationModel
    auth_subject: AuthSubject[S]


def OrgPolicyGuard(
    policy_fn: PolicyFn | None = None,
    *,
    allowed_subjects: set[type] | None = None,
    required_scopes: set[Scope] | None = None,
) -> Any:
    """Create a FastAPI dependency that authenticates, resolves an organization,
    and (optionally) checks a policy.

    Steps:
    1. Authenticate the subject via Authenticator.
    2. Resolve the organization from the ``{id}`` path parameter.
    3. Verify the subject is a member of the organization.
    4. Evaluate the policy function if provided.
    5. Return an ``AuthzContext`` (organization + auth_subject).

    Raises:
        Unauthorized (401): The request has no valid credentials, or the
            subject type is not in ``allowed_subjects``.
        InsufficientScopeError (403): The token lacks the required scopes.
        ResourceNotFound (404): The organization does not exist, or the
            subject is not a member of it. Both cases return 404 to avoid
            leaking the existence of organizations the subject cannot access.
        NotPermitted (403): The policy function denied access (e.g. the
            subject is a member but lacks `finance:read` for finance endpoints).
    """

    _allowed = allowed_subjects or {User, Organization}
    _scopes = required_scopes or {
        Scope.organizations_read,
        Scope.organizations_write,
    }

    _authenticator = Authenticator(
        allowed_subjects=_allowed,
        required_scopes=_scopes,
    )

    async def dependency(
        id: OrganizationID,
        auth_subject: Annotated[
            AuthSubject[User | Organization], Depends(_authenticator)
        ],
        session: AsyncSession = Depends(get_db_session),
    ) -> AuthzContext[User | Organization]:
        organization = await get_accessible_organization(session, auth_subject, id)
        if organization is None:
            raise ResourceNotFound()

        if policy_fn is not None:
            result = await policy_fn(session, auth_subject, organization)
            if result is not True:
                raise NotPermitted(result)
        return AuthzContext(organization=organization, auth_subject=auth_subject)

    return dependency


AuthorizeFinanceRead = Annotated[
    AuthzContext[User | Organization],
    Depends(
        OrgPolicyGuard(
            finance_policy.can_read,
            required_scopes={
                Scope.transactions_read,
                Scope.transactions_write,
                Scope.payouts_read,
                Scope.payouts_write,
            },
        )
    ),
]
AuthorizeMembersRead = Annotated[
    AuthzContext[User | Organization],
    Depends(
        OrgPolicyGuard(
            members.can_read,
            required_scopes={
                Scope.organizations_read,
                Scope.organizations_write,
            },
        )
    ),
]
# Both `AuthorizeMembersManage` and `AuthorizeMembersSetRole` enforce the
# same `members:manage` policy; they differ only by the OAuth scope they
# accept. `members:manage` covers invite/remove (general member admin);
# `members:set_role` is a separate scope for the narrower role-change
# action so callers can opt into the lesser privilege.
AuthorizeMembersManage = Annotated[
    AuthzContext[User],
    Depends(
        OrgPolicyGuard(
            members.can_manage,
            allowed_subjects={User},
            required_scopes={Scope.organizations_write},
        )
    ),
]
AuthorizeMembersSetRole = Annotated[
    AuthzContext[User],
    Depends(
        OrgPolicyGuard(
            members.can_manage,
            allowed_subjects={User},
            required_scopes={Scope.members_write},
        )
    ),
]
AuthorizeOrgManage = Annotated[
    AuthzContext[User | Organization],
    Depends(
        OrgPolicyGuard(
            org_policy.can_manage,
            required_scopes={Scope.organizations_write},
        )
    ),
]
AuthorizeOrgManageUser = Annotated[
    AuthzContext[User],
    Depends(
        OrgPolicyGuard(
            org_policy.can_manage,
            allowed_subjects={User},
            required_scopes={Scope.organizations_write},
        )
    ),
]
AuthorizeOrgAccess = Annotated[
    AuthzContext[User | Organization], Depends(OrgPolicyGuard())
]
AuthorizeOrgAccessUser = Annotated[
    AuthzContext[User],
    Depends(
        OrgPolicyGuard(
            allowed_subjects={User},
            required_scopes={Scope.organizations_write},
        )
    ),
]


# ---------------------------------------------------------------------------
# User-personal authorization
# ---------------------------------------------------------------------------
# For endpoints that operate on the authenticated user themselves (own
# profile, own PATs, OAuth identity links, email update, etc.) — i.e. no
# organization resource to authorize against. The user-personal analogue of
# OrgPolicyGuard.
#
# Two prefixes:
#
# - ``AuthorizeWeb{User,Payouts}{Read,Write}`` — User **via web session**
#   only. Rejects API tokens (PATs, OATs, OAuth2 access tokens). Use for
#   browser/dashboard-only flows.
# - ``Authorize{User}{Read,Write}`` — Any User subject (web session, PAT,
#   OAuth2 access token) with the appropriate scope. Use for endpoints that
#   legitimately accept API tokens (e.g. mobile app account deletion).
#
# Read aliases accept either the matching ``_read`` or ``_write`` scope
# (write implies read). Write aliases require the ``_write`` scope. This
# scope check is the read/write gate for impersonation: impersonation
# sessions only carry ``READ_ONLY_SCOPES``, so they are rejected from any
# endpoint requiring a ``_write`` scope — regardless of which prefix is used.
# ---------------------------------------------------------------------------


def WebUserAuthorizer(required_scopes: set[Scope]) -> Any:
    """FastAPI dependency: authenticate as a User **via web session** (via
    ``WebUserSession``, which rejects API tokens) and require at least one
    of the given scopes."""

    async def dependency(
        auth_subject: WebUserSession,
    ) -> AuthSubject[User]:
        if not (auth_subject.scopes & required_scopes):
            raise InsufficientScopeError({s.value for s in required_scopes})
        return auth_subject

    return dependency


AuthorizeWebUserRead = Annotated[
    AuthSubject[User],
    Depends(WebUserAuthorizer({Scope.user_read, Scope.user_write})),
]
AuthorizeWebUserWrite = Annotated[
    AuthSubject[User],
    Depends(WebUserAuthorizer({Scope.user_write})),
]
AuthorizeWebPayoutsRead = Annotated[
    AuthSubject[User],
    Depends(WebUserAuthorizer({Scope.payouts_read, Scope.payouts_write})),
]
AuthorizeWebPayoutsWrite = Annotated[
    AuthSubject[User],
    Depends(WebUserAuthorizer({Scope.payouts_write})),
]


# ``Authorize{User}{Read,Write}`` — any User subject (web, PAT, OAuth2) +
# scope check. Use these only for endpoints that need to accept API tokens.
AuthorizeUserRead = Annotated[
    AuthSubject[User],
    Depends(
        Authenticator(
            allowed_subjects={User},
            required_scopes={Scope.user_read, Scope.user_write},
        )
    ),
]
AuthorizeUserWrite = Annotated[
    AuthSubject[User],
    Depends(
        Authenticator(
            allowed_subjects={User},
            required_scopes={Scope.user_write},
        )
    ),
]


# ---------------------------------------------------------------------------
# Account-based policy guards
# ---------------------------------------------------------------------------
# For endpoints that resolve by account ID or payout account ID (not org ID).
# The guard looks up the owning organization, checks membership + policy.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AuthorizedAccount:
    """Result of an AccountPolicyGuard dependency."""

    account: "AccountModel"
    organization: OrganizationModel
    auth_subject: AuthSubject[User | Organization]


@dataclass(frozen=True)
class AuthorizedPayoutAccount:
    """Result of a PayoutAccountPolicyGuard dependency."""

    payout_account: "PayoutAccountModel"
    auth_subject: AuthSubject[User]


def AccountPolicyGuard(policy_fn: PolicyFn) -> Any:
    """FastAPI dependency: resolve account by {id}, find owning org, check policy.

    Raises:
        Unauthorized (401): No valid credentials.
        ResourceNotFound (404): Account not found or subject has no access
            to the owning organization.
        NotPermitted (403): Subject is a member but the policy denied access.
    """

    _authenticator = Authenticator(
        allowed_subjects={User},
        required_scopes={
            Scope.transactions_read,
            Scope.transactions_write,
            Scope.payouts_read,
            Scope.payouts_write,
        },
    )

    async def dependency(
        id: UUID,
        auth_subject: Annotated[AuthSubject[User], Depends(_authenticator)],
        session: AsyncSession = Depends(get_db_session),
    ) -> AuthorizedAccount:
        account_repo = AccountRepository.from_session(session)
        account = await account_repo.get_by_id(id)
        if account is None:
            raise ResourceNotFound()

        # Find the organization that owns this account
        org_repo = OrganizationRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        organization = await org_repo.get_by_account(account.id)

        if organization is None or organization.id not in org_ids:
            raise ResourceNotFound()

        result = await policy_fn(session, auth_subject, organization)
        if result is not True:
            raise NotPermitted(result)
        return AuthorizedAccount(
            account=account, organization=organization, auth_subject=auth_subject
        )

    return dependency


def PayoutAccountPolicyGuard() -> Any:
    """FastAPI dependency: resolve payout account by {id}, verify ownership.

    Payout accounts are user-owned resources (via ``admin_id``); access
    is granted only to the owning user. There's no role-permission layer
    above ownership, so a single check covers both read and write.

    Raises:
        Unauthorized (401): No valid credentials.
        ResourceNotFound (404): Payout account not found or the
            authenticated user isn't the account's admin.
    """

    _authenticator = Authenticator(
        allowed_subjects={User},
        required_scopes={
            Scope.payouts_read,
            Scope.payouts_write,
        },
    )

    async def dependency(
        id: UUID,
        auth_subject: Annotated[AuthSubject[User], Depends(_authenticator)],
        session: AsyncSession = Depends(get_db_session),
    ) -> AuthorizedPayoutAccount:
        pa_repo = PayoutAccountRepository.from_session(session)
        payout_account = await pa_repo.get_by_id(id)
        if payout_account is None or payout_account.admin_id != auth_subject.subject.id:
            raise ResourceNotFound()

        return AuthorizedPayoutAccount(
            payout_account=payout_account,
            auth_subject=auth_subject,
        )

    return dependency


AuthorizeAccountRead = Annotated[
    AuthorizedAccount, Depends(AccountPolicyGuard(finance_policy.can_read))
]
AuthorizeAccountWrite = Annotated[
    AuthorizedAccount,
    Depends(AccountPolicyGuard(finance_policy.can_manage)),
]
AuthorizePayoutAccountRead = Annotated[
    AuthorizedPayoutAccount, Depends(PayoutAccountPolicyGuard())
]
AuthorizePayoutAccountWrite = Annotated[
    AuthorizedPayoutAccount,
    Depends(PayoutAccountPolicyGuard()),
]
