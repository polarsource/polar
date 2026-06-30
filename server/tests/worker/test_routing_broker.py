import dramatiq
import pytest
from dramatiq.brokers.redis import RedisBroker
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.config import settings
from polar.worker._runner import validate_allowlist

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


class TestValidateAllowlist:
    def test_accepts_cron_actor(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {CRON_ACTOR})

        validate_allowlist()

    def test_rejects_debounced_actor(self, mocker: MockerFixture) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"customer.webhook"})

        with pytest.raises(ValueError, match="debounce"):
            validate_allowlist()
