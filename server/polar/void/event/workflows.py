from temporalio import workflow

from polar.void.reducer.workflows import ACTIVITY_TIMEOUT


@workflow.defn
class EventDispatchWorkflow:
    @workflow.run
    async def run(self) -> None:
        while (
            await workflow.execute_activity(
                "dispatch_events", start_to_close_timeout=ACTIVITY_TIMEOUT
            )
            == 50
        ):
            if workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new()
