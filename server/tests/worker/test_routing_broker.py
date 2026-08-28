import dramatiq
import pytest
from dramatiq.brokers.redis import RedisBroker
from dramatiq.composition import group
from dramatiq.errors import ActorNotFound
from dramatiq.middleware.group_callbacks import GroupCallbacks
from dramatiq.rate_limits.backends import RedisBackend as RateLimiterBackend
from fakeredis import FakeRedis
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.config import settings
from polar.worker import _sqs
from polar.worker._enqueue import (
    SQS_ACTORS_WILDCARD,
    resolve_sqs_actors,
    should_route_to_sqs,
)
from polar.worker._runner import run_task, validate_allowlist

CRON_ACTOR = "organization.unsnooze_expired"
SUBSCRIPTION_ACTOR = "subscription.cycle"


class TestRoutingBroker:
    def test_disabled_routes_to_redis(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", False)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {CRON_ACTOR})
        super_enqueue = mocker.patch.object(RedisBroker, "enqueue")
        send_jobs_sync = mocker.patch("polar.worker._broker._sqs.send_jobs_sync")

        broker = dramatiq.get_broker()
        broker.enqueue(broker.get_actor(CRON_ACTOR).message())

        send_jobs_sync.assert_not_called()
        super_enqueue.assert_called_once()

    def test_non_allowlisted_routes_to_redis(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"dummy"})
        super_enqueue = mocker.patch.object(RedisBroker, "enqueue")
        send_jobs_sync = mocker.patch("polar.worker._broker._sqs.send_jobs_sync")

        broker = dramatiq.get_broker()
        broker.enqueue(broker.get_actor(CRON_ACTOR).message())

        send_jobs_sync.assert_not_called()
        super_enqueue.assert_called_once()

    def test_allowlisted_cron_actor_routes_to_sqs(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {CRON_ACTOR})
        super_enqueue = mocker.patch.object(RedisBroker, "enqueue")
        send_jobs_sync = mocker.patch("polar.worker._broker._sqs.send_jobs_sync")

        broker = dramatiq.get_broker()
        broker.enqueue(broker.get_actor(CRON_ACTOR).message())

        super_enqueue.assert_not_called()
        send_jobs_sync.assert_called_once()
        sent = send_jobs_sync.call_args.args[0]
        assert [job[0] for job in sent] == [CRON_ACTOR]

    def test_allowlisted_actor_forwards_kwargs_to_sqs(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {SUBSCRIPTION_ACTOR})
        super_enqueue = mocker.patch.object(RedisBroker, "enqueue")
        send_jobs_sync = mocker.patch("polar.worker._broker._sqs.send_jobs_sync")

        broker = dramatiq.get_broker()
        subscription_id = "00000000-0000-0000-0000-000000000000"
        broker.enqueue(
            broker.get_actor(SUBSCRIPTION_ACTOR).message(
                subscription_id=subscription_id
            )
        )

        super_enqueue.assert_not_called()
        sent = send_jobs_sync.call_args.args[0]
        assert sent[0][0] == SUBSCRIPTION_ACTOR
        assert sent[0][2] == {"subscription_id": subscription_id}

    def test_allowlisted_actor_forwards_debounce_key_to_sqs(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"customer.webhook"})
        mocker.patch.object(RedisBroker, "enqueue")
        send_jobs_sync = mocker.patch("polar.worker._broker._sqs.send_jobs_sync")

        broker = dramatiq.get_broker()
        message = broker.get_actor("customer.webhook").message()
        message = message.copy(options={"debounce_key": "debounce:test:key"})
        broker.enqueue(message)

        job = send_jobs_sync.call_args.args[0][0]
        assert job.message_id == message.message_id
        assert job.debounce_key == "debounce:test:key"

    @pytest.mark.asyncio
    async def test_group_completion_callback_runs_through_sqs(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"dummy"})

        broker = dramatiq.get_broker()
        group_callbacks = next(
            middleware
            for middleware in broker.middleware
            if isinstance(middleware, GroupCallbacks)
        )
        mocker.patch.object(
            group_callbacks,
            "rate_limiter_backend",
            RateLimiterBackend(client=FakeRedis()),
        )
        send_jobs_sync = mocker.patch("polar.worker._broker._sqs.send_jobs_sync")

        dummy_actor = broker.get_actor("dummy")
        dummy_group = group(
            [
                dummy_actor.message(redis_key="child-1"),
                dummy_actor.message(redis_key="child-2"),
            ]
        )
        dummy_group.add_completion_callback(dummy_actor.message(redis_key="callback"))
        dummy_group.run()

        child_jobs = [call.args[0][0] for call in send_jobs_sync.call_args_list]
        assert len(child_jobs) == 2
        assert {job.message_options["group_completion_uuid"] for job in child_jobs} == {
            child_jobs[0].message_options["group_completion_uuid"]
        }
        assert all(
            job.message_options["group_completion_callbacks"] for job in child_jobs
        )

        mocker.patch(
            "polar.worker._runner.build_registry",
            return_value={"dummy": mocker.AsyncMock()},
        )
        send_jobs_sync.reset_mock()

        child_envelopes = [
            _sqs.parse_envelope(
                _sqs.build_envelope(
                    job.actor,
                    job.args,
                    job.kwargs,
                    job.correlation_id,
                    message_id=job.message_id,
                    message_options=job.message_options,
                )
            )
            for job in child_jobs
        ]

        first_envelope, second_envelope = child_envelopes
        await run_task(
            first_envelope.actor,
            first_envelope.args,
            first_envelope.kwargs,
            message_id=first_envelope.message_id,
            message_options=first_envelope.message_options,
        )
        send_jobs_sync.assert_not_called()

        await run_task(
            second_envelope.actor,
            second_envelope.args,
            second_envelope.kwargs,
            message_id=second_envelope.message_id,
            message_options=second_envelope.message_options,
        )

        send_jobs_sync.assert_called_once()
        callback_job = send_jobs_sync.call_args.args[0][0]
        assert callback_job.actor == "dummy"
        assert callback_job.kwargs == {"redis_key": "callback"}


class TestValidateAllowlist:
    def test_accepts_cron_actor(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {CRON_ACTOR})

        validate_allowlist()

    def test_accepts_debounced_actor(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"customer.webhook"})

        validate_allowlist()

    def test_rejects_debounce_min_threshold_over_sqs_delay_cap(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"customer.webhook"})
        actor = dramatiq.get_broker().get_actor("customer.webhook")
        mocker.patch.dict(actor.options, {"debounce_min_threshold": 901})

        with pytest.raises(ValueError, match="debounce_min_threshold"):
            validate_allowlist()


class TestWildcardAllowlist:
    def test_resolves_to_every_declared_actor(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {SQS_ACTORS_WILDCARD})

        assert resolve_sqs_actors() == dramatiq.get_broker().get_declared_actors()

    def test_wildcard_alongside_other_names_is_not_a_wildcard(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(
            settings, "WORKER_SQS_ACTORS", {SQS_ACTORS_WILDCARD, CRON_ACTOR}
        )

        assert resolve_sqs_actors() == {SQS_ACTORS_WILDCARD, CRON_ACTOR}
        assert not should_route_to_sqs(SUBSCRIPTION_ACTOR)
        with pytest.raises(ActorNotFound):
            validate_allowlist()

    @pytest.mark.parametrize(("enabled", "expected"), [(True, True), (False, False)])
    def test_enabled_flag_dominates_the_wildcard(
        self, mocker: MockerFixture, enabled: bool, expected: bool
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", enabled)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {SQS_ACTORS_WILDCARD})

        assert should_route_to_sqs(SUBSCRIPTION_ACTOR) is expected

    def test_all_declared_actors_are_sqs_compatible(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {SQS_ACTORS_WILDCARD})

        validate_allowlist()
