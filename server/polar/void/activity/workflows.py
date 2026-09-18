from datetime import timedelta

from temporalio import workflow

ACTIVITY_TIMEOUT = timedelta(minutes=2)


@workflow.defn
class ActivitySweepWorkflow:
    """Scheduled every second: drains the spans whose debounce has elapsed."""

    @workflow.run
    async def run(self) -> int:
        return await workflow.execute_activity(
            "classify_due_spans",
            start_to_close_timeout=ACTIVITY_TIMEOUT,
        )
