from typing import Unpack

import httpx
from arq import Retry

from polar.worker import JobContext, PolarWorkerContext, task

from .client import Properties
from .client import client as loops_client


@task("loops.update_contact")
async def loops_update_contact(
    ctx: JobContext,
    email: str,
    id: str,
    polar_context: PolarWorkerContext,
    **properties: Unpack[Properties],
) -> None:
    try:
        await loops_client.update_contact(email, id, **properties)
    except httpx.HTTPError as e:
        MAX_RETRIES = 5
        if ctx["job_try"] <= MAX_RETRIES:
            raise Retry(2 ** ctx["job_try"]) from e
        else:
            raise


@task("loops.send_event")
async def loops_send_event(
    ctx: JobContext,
    email: str,
    event_name: str,
    polar_context: PolarWorkerContext,
    **properties: Unpack[Properties],
) -> None:
    try:
        await loops_client.send_event(email, event_name, **properties)
    except httpx.HTTPError as e:
        MAX_RETRIES = 5
        if ctx["job_try"] <= MAX_RETRIES:
            raise Retry(2 ** ctx["job_try"]) from e
        else:
            raise
