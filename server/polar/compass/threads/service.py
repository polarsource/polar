import hashlib
import uuid
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from itertools import chain
from typing import Any

import structlog
from pydantic import ValidationError
from pydantic_ai.messages import ModelMessage, ModelMessagesTypeAdapter

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.auth.scope import Scope
from polar.kit.db.postgres import AsyncSessionMaker
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import CompassThread, CompassThreadMessage
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import CompassThreadMessageRepository, CompassThreadRepository
from .schemas import TITLE_MAX_LENGTH, CompassThreadUpdate

log: Logger = structlog.get_logger()

HISTORY_TURNS = 12
"""How many recent turns are replayed as model context. Older turns stay
readable in the UI but drop out of the model's context, keeping long threads
from growing every request without bound. This could probably be built
in a smarter way in the future"""

MESSAGES_LIMIT = 50
THREADS_CAP = 500


def scopes_fingerprint(scopes: set[Scope]) -> str:
    """Fingerprint of a token's scopes for history replay gating."""
    joined = ",".join(sorted(scope.value for scope in scopes))
    return hashlib.sha256(joined.encode()).hexdigest()


type TurnParts = list[dict[str, Any]]
type TurnModelMessages = list[dict[str, Any]]
type ModelHistory = list[ModelMessage]

RecordTurn = Callable[[TurnParts, TurnModelMessages], Awaitable[None]]
"""Callback handing a completed turn's renderable parts and model deltas
over for persistence. The single spelling of the stream → threads contract."""


@dataclass
class TurnStart:
    """The resolved thread for one assistant turn."""

    thread: CompassThread
    history: ModelHistory | None
    history_last_at: datetime | None
    is_new: bool


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
            thread,
            update_dict=update_schema.model_dump(exclude_unset=True, exclude_none=True),
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
            scopes_fingerprint=scopes_fingerprint(auth_subject.scopes),
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

    async def begin_turn(
        self,
        session: AsyncReadSession,
        write_sessionmaker: AsyncSessionMaker,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: uuid.UUID,
        prompt: str,
        thread_id: uuid.UUID | None,
    ) -> TurnStart | None:
        """Resolve the thread one assistant turn runs on.

        Continuing a thread loads it and replays recent history. Starting one
        creates and commits it in its own transaction, before any streaming,
        so an aborted stream still leaves the thread behind. Returns None when
        the thread doesn't exist or belongs to another organization.
        """
        if thread_id is not None:
            thread = await self.get(session, auth_subject, thread_id)
            if thread is None or thread.organization_id != organization_id:
                return None
            history, history_last_at = await self.build_message_history(
                session, auth_subject, thread
            )
            return TurnStart(thread, history, history_last_at, is_new=False)

        async with write_sessionmaker.begin() as write_session:
            thread = await self.create(
                write_session,
                auth_subject,
                organization_id=organization_id,
                prompt=prompt,
            )

        return TurnStart(thread, None, None, is_new=True)

    def turn_recorder(
        self,
        write_sessionmaker: AsyncSessionMaker,
        thread_id: uuid.UUID,
        prompt: str,
    ) -> RecordTurn:
        """A `RecordTurn` that persists in its own transaction, for callers
        (the SSE stream) that outlive the request-scoped session."""

        async def record(parts: TurnParts, model_messages: TurnModelMessages) -> None:
            async with write_sessionmaker.begin() as session:
                await self.record_turn(
                    session,
                    thread_id,
                    prompt=prompt,
                    parts=parts,
                    model_messages=model_messages,
                )

        return record

    async def record_turn(
        self,
        session: AsyncSession,
        thread_id: uuid.UUID,
        *,
        prompt: str,
        parts: TurnParts,
        model_messages: TurnModelMessages,
    ) -> CompassThreadMessage | None:
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
        # Keep list order by last activity. Inserting a message does not
        # update the thread row on its own.
        await thread_repository.update(thread, update_dict={"modified_at": utc_now()})
        return message

    async def build_message_history(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        thread: CompassThread,
    ) -> tuple[ModelHistory | None, datetime | None]:
        """The model context for the next turn: the concatenated per-turn
        deltas of the last `HISTORY_TURNS` turns.

        Scope mismatch (token scopes changed since the thread was created)
        or stored history that no longer validates (e.g. after a pydantic-ai
        upgrade) degrades to a fresh context instead of breaking the thread.
        Could be rethought to be more backwards compatible.
        """
        if thread.scopes_fingerprint != scopes_fingerprint(auth_subject.scopes):
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
