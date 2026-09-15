import asyncio
from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow

DEBOUNCE = timedelta(seconds=1)
ACTIVITY_TIMEOUT = timedelta(minutes=1)


@dataclass
class ReducerBucketInput:
    organization_id: str
    bucket_start: str


@dataclass
class RecomputeBucketInput:
    reducer_id: str
    organization_id: str
    bucket_start: str


@workflow.defn
class ReducerBucketWorkflow:
    def __init__(self) -> None:
        self.dirty = True

    @workflow.signal
    def touch(self, events: int) -> None:
        self.dirty = True

    @workflow.run
    async def run(self, input: ReducerBucketInput) -> None:
        while self.dirty:
            self.dirty = False
            reducer_ids: list[str] = await workflow.execute_activity(
                "list_reducers",
                input.organization_id,
                start_to_close_timeout=ACTIVITY_TIMEOUT,
            )
            await asyncio.gather(
                *(
                    workflow.execute_activity(
                        "recompute_bucket",
                        RecomputeBucketInput(
                            reducer_id, input.organization_id, input.bucket_start
                        ),
                        activity_id=f"recompute-{reducer_id}",
                        start_to_close_timeout=ACTIVITY_TIMEOUT,
                    )
                    for reducer_id in reducer_ids
                )
            )
            await asyncio.sleep(DEBOUNCE.total_seconds())
            if self.dirty and workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new(input)


@workflow.defn
class DerivedReducerWorkflow:
    def __init__(self) -> None:
        self.dirty = True

    @workflow.signal
    def touch(self) -> None:
        self.dirty = True

    @workflow.run
    async def run(self, input: RecomputeBucketInput) -> None:
        while self.dirty:
            self.dirty = False
            # Unlimited activity retries retain delivered work during outages.
            await workflow.execute_activity(
                "recompute_bucket",
                input,
                start_to_close_timeout=ACTIVITY_TIMEOUT,
            )
            await asyncio.sleep(DEBOUNCE.total_seconds())
            if self.dirty and workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new(input)


@workflow.defn
class DerivedDispatchWorkflow:
    @workflow.run
    async def run(self) -> None:
        while (
            await workflow.execute_activity(
                "dispatch_derived",
                start_to_close_timeout=ACTIVITY_TIMEOUT,
            )
            == 50
        ):
            if workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new()
