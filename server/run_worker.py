from typing import Any
import polar.logging
from celery import signals


@signals.setup_logging.connect
def setup_logging(*args: Any, **kwargs: Any) -> None:
    polar.logging.configure()


@signals.task_prerun.connect
def setup_task_logging(
    sender: Any, task_id: Any, task: Any, args: Any, kwargs: Any, **_: Any
) -> None:
    polar.logging.configure_celery_task(task_id, task, args, kwargs)


from polar.tasks import *  # noqa
from polar.worker import app  # noqa
