import hashlib
import uuid
from collections.abc import Sequence
from datetime import datetime
from itertools import chain
from typing import Any

import structlog
from pydantic import ValidationError
from pydantic_ai.messages import ModelMessage, ModelMessagesTypeAdapter

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.auth.scope import Scope
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import CompassThread, CompassThreadMessage
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import CompassThreadMessageRepository, CompassThreadRepository
from .thread_schemas import CompassThreadUpdate

log: Logger = structlog.get_logger()

HISTORY_TURNS = 12
"""Recent turns kept as model context. Older turns stay in the UI only."""

MESSAGES_LIMIT = 50
"""Recent turns returned when rehydrating a thread. Older ones are dropped."""

TITLE_MAX_LENGTH = 80

THREADS_CAP = 500
"""Live threads kept per owner and organization. Creating past the cap
soft-deletes the least recent overflow, so a runaway client can't grow the
table (or the history menu) without bound."""


def scopes_digest(scopes: set[Scope]) -> str:
    """Fingerprint of a token's scopes. Stored on the thread at creation and
    compared on replay: stored history contains tool results fetched under
    the creating token's scopes, so a token with a different scope set gets a
    fresh model context instead of inheriting them."""
    joined = ",".join(sorted(scope.value for scope in scopes))
    return hashlib.sha256(joined.encode()).hexdigest()


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
    ) -> tuple[Sequence[CompassThreadMessage], bool]:
        """The most recent `MESSAGES_LIMIT` turns, oldest first, and whether
        older turns were left out."""
        repository = CompassThreadMessageRepository.from_session(session)
        statement = repository.get_statement_by_thread(thread.id).limit(
            MESSAGES_LIMIT + 1
        )
        recent = await repository.get_all(statement)
        has_more = len(recent) > MESSAGES_LIMIT
        return list(reversed(recent[:MESSAGES_LIMIT])), has_more

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
            scopes_digest=scopes_digest(auth_subject.scopes),
        )
        thread = await repository.create(thread, flush=True)
        overflow_statement = repository.apply_recency_order(
            repository.get_readable_statement(auth_subject).where(
                CompassThread.organization_id == organization_id
            )
        ).offset(THREADS_CAP)
        for overflow in await repository.get_all(overflow_statement):
            await repository.soft_delete(overflow)
        return thread

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
        # Message insert doesn't UPDATE the thread. Bump for list recency.
        await thread_repository.update(thread, update_dict={"modified_at": utc_now()})
        return message

    async def build_message_history(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        thread: CompassThread,
    ) -> tuple[ModelHistory | None, datetime | None]:
        """Concatenated model deltas from the last `HISTORY_TURNS` turns, and
        when the most recent of them ran — so the model can be told how old
        the replayed tool results are.

        A token whose scopes differ from the creating token's gets a fresh
        context: the stored history embeds tool results the current scope set
        may not be entitled to fetch. Invalid stored history (e.g. after a
        pydantic-ai upgrade) also degrades to a fresh context instead of
        breaking the thread.
        """
        if thread.scopes_digest != scopes_digest(auth_subject.scopes):
            log.info(
                "compass.thread_history_scope_mismatch",
                thread_id=str(thread.id),
            )
            return None, None
        repository = CompassThreadMessageRepository.from_session(session)
        recent = await repository.get_all(
            repository.get_replay_statement(thread.id, HISTORY_TURNS)
        )
        combined = list(
            chain.from_iterable(message.model_messages for message in reversed(recent))
        )
        if not combined:
            return None, None
        try:
            history = ModelMessagesTypeAdapter.validate_python(combined)
            return history, recent[0].created_at
        except ValidationError:
            log.warning(
                "compass.thread_history_invalid",
                thread_id=str(thread.id),
            )
            return None, None


compass_thread = CompassThreadService()
