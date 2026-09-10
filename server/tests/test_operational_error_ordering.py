"""Regression tests for the operational-error middleware ordering.

``OperationalErrorMiddleware`` must sit OUTSIDE ``AuthSubjectMiddleware`` (and
the other DB-issuing middleware) in ``create_app()``: ``AuthSubjectMiddleware``
performs auth-resolution DB lookups *before* delegating to the inner app, so an
asyncpg-protocol query timeout raised there only gets classified (and dropped by
Sentry's ``before_send``) if ``OperationalErrorMiddleware`` wraps it.

When that middleware was introduced it was added first, which under Starlette's
"last added = outermost" rule made it *innermost* and left auth-resolution
timeouts bypassing classification entirely. These tests pin the ordering and the
end-to-end tagging behaviour so a future middleware shuffle cannot silently
reintroduce the defect.
"""

import asyncio
from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from starlette.types import Receive, Scope, Send

from polar.app import create_app
from polar.auth.middlewares import AuthSubjectMiddleware
from polar.config import settings
from polar.middlewares import OperationalErrorMiddleware
from polar.operational_errors import _sql_timeout_error_matcher


def _asyncpg_protocol_timeout() -> TimeoutError:
    """Build a ``TimeoutError`` whose traceback points at ``asyncpg/protocol``.

    ``_sql_timeout_error_matcher`` recognises an asyncpg command timeout by
    substring-matching ``"asyncpg/protocol/protocol.pyx"`` in the formatted
    traceback. Rewriting a helper function's ``co_filename`` to that path and
    calling it reproduces that marker exactly, without depending on asyncpg's
    installed sources being present at runtime. The marker survives a bare
    ``raise`` (how the middleware re-raises), so the matcher still fires after
    the exception propagates through the middleware chain.
    """

    def _raise() -> None:
        raise TimeoutError("query timed out")

    _raise.__code__ = _raise.__code__.replace(
        co_filename="asyncpg/protocol/protocol.pyx"
    )
    try:
        _raise()
    except TimeoutError as exc:
        return exc
    raise RuntimeError("unreachable")  # pragma: no cover


def _http_scope(state: dict[str, Any] | None = None) -> Scope:
    return cast(
        Scope,
        {
            "type": "http",
            "method": "GET",
            "path": "/v1/something",
            "headers": [],
            "state": state if state is not None else {},
        },
    )


async def _noop_send(message: dict[str, Any]) -> None:
    pass


async def _raise_asyncpg_timeout(request: Any, session: Any) -> None:
    # Mimics get_auth_subject raising during a DB lookup (an asyncpg command
    # timeout) before AuthSubjectMiddleware delegates to the inner app.
    raise _asyncpg_protocol_timeout()


class TestOperationalErrorMiddlewareOrdering:
    def test_create_app_places_operational_error_outer_to_auth_subject(
        self, mocker: MockerFixture
    ) -> None:
        # The production stack (with AuthSubjectMiddleware etc.) is only
        # assembled when is_testing() is False; replicate that here so the
        # relative ordering of the two middleware is observable.
        mocker.patch.object(settings, "is_testing", return_value=False)
        mocker.patch("polar.app.create_redis", return_value=MagicMock())

        app = create_app()

        # Starlette inserts each added middleware at index 0 of user_middleware,
        # so index 0 == outermost == last added. OperationalErrorMiddleware must
        # have a *lower* index than AuthSubjectMiddleware to wrap it.
        classes: list[Any] = [m.cls for m in app.user_middleware]
        ops_index = classes.index(OperationalErrorMiddleware)
        auth_index = classes.index(AuthSubjectMiddleware)
        assert ops_index < auth_index

    def test_auth_resolution_timeout_is_tagged_when_operational_error_wraps_auth(
        self, mocker: MockerFixture
    ) -> None:
        # Fixed ordering: OperationalErrorMiddleware is outer to AuthSubjectMiddleware.
        async def inner_app(scope: Scope, receive: Receive, send: Send) -> None:
            raise AssertionError(
                "inner app must not be reached when auth resolution fails"
            )

        mocker.patch(
            "polar.auth.middlewares.get_auth_subject", new=_raise_asyncpg_timeout
        )
        handle_spy = mocker.patch("polar.middlewares.handle_operational_error")

        stack = OperationalErrorMiddleware(
            AuthSubjectMiddleware(inner_app, redis=MagicMock())
        )

        scope = _http_scope(state={"async_session": MagicMock()})
        with pytest.raises(TimeoutError):
            asyncio.run(stack(scope, cast(Receive, None), cast(Send, _noop_send)))

        handle_spy.assert_called_once()
        classified_exc = handle_spy.call_args.args[0]
        assert isinstance(classified_exc, TimeoutError)
        # The exception reaching the classifier still carries the asyncpg marker,
        # i.e. it would actually be classified and tagged (then dropped by Sentry).
        assert _sql_timeout_error_matcher(classified_exc) is True
