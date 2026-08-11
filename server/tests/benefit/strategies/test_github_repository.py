from unittest.mock import AsyncMock, MagicMock

import pytest

from polar.benefit.strategies import BenefitActionRequiredError
from polar.benefit.strategies.github_repository.properties import (
    BenefitGrantGitHubRepositoryProperties,
)
from polar.benefit.strategies.github_repository.service import (
    BenefitGitHubRepositoryService,
)
from polar.models import Benefit, Customer, Member, Organization
from polar.models.benefit import BenefitType
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture


def _make_benefit(organization: Organization) -> Benefit:
    return Benefit(
        organization=organization,
        type=BenefitType.github_repository,
        description="GitHub repo benefit",
        is_tax_applicable=False,
        properties={
            "repository_owner": "test-owner",
            "repository_name": "test-repo",
            "permission": "pull",
        },
    )


def _make_member(organization: Organization, customer: Customer) -> Member:
    member = Member(
        customer_id=customer.id,
        organization_id=organization.id,
        email="member@example.com",
        name="Test Member",
        role=MemberRole.member,
    )
    member._oauth_accounts = {}
    # The member connected their own GitHub account (distinct from the
    # customer's). granted_account_id at grant time stored this ID.
    member.set_oauth_account(
        CustomerOAuthAccount(
            access_token="member-token",
            account_id="11111",
            account_username="member-github-user",
        ),
        CustomerOAuthPlatform.github,
    )
    return member


def _make_customer(organization: Organization) -> Customer:
    customer = Customer(
        organization=organization,
        email="customer@example.com",
    )
    customer._oauth_accounts = {}
    # The customer connected a DIFFERENT GitHub account than the member.
    customer.set_oauth_account(
        CustomerOAuthAccount(
            access_token="customer-token",
            account_id="99999",
            account_username="customer-github-user",
        ),
        CustomerOAuthPlatform.github,
    )
    return customer


class _EmptyAsyncPaginator:
    """Stand-in for ``client.paginate(...)`` yielding no items.

    ``githubkit``'s ``paginate`` returns an async iterable; the strategy uses
    ``async for ... in client.paginate(...)``. A plain ``MagicMock``'s
    ``__aiter__`` returns a sync iterator which ``async for`` rejects, so we
    implement a proper async iterator here.
    """

    def __aiter__(self) -> "_EmptyAsyncPaginator":
        return self

    async def __anext__(self) -> None:
        raise StopAsyncIteration


def _mock_github_client() -> tuple[MagicMock, AsyncMock]:
    mock_client = MagicMock()
    mock_client.paginate.return_value = _EmptyAsyncPaginator()
    remove_collaborator_mock = AsyncMock()
    mock_client.rest.repos.async_remove_collaborator = remove_collaborator_mock
    return mock_client, remove_collaborator_mock


class _DummyCtx:
    async def __aenter__(self) -> MagicMock:
        return _DummyCtx._client

    async def __aexit__(self, *args: object) -> None:
        return None

    _client: MagicMock = MagicMock()


def _patch_client(
    service: BenefitGitHubRepositoryService, mock_client: MagicMock
) -> None:
    _DummyCtx._client = mock_client
    service._get_github_app_client = lambda benefit: _DummyCtx()  # type: ignore[assignment,method-assign,return-value]


@pytest.mark.asyncio
class TestGitHubRepositoryRevoke:
    async def test_revoke_uses_soft_deleted_member_oauth_account(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """The GitHub repository strategy resolves the OAuth account from the
        (soft-deleted) member when one is passed, rather than falling back to
        the customer's different account.

        This is the core of the bug: ``delete_benefit_grant`` previously
        resolved a soft-deleted member to ``None``, so the strategy fell back
        to ``customer.get_oauth_account(member_github_id)`` — which returns
        ``None`` because the customer's GitHub account ID differs — and raised
        ``BenefitActionRequiredError`` (swallowed), leaving repo access in
        place. With the fix, the soft-deleted member is passed through and its
        OAuth account is used to call ``remove_collaborator``.
        """
        from polar.kit.utils import utc_now

        service = BenefitGitHubRepositoryService(session, redis)

        customer = _make_customer(organization)
        await save_fixture(customer)
        member = _make_member(organization, customer)
        await save_fixture(member)

        # Soft-delete the member (mirrors MemberService.delete)
        member.deleted_at = utc_now()
        await save_fixture(member)

        benefit = _make_benefit(organization)
        await save_fixture(benefit)

        # grant_properties as they would be after a successful grant:
        # granted_account_id is the member's GitHub account ID.
        grant_properties: BenefitGrantGitHubRepositoryProperties = {
            "account_id": "11111",
            "repository_owner": "test-owner",
            "repository_name": "test-repo",
            "permission": "pull",
            "granted_account_id": "11111",
        }

        mock_client, remove_collaborator_mock = _mock_github_client()
        _patch_client(service, mock_client)

        result = await service.revoke(
            benefit,
            customer,
            grant_properties,
            member=member,
        )

        # remove_collaborator called with the MEMBER's username, not customer's
        remove_collaborator_mock.assert_awaited_once()
        call_args = remove_collaborator_mock.call_args
        assert call_args.args[2] == "member-github-user"
        assert result == {"account_id": "11111"}

    async def test_revoke_raises_action_required_when_member_none(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """When the member is NOT passed (the pre-fix behavior for
        soft-deleted members), the strategy cannot find an OAuth account for
        the member's GitHub ID on the customer, and raises
        ``BenefitActionRequiredError`` — the silently-swallowed error that
        left GitHub access in place.

        This test documents the failure mode the fix prevents: with the fix,
        ``delete_benefit_grant`` passes the soft-deleted member so this branch
        is not taken.
        """
        service = BenefitGitHubRepositoryService(session, redis)

        customer = _make_customer(organization)
        await save_fixture(customer)
        member = _make_member(organization, customer)
        await save_fixture(member)

        benefit = _make_benefit(organization)
        await save_fixture(benefit)

        # granted_account_id is the member's GitHub ID; customer's is different
        grant_properties: BenefitGrantGitHubRepositoryProperties = {
            "account_id": "11111",
            "repository_owner": "test-owner",
            "repository_name": "test-repo",
            "permission": "pull",
            "granted_account_id": "11111",
        }

        mock_client, _ = _mock_github_client()
        _patch_client(service, mock_client)

        # member=None simulates the pre-fix behavior where delete_benefit_grant
        # resolved a soft-deleted member to None.
        with pytest.raises(BenefitActionRequiredError):
            await service.revoke(
                benefit,
                customer,
                grant_properties,
                member=None,
            )
