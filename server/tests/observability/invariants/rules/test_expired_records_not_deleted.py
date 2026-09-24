from datetime import datetime, timedelta

import pytest

from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import (
    AuthenticationSession,
    Customer,
    CustomerEmailVerification,
    CustomerSession,
    CustomerSessionCode,
    EmailOTP,
    EmailVerification,
    ExternalEvent,
    Member,
    MemberSession,
    OAuth2State,
    OAuth2Token,
    Organization,
    User,
    UserSession,
    WebhookDelivery,
    WebhookEvent,
)
from polar.models.email_log import EmailLogStatus
from polar.models.external_event import ExternalEventSource
from polar.models.webhook_endpoint import WebhookEventType
from polar.oauth2.sub_type import SubType
from polar.observability.invariants.rules.expired_records_not_deleted import (
    CLEANUP_TASKS,
    ExpiredRecordsNotDeletedInvariant,
    ExpiredRecordsNotDeletedInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_email_log, create_webhook_endpoint

OVERDUE = (
    ExpiredRecordsNotDeletedInvariant.CLEANUP_INTERVAL
    + ExpiredRecordsNotDeletedInvariant.LEEWAY
    + timedelta(hours=1)
)


async def create_webhook_event(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    payload: str | None,
    created_at: datetime,
) -> None:
    webhook_endpoint = await create_webhook_endpoint(
        save_fixture, organization=organization
    )
    await save_fixture(
        WebhookEvent(
            webhook_endpoint=webhook_endpoint,
            type=WebhookEventType.customer_created,
            payload=payload,
            created_at=created_at,
        )
    )


async def create_webhook_delivery(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    response: str | None,
    created_at: datetime,
) -> None:
    webhook_endpoint = await create_webhook_endpoint(
        save_fixture, organization=organization
    )
    webhook_event = WebhookEvent(
        webhook_endpoint=webhook_endpoint,
        type=WebhookEventType.customer_created,
        payload="{}",
    )
    await save_fixture(webhook_event)
    await save_fixture(
        WebhookDelivery(
            webhook_endpoint=webhook_endpoint,
            webhook_event=webhook_event,
            succeeded=True,
            http_code=200,
            response=response,
            created_at=created_at,
        )
    )


async def create_deletable_records(
    save_fixture: SaveFixture,
    user: User,
    customer: Customer,
    member: Member,
    organization: Organization,
    *,
    deletable_for: timedelta,
) -> None:
    deletable_at = utc_now() - deletable_for
    epoch_deletable_at = int(deletable_at.timestamp())

    authentication_session = AuthenticationSession(
        token_hash="a" * 64,
        expires_at=epoch_deletable_at,
        step=0,
        authentication_method_references=[],
        used_factors=[],
        context=None,
        identity_id=None,
    )
    await save_fixture(authentication_session)

    await save_fixture(
        EmailOTP(
            code_hash="b" * 64,
            expires_at=epoch_deletable_at,
            email=user.email,
            identity_id=user.id,
            authentication_session_id=authentication_session.id,
        )
    )
    await save_fixture(
        OAuth2State(
            state_hash="c" * 64,
            provider="google",
            code_verifier="code-verifier",
            nonce="nonce",
            redirect_uri="https://example.com/callback",
            scope=["openid", "email"],
            expires_at=epoch_deletable_at,
            identity_id=None,
            context=None,
        )
    )
    await save_fixture(
        CustomerSessionCode(
            code="d" * 64,
            email=customer.email,
            customer_id=customer.id,
            expires_at=deletable_at,
        )
    )
    await save_fixture(
        EmailVerification(
            email=user.email,
            token_hash="e" * 64,
            user_id=user.id,
            expires_at=deletable_at,
        )
    )
    await save_fixture(
        CustomerEmailVerification(
            email=customer.email,
            token_hash="f" * 64,
            customer_id=customer.id,
            organization_id=customer.organization_id,
            expires_at=deletable_at,
        )
    )
    await save_fixture(
        CustomerSession(
            token="customer_session_token",
            customer_id=customer.id,
            expires_at=deletable_at,
        )
    )
    await save_fixture(
        MemberSession(
            token="member_session_token",
            member_id=member.id,
            expires_at=deletable_at,
        )
    )
    await save_fixture(
        OAuth2Token(
            client_id="polar_ci_client",
            token_type="bearer",
            access_token="access_token",
            refresh_token=None,
            scope="openid",
            sub_type=SubType.user,
            user_id=user.id,
            issued_at=epoch_deletable_at - 3600,
            expires_in=3600,
        )
    )
    await save_fixture(
        UserSession(
            token="user_session_token",
            user_agent="pytest",
            scopes=[],
            user_id=user.id,
            expires_at=deletable_at,
        )
    )
    await save_fixture(
        ExternalEvent(
            source=ExternalEventSource.stripe,
            task_name="task_name",
            external_id="handled_event",
            data={},
            handled_at=deletable_at,
            created_at=deletable_at - settings.EXTERNAL_EVENT_RETENTION_PERIOD,
        )
    )
    await create_email_log(
        save_fixture,
        created_at=deletable_at - settings.EMAIL_LOG_RETENTION_PERIOD,
    )
    await create_webhook_event(
        save_fixture,
        organization,
        payload="{}",
        created_at=deletable_at - settings.WEBHOOK_EVENT_RETENTION_PERIOD,
    )
    await create_webhook_delivery(
        save_fixture,
        organization,
        response="response body",
        created_at=deletable_at - settings.WEBHOOK_DELIVERY_PAYLOAD_RETENTION_PERIOD,
    )


@pytest.mark.asyncio
class TestCheck:
    @pytest.mark.parametrize(
        "deletable_for", [-timedelta(hours=1), timedelta(minutes=5)]
    )
    async def test_records_within_cleanup_interval(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        customer: Customer,
        member: Member,
        organization: Organization,
        deletable_for: timedelta,
    ) -> None:
        await create_deletable_records(
            save_fixture,
            user,
            customer,
            member,
            organization,
            deletable_for=deletable_for,
        )

        invariant = ExpiredRecordsNotDeletedInvariant(session)
        await invariant.check()

    async def test_overdue_records(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        customer: Customer,
        member: Member,
        organization: Organization,
    ) -> None:
        await create_deletable_records(
            save_fixture, user, customer, member, organization, deletable_for=OVERDUE
        )

        invariant = ExpiredRecordsNotDeletedInvariant(session)
        with pytest.raises(ExpiredRecordsNotDeletedInvariantError) as exc_info:
            await invariant.check()

        assert exc_info.value.context["cleanup_tasks"] == [
            cleanup_task.actor_name for cleanup_task in CLEANUP_TASKS
        ]

    async def test_ignores_records_their_task_keeps(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        deletable_at = utc_now() - OVERDUE
        await save_fixture(
            OAuth2Token(
                client_id="polar_ci_client",
                token_type="bearer",
                access_token="access_token",
                refresh_token="refresh_token",
                scope="openid",
                sub_type=SubType.user,
                user_id=user.id,
                issued_at=int(deletable_at.timestamp()) - 3600,
                expires_in=3600,
            )
        )
        await save_fixture(
            ExternalEvent(
                source=ExternalEventSource.stripe,
                task_name="task_name",
                external_id="unhandled_event",
                data={},
                handled_at=None,
                created_at=deletable_at - settings.EXTERNAL_EVENT_RETENTION_PERIOD,
            )
        )
        await create_email_log(
            save_fixture,
            created_at=utc_now()
            - settings.EMAIL_LOG_RETENTION_PERIOD
            + timedelta(days=1),
            status=EmailLogStatus.failed,
        )
        await create_webhook_delivery(
            save_fixture,
            organization,
            response=None,
            created_at=deletable_at
            - settings.WEBHOOK_DELIVERY_PAYLOAD_RETENTION_PERIOD,
        )

        invariant = ExpiredRecordsNotDeletedInvariant(session)
        await invariant.check()
