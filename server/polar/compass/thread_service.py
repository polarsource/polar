import uuid
from collections.abc import Sequence
from itertools import chain
from typing import Any

import structlog
from pydantic import ValidationError
from pydantic_ai.messages import ModelMessage, ModelMessagesTypeAdapter

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import CompassThread, CompassThreadMessage
from polar.postgres import AsyncReadSession, AsyncSession

from .assistant.schemas import CompassThreadUpdate
from .repository import CompassThreadMessageRepository, CompassThreadRepository

log: Logger = structlog.get_logger()

HISTORY_TURNS = 12
"""How many recent turns are replayed as model context. Older turns stay
readable in the UI but drop out of the model's context, keeping long threads
from growing every request without bound."""

TITLE_MAX_LENGTH = 80

type TurnParts = list[dict[str, Any]]
type TurnModelMessages = list[dict[str, Any]]
type ModelHistory = list[ModelMessage]


def _title_from_prompt(prompt: str) -> str:
    title = " ".join(prompt.split())
    if len(title) > TITLE_MAX_LENGTH:
        title = title[: TITLE_MAX_LENGTH - 1].rstrip() + "…"
    return title


class CompassThreadService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: uuid.UUID,
        pagination: PaginationParams,
    ) -> tuple[Sequence[CompassThread], int]:
        repository = CompassThreadRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            CompassThread.organization_id == organization_id
        )
        statement = repository.apply_recency_order(statement)
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> CompassThread | None:
        repository = CompassThreadRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            CompassThread.id == id
        )
        return await repository.get_one_or_none(statement)

    async def list_messages(
        self, session: AsyncReadSession, thread: CompassThread
    ) -> Sequence[CompassThreadMessage]:
        repository = CompassThreadMessageRepository.from_session(session)
        return await repository.get_all(repository.get_statement_by_thread(thread.id))

    async def update(
        self,
        session: AsyncSession,
        thread: CompassThread,
        update_schema: CompassThreadUpdate,
    ) -> CompassThread:
        repository = CompassThreadRepository.from_session(session)
        return await repository.update(
            thread, update_dict=update_schema.model_dump(exclude_unset=True)
        )

    async def delete(self, session: AsyncSession, thread: CompassThread) -> None:
        repository = CompassThreadRepository.from_session(session)
        await repository.soft_delete(thread)

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: uuid.UUID,
        prompt: str,
    ) -> CompassThread:
        repository = CompassThreadRepository.from_session(session)
        thread = CompassThread(
            organization_id=organization_id,
            user_id=auth_subject.subject.id if is_user(auth_subject) else None,
            title=_title_from_prompt(prompt),
        )
        return await repository.create(thread, flush=True)

    async def record_turn(
        self,
        session: AsyncSession,
        thread_id: uuid.UUID,
        *,
        prompt: str,
        parts: TurnParts,
        model_messages: TurnModelMessages,
    ) -> CompassThreadMessage | None:
        """Append a completed turn; None if the thread vanished mid-stream."""
        thread_repository = CompassThreadRepository.from_session(session)
        thread = await thread_repository.get_by_id(thread_id)
        if thread is None:
            return None
        message_repository = CompassThreadMessageRepository.from_session(session)
        message = await message_repository.create(
            CompassThreadMessage(
                thread=thread,
                prompt=prompt,
                parts=parts,
                model_messages=model_messages,
            ),
            flush=True,
        )
        # Recency for the thread list: a thread was "active" when its last
        # turn completed, not when it was renamed or created.
        await thread_repository.update(thread, update_dict={"modified_at": utc_now()})
        return message

    async def build_message_history(
        self, session: AsyncReadSession, thread: CompassThread
    ) -> ModelHistory | None:
        """The model context for the next turn: the concatenated per-turn
        deltas of the last `HISTORY_TURNS` turns.

        Stored history that no longer validates (e.g. after a pydantic-ai
        upgrade) degrades to a fresh context instead of breaking the thread.
        """
        repository = CompassThreadMessageRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(CompassThreadMessage.thread_id == thread.id)
            .order_by(CompassThreadMessage.created_at.desc())
            .limit(HISTORY_TURNS)
        )
        recent = await repository.get_all(statement)
        combined = list(
            chain.from_iterable(message.model_messages for message in reversed(recent))
        )
        if not combined:
            return None
        try:
            return ModelMessagesTypeAdapter.validate_python(combined)
        except ValidationError:
            log.warning(
                "compass.thread_history_invalid",
                thread_id=str(thread.id),
            )
            return None


compass_thread = CompassThreadService()
