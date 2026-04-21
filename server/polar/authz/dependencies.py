from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Annotated, Any
from uuid import UUID

from fastapi import Depends

if TYPE_CHECKING:
    from polar.models import PayoutAccount as PayoutAccountModel
    from polar.models.account import Account as AccountModel

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.models import Organization as OrganizationModel
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, get_db_read_session

from .service import get_accessible_org_ids

# Policy functions return True if allowed, or a denial reason string if denied.
PolicyResult = bool | str

PolicyFn = Callable[
    [AsyncReadSession, AuthSubject[User | Organization], OrganizationModel],
    Awaitable[PolicyResult],
]


@dataclass(frozen=True)
class AuthorizedOrganization:
    """Result of an OrgPolicyGuard dependency.

    Contains both the resolved organization and the authenticated subject,
    so endpoints have a single entry point for auth context.
    """

    organization: OrganizationModel
    auth_subject: AuthSubject[User | Organization]


def OrgPolicyGuard(
    policy_fn: PolicyFn,
    *,
    allowed_subjects: set[type] | None = None,
    required_scopes: set[Scope] | None = None,
) -> Any:
    """Create a FastAPI dependency that authenticates, resolves an organization,
    and checks a policy — all in one step.

    Steps:
    1. Authenticate the subject via Authenticator.
    2. Resolve the organization from the ``{id}`` path parameter.
    3. Verify the subject is a member of the organization.
    4. Evaluate the policy function.
    5. Return an ``AuthorizedOrganization`` (organization + auth_subject).

    Raises:
        Unauthorized (401): The request has no valid credentials, or the
            subject type is not in ``allowed_subjects``.
        InsufficientScopeError (403): The token lacks the required scopes.
        ResourceNotFound (404): The organization does not exist, or the
            subject is not a member of it. Both cases return 404 to avoid
            leaking the existence of organizations the subject cannot access.
        NotPermitted (403): The subject is a member but the policy function
            returned False (e.g. not an admin for finance endpoints).
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
        session: AsyncReadSession = Depends(get_db_read_session),
    ) -> AuthorizedOrganization:
        from polar.organization.repository import OrganizationRepository

        org_ids = await get_accessible_org_ids(session, auth_subject)

        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(id)

        if organization is None or organization.id not in org_ids:
            raise ResourceNotFound()

        result = await policy_fn(session, auth_subject, organization)
        if result is not True:
            raise NotPermitted(result if isinstance(result, str) else "Not permitted")

        return AuthorizedOrganization(
            organization=organization, auth_subject=auth_subject
        )

    return dependency


async def _always_allow(
    session: AsyncReadSession,
    auth_subject: AuthSubject[User | Organization],
    organization: OrganizationModel,
) -> PolicyResult:
    return True


def _finance_can_read() -> PolicyFn:
    async def policy(
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization: OrganizationModel,
    ) -> PolicyResult:
        from .policies import finance

        return await finance.can_read(session, auth_subject, organization)

    return policy


def _finance_can_write() -> PolicyFn:
    async def policy(
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization: OrganizationModel,
    ) -> PolicyResult:
        from .policies import finance

        return await finance.can_write(session, auth_subject, organization)

    return policy


def _members_can_manage() -> PolicyFn:
    async def policy(
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization: OrganizationModel,
    ) -> PolicyResult:
        from .policies import members

        return await members.can_manage(session, auth_subject, organization)

    return policy


def _org_can_delete() -> PolicyFn:
    async def policy(
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization: OrganizationModel,
    ) -> PolicyResult:
        from .policies import organization as org_policy

        return await org_policy.can_delete(session, auth_subject, organization)

    return policy


AuthorizeFinanceRead = Annotated[
    AuthorizedOrganization,
    Depends(
        OrgPolicyGuard(
            _finance_can_read(),
            required_scopes={
                Scope.transactions_read,
                Scope.transactions_write,
                Scope.payouts_read,
                Scope.payouts_write,
            },
        )
    ),
]
AuthorizeFinanceWrite = Annotated[
    AuthorizedOrganization,
    Depends(
        OrgPolicyGuard(
            _finance_can_write(),
            required_scopes={
                Scope.transactions_write,
                Scope.payouts_write,
            },
        )
    ),
]
AuthorizeMembersManage = Annotated[
    AuthorizedOrganization,
    Depends(
        OrgPolicyGuard(
            _members_can_manage(),
            allowed_subjects={User},
            required_scopes={Scope.organizations_write},
        )
    ),
]
AuthorizeOrgDelete = Annotated[
    AuthorizedOrganization,
    Depends(
        OrgPolicyGuard(
            _org_can_delete(),
            allowed_subjects={User},
            required_scopes={Scope.organizations_write},
        )
    ),
]
AuthorizeOrgAccess = Annotated[
    AuthorizedOrganization, Depends(OrgPolicyGuard(_always_allow))
]
AuthorizeOrgAccessUser = Annotated[
    AuthorizedOrganization,
    Depends(
        OrgPolicyGuard(
            _always_allow,
            allowed_subjects={User},
            required_scopes={Scope.organizations_write},
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
    organization: OrganizationModel
    auth_subject: AuthSubject[User | Organization]


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
        session: AsyncReadSession = Depends(get_db_read_session),
    ) -> AuthorizedAccount:
        from polar.account.repository import AccountRepository
        from polar.organization.repository import OrganizationRepository

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
            raise NotPermitted(result if isinstance(result, str) else "Not permitted")

        return AuthorizedAccount(
            account=account, organization=organization, auth_subject=auth_subject
        )

    return dependency


def PayoutAccountPolicyGuard(policy_fn: PolicyFn) -> Any:
    """FastAPI dependency: resolve payout account by {id}, find owning org, check policy.

    Raises:
        Unauthorized (401): No valid credentials.
        ResourceNotFound (404): Payout account not found or subject has no
            access to the owning organization.
        NotPermitted (403): Subject is a member but the policy denied access.
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
        session: AsyncReadSession = Depends(get_db_read_session),
    ) -> AuthorizedPayoutAccount:
        from polar.organization.repository import OrganizationRepository
        from polar.payout_account.repository import PayoutAccountRepository

        pa_repo = PayoutAccountRepository.from_session(session)
        payout_account = await pa_repo.get_by_id(id)
        if payout_account is None:
            raise ResourceNotFound()

        # Find the organization that uses this payout account
        org_repo = OrganizationRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        organization = await org_repo.get_by_payout_account(payout_account.id)

        if organization is None or organization.id not in org_ids:
            raise ResourceNotFound()

        result = await policy_fn(session, auth_subject, organization)
        if result is not True:
            raise NotPermitted(result if isinstance(result, str) else "Not permitted")

        return AuthorizedPayoutAccount(
            payout_account=payout_account,
            organization=organization,
            auth_subject=auth_subject,
        )

    return dependency


AuthorizeAccountRead = Annotated[
    AuthorizedAccount, Depends(AccountPolicyGuard(_finance_can_read()))
]
AuthorizeAccountWrite = Annotated[
    AuthorizedAccount, Depends(AccountPolicyGuard(_finance_can_write()))
]
AuthorizePayoutAccountRead = Annotated[
    AuthorizedPayoutAccount, Depends(PayoutAccountPolicyGuard(_finance_can_read()))
]
AuthorizePayoutAccountWrite = Annotated[
    AuthorizedPayoutAccount, Depends(PayoutAccountPolicyGuard(_finance_can_write()))
]
