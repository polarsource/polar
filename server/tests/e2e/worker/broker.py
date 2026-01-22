"""
Test broker infrastructure for billing E2E tests.

Creates a StubBroker with all Polar actors registered, enabling
true task chain execution in tests.
"""

from typing import Any

import dramatiq
from dramatiq.brokers.stub import StubBroker
from dramatiq.middleware import AsyncIO, CurrentMessage


def create_test_broker() -> StubBroker:
    """
    Create a StubBroker with required middleware for testing.

    The broker is created with AsyncIO and CurrentMessage middleware
    to support async actors and message context.
    """
    broker = StubBroker()
    broker.add_middleware(AsyncIO())
    broker.add_middleware(CurrentMessage())
    return broker


def register_actors_to_broker(broker: StubBroker) -> None:
    """
    Register all Polar actors with the test broker.

    This imports polar.tasks to ensure all actors are registered with the
    global broker, then copies them to the test broker.

    Note: Must be called after creating the broker but before processing
    any messages.
    """
    # Import tasks to register all actors with the global broker
    import polar.tasks  # noqa: F401

    # Get the global broker and copy actors to the test broker
    global_broker = dramatiq.get_broker()

    for actor_name in list(global_broker.actors.keys()):
        actor = global_broker.get_actor(actor_name)
        # Declare the actor on the test broker
        # This creates a new actor instance bound to the test broker
        _declare_actor_on_broker(broker, actor)

    # Emit process_boot to initialize any middleware state
    broker.emit_after("process_boot")


def _declare_actor_on_broker(
    broker: StubBroker, original_actor: dramatiq.Actor[Any, Any]
) -> None:
    """
    Declare an actor on a new broker.

    Creates a new actor instance with the same function and options
    but bound to the target broker.
    """
    # Get the original function (unwrapped from the actor)
    fn = original_actor.fn

    # Create a new actor with the same configuration
    new_actor: dramatiq.Actor[Any, Any] = dramatiq.Actor(
        fn,
        broker=broker,
        actor_name=original_actor.actor_name,
        queue_name=original_actor.queue_name,
        priority=original_actor.options.get("priority", 0),
        options=original_actor.options,
    )
    broker.declare_actor(new_actor)
