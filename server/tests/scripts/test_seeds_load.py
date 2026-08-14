import random
from collections import Counter
from collections.abc import Sequence
from typing import Any
from uuid import UUID

import pytest
import typer
from pytest_mock import MockerFixture
from sqlalchemy import event as sqlalchemy_event
from sqlalchemy import select

from polar.event.repository import EventRepository
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization
from polar.redis import Redis
from scripts.seeds_load import create_seed_data


@pytest.mark.asyncio
class TestSeedsLoad:
    async def test_create_seed_data(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        sql_count = 0
        event_insert_count = 0
        render_nulls_batch_count = 0
        render_nulls_inserted_ids: list[UUID] = []
        original_insert_batch = EventRepository.insert_batch
        original_randint = random.randint

        def max_seed_customer_count(start: int, end: int) -> int:
            if (start, end) == (3, 8):
                return end
            return original_randint(start, end)

        async def track_insert_batch(
            repository: EventRepository,
            events: Sequence[dict[str, Any]],
            *,
            render_nulls: bool = False,
        ) -> tuple[Sequence[UUID], int]:
            nonlocal render_nulls_batch_count
            result = await original_insert_batch(
                repository, events, render_nulls=render_nulls
            )
            if render_nulls:
                render_nulls_batch_count += 1
                render_nulls_inserted_ids.extend(result[0])
            return result

        def count_queries(*args: Any) -> None:
            nonlocal sql_count, event_insert_count
            sql_count += 1
            if args[2].startswith("INSERT INTO events"):
                event_insert_count += 1

        bind = session.sync_session.bind
        assert bind is not None
        tinybird_ingest_mock = mocker.patch("scripts.seeds_load.tinybird_ingest_events")
        mocker.patch(
            "scripts.seeds_load.random.randint", side_effect=max_seed_customer_count
        )
        mocker.patch.object(EventRepository, "insert_batch", track_insert_batch)
        sqlalchemy_event.listen(bind, "before_cursor_execute", count_queries)
        try:
            await create_seed_data(session, redis)
        finally:
            sqlalchemy_event.remove(bind, "before_cursor_execute", count_queries)

        organizations = (
            (await session.execute(select(Organization.slug))).scalars().all()
        )
        assert set(organizations) == {
            "acme-corp",
            "admin-org",
            "coldmail",
            "example-news-inc",
            "melted-sql",
            "polar",
            "seatbased-only-corp",
            "seatbased-members-corp",
            "widget-industries",
        }
        assert render_nulls_batch_count <= len(organizations), render_nulls_batch_count
        assert event_insert_count <= render_nulls_batch_count * 2, event_insert_count
        assert sql_count <= 1800, sql_count
        tinybird_event_ids = [
            event.id
            for call in tinybird_ingest_mock.await_args_list
            for event in call.args[0]
        ]
        assert Counter(tinybird_event_ids) == Counter(render_nulls_inserted_ids)
        assert all(
            len(call.args[0]) <= 2500 for call in tinybird_ingest_mock.await_args_list
        )
        output = capsys.readouterr().out
        assert output.count("seed.organization status=processed") == len(organizations)
        assert "seed.organization status=success" not in output
        assert "seed.load status=success" in output
        with pytest.raises(typer.Exit) as exception_info:
            await create_seed_data(session, redis)
        assert exception_info.value.exit_code == 2
