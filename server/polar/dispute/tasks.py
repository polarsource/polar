import uuid

from polar.kit.utils import utc_now
from polar.models.support_case import (
    SupportCaseAudience,
    SupportCaseMessageAuthorKind,
)
from polar.support_case.repository import (
    SupportCaseMessageRepository,
    SupportCaseRepository,
)
from polar.support_case.service import support_case as support_case_service
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .dispute_case import DISPUTE_GREETING
from .repository import DisputeRepository
from .service import DISPUTE_AUTO_ACCEPT_DELAY
from .service import dispute as dispute_service


@actor(actor_name="dispute.post_dispute_greeting", priority=TaskPriority.LOW)
async def post_dispute_greeting(case_id: uuid.UUID) -> None:
    """Post the automated greeting after the merchant's first dispute reply."""
    async with AsyncSessionMaker() as session:
        case = await SupportCaseRepository.from_session(session).get_by_id(case_id)
        if case is None:
            return

        message_repository = SupportCaseMessageRepository.from_session(session)
        if not await message_repository.is_open(case_id):
            return

        existing = await message_repository.list_by_case(case_id, visible_to=None)
        if any(message.body == DISPUTE_GREETING for message in existing):
            return

        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.system,
            body=DISPUTE_GREETING,
            audience=[SupportCaseAudience.merchant],
        )


@actor(
    actor_name="dispute.enqueue_auto_accepts",
    cron_trigger=CronTrigger.from_crontab("30 * * * *"),
    priority=TaskPriority.LOW,
)
async def enqueue_auto_accepts() -> None:
    """Hand each dispute past the delay to its own job."""
    async with AsyncSessionMaker() as session:
        repository = DisputeRepository.from_session(session)
        before = utc_now() - DISPUTE_AUTO_ACCEPT_DELAY
        async for dispute in repository.stream_auto_accept_candidates(before=before):
            enqueue_job("dispute.auto_accept", dispute.id)


@actor(actor_name="dispute.auto_accept", priority=TaskPriority.LOW)
async def auto_accept(dispute_id: uuid.UUID) -> None:
    """Concede a single dispute. The sweep only narrows, so re-check first."""
    async with AsyncSessionMaker() as session:
        repository = DisputeRepository.from_session(session)
        dispute = await repository.get_by_id(
            dispute_id, options=repository.get_eager_options()
        )
        if dispute is None:
            return

        if not await dispute_service.auto_accept_applies(session, dispute):
            return

        await dispute_service.accept(session, dispute, automatic=True)
