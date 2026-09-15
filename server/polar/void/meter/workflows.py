from datetime import timedelta

from temporalio import workflow

ACTIVITY_TIMEOUT = timedelta(minutes=10)


@workflow.defn
class MeterCycleWorkflow:
    @workflow.run
    async def run(self) -> int:
        return await workflow.execute_activity(
            "cycle_meters", start_to_close_timeout=ACTIVITY_TIMEOUT
        )
