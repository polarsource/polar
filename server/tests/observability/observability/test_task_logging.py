from copy import deepcopy
from typing import Annotated, Any, TypedDict, Unpack

import dramatiq
import pytest
from dramatiq.brokers.stub import StubBroker

from polar.models.benefit_grant import BenefitGrantScopeArgs
from polar.observability import task_logging
from polar.observability.task_logging import (
    LoggableField,
    _loggable_paths,
    register_task_logging,
    task_log_context,
)


class Details(TypedDict, total=False):
    status: Annotated[str, LoggableField]
    email: str


class Payload(TypedDict):
    details: Details
    body: str


@pytest.fixture
def message(monkeypatch: pytest.MonkeyPatch) -> dramatiq.Message[Any]:
    monkeypatch.setattr(task_logging, "_task_fields", {})

    def task(
        resource_id: Annotated[str, LoggableField],
        payload: Payload,
        force: Annotated[bool, LoggableField] = False,
        **scope: Unpack[BenefitGrantScopeArgs],
    ) -> None:
        raise AssertionError("Logging must not execute the task")

    actor = dramatiq.actor(broker=StubBroker(), actor_name="test.task")(task)
    register_task_logging(actor)
    return dramatiq.Message(
        actor_name="test.task",
        queue_name="default",
        message_id="message-123",
        message_timestamp=123456789,
        args=(
            "resource-123",
            {
                "details": {"status": "ready", "email": "private@example.com"},
                "body": "private content",
            },
        ),
        kwargs={},
        options={"retries": 2, "unapproved_option": "private content"},
    )


class TestLoggablePaths:
    def test_selects_marked_fields_including_nested_and_unpacked_scopes(self) -> None:
        assert _loggable_paths(
            {
                "resource_id": Annotated[str, LoggableField],
                "email": str,
                "other_metadata": Annotated[str, "not a logging marker"],
                "payload": Payload,
                "scope": Unpack[BenefitGrantScopeArgs],
            },
            [],
        ) == {
            "resource_id": ["resource_id"],
            "payload.details.status": ["payload", "details", "status"],
            "scope.subscription_id": ["scope", "subscription_id"],
            "scope.order_id": ["scope", "order_id"],
        }


class TestTaskLogContext:
    @pytest.mark.parametrize("use_kwargs", [False, True])
    def test_builds_context_without_changing_inputs(
        self, message: dramatiq.Message[Any], use_kwargs: bool
    ) -> None:
        if use_kwargs:
            message = message.copy(
                args=(),
                kwargs={
                    "resource_id": message.args[0],
                    "payload": message.args[1],
                    "force": True,
                },
            )
        original = deepcopy(message.asdict())

        context = task_log_context(dramatiq.MessageProxy(message))

        assert context == {
            "actor_name": "test.task",
            "message_id": "message-123",
            "queue_name": "default",
            "message_timestamp": 123456789,
            "retries": 2,
            "arguments": {
                "resource_id": "resource-123",
                "payload.details.status": "ready",
                "force": use_kwargs,
            },
        }
        assert message.asdict() == original

    @pytest.mark.parametrize("details", [{"email": "private@example.com"}, "private"])
    def test_omits_missing_or_invalid_nested_fields(
        self, message: dramatiq.Message[Any], details: Any
    ) -> None:
        message = message.copy(args=("resource-123", {"details": details}))

        assert task_log_context(message)["arguments"] == {
            "resource_id": "resource-123",
            "force": False,
        }

    def test_invalid_arguments_do_not_fall_back_to_raw_payload(
        self, message: dramatiq.Message[Any]
    ) -> None:
        message = message.copy(kwargs={"resource_id": "duplicate argument"})

        assert task_log_context(message)["arguments"] == {}

    def test_unpacked_scope_omits_unmarked_keys(
        self, message: dramatiq.Message[Any]
    ) -> None:
        message = message.copy(
            kwargs={
                "subscription_id": "subscription-123",
                "email": "private@example.com",
            }
        )

        assert task_log_context(message)["arguments"] == {
            "resource_id": "resource-123",
            "payload.details.status": "ready",
            "force": False,
            "scope.subscription_id": "subscription-123",
        }

    def test_unknown_actor_logs_only_metadata(
        self, message: dramatiq.Message[Any]
    ) -> None:
        message = message.copy(actor_name="unknown.task")

        assert task_log_context(message) == {
            "actor_name": "unknown.task",
            "message_id": "message-123",
            "queue_name": "default",
            "message_timestamp": 123456789,
            "retries": 2,
            "arguments": {},
        }
