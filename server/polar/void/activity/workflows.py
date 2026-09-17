from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow

DEBOUNCE = timedelta(seconds=1)
ACTIVITY_TIMEOUT = timedelta(minutes=2)


@dataclass
class ClassifySpanInput:
    organization_id: str
    activity_id: str
    span_key: str


@workflow.defn
class ClassifySpanWorkflow:
    def __init__(self) -> None:
        self.dirty = True

    @workflow.signal
    def touch(self) -> None:
        self.dirty = True

    @workflow.run
    async def run(self, input: ClassifySpanInput) -> None:
        while self.dirty:
            self.dirty = False
            await workflow.sleep(DEBOUNCE)
            if self.dirty:
                continue
            await workflow.execute_activity(
                "classify_span",
                input,
                start_to_close_timeout=ACTIVITY_TIMEOUT,
            )
            if self.dirty and workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new(input)
