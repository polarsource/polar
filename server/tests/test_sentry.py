from typing import Any, cast

from sqlalchemy.exc import IntegrityError

from polar.sentry import before_send

_CLIENT_ID = "polar_ci_" + ("a" * 37) + ("b" * 6)
_ACCESS_TOKEN = "polar_at_u_" + ("c" * 37) + ("d" * 6)
_SESSION_TOKEN = "polar_auth_session_" + ("e" * 37) + ("f" * 6)
_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
_IP_ADDRESS = "203.0.113.50"


class TestBeforeSend:
    def test_scrubs_oauth_grant_unique_violation(self) -> None:
        event: dict[str, Any] = {
            "exception": {
                "values": [
                    {
                        "type": "IntegrityError",
                        "module": "sqlalchemy.exc",
                        "value": (
                            "duplicate key value violates unique constraint "
                            '"oauth2_grants_client_id_user_id_key"\n'
                            "DETAIL:  Key (client_id, user_id)="
                            f"({_CLIENT_ID}, 00000000-0000-4000-8000-000000000001) "
                            "already exists.\n"
                            f"[parameters: {{'client_id': '{_CLIENT_ID}', "
                            f"'access_token': '{_ACCESS_TOKEN}'}}]"
                        ),
                    }
                ]
            },
            "request": {
                "url": f"https://user:{_SESSION_TOKEN}@api.polar.sh/v1/oauth2/consent?next=1",
                "query_string": "next=1",
                "headers": {
                    "User-Agent": _USER_AGENT,
                    "Authorization": f"Bearer {_SESSION_TOKEN}",
                    "X-Forwarded-For": _IP_ADDRESS,
                },
            },
            "user": {"ip_address": _IP_ADDRESS},
            "breadcrumbs": {
                "values": [
                    {"message": f"consent failed for {_CLIENT_ID}"},
                ]
            },
        }

        assert before_send(cast(Any, event), {}) is not None
        value = event["exception"]["values"][0]["value"]
        assert _CLIENT_ID not in value
        assert _ACCESS_TOKEN not in value
        assert "oauth2_grants_client_id_user_id_key" in value
        assert "Key ([Filtered])=([Filtered]) already exists." in value
        assert (
            "[parameters: {'client_id': '[Filtered]', 'access_token': '[Filtered]'}]"
            in value
        )
        assert event["request"]["url"] == "https://api.polar.sh/"
        assert "query_string" not in event["request"]
        assert event["request"]["headers"]["User-Agent"] == _USER_AGENT
        assert event["request"]["headers"]["X-Forwarded-For"] == _IP_ADDRESS
        assert event["request"]["headers"]["Authorization"] == "Bearer [Filtered]"
        assert event["user"]["ip_address"] == _IP_ADDRESS
        assert (
            event["breadcrumbs"]["values"][0]["message"]
            == "consent failed for [Filtered]"
        )

    def test_scrubs_constraint_detail_from_hint_when_event_has_no_module(self) -> None:
        try:
            raise IntegrityError("INSERT", {"client_id": _CLIENT_ID}, Exception("orig"))
        except IntegrityError as exc:
            hint = {"exc_info": (type(exc), exc, exc.__traceback__)}

        event: dict[str, Any] = {
            "exception": {
                "values": [
                    {
                        "type": "IntegrityError",
                        "value": (
                            "Key (client_id, user_id)="
                            f"({_CLIENT_ID}, 00000000-0000-4000-8000-000000000001) "
                            "already exists."
                        ),
                    }
                ]
            }
        }

        before_send(cast(Any, event), hint)

        assert event["exception"]["values"][0]["value"] == (
            "Key ([Filtered])=([Filtered]) already exists."
        )

    def test_leaves_constraint_text_on_non_sql_exceptions(self) -> None:
        event: dict[str, Any] = {
            "exception": {
                "values": [
                    {
                        "type": "RuntimeError",
                        "module": "builtins",
                        "value": (
                            f"Key (client_id, user_id)=({_CLIENT_ID}, "
                            "00000000-0000-4000-8000-000000000001) already exists. "
                            "Key (slug)=(acme) already exists. "
                            "template=polar_self_subscription_confirmation"
                        ),
                    }
                ]
            },
            "request": {
                "headers": {
                    "User-Agent": _USER_AGENT,
                }
            },
            "user": {"ip_address": _IP_ADDRESS},
        }

        before_send(cast(Any, event), {})

        value = event["exception"]["values"][0]["value"]
        assert _CLIENT_ID not in value
        assert (
            "Key (client_id, user_id)=([Filtered], "
            "00000000-0000-4000-8000-000000000001) already exists."
        ) in value
        assert "Key (slug)=(acme) already exists." in value
        assert "polar_self_subscription_confirmation" in value
        assert event["request"]["headers"]["User-Agent"] == _USER_AGENT
        assert event["user"]["ip_address"] == _IP_ADDRESS

    def test_drops_operational_errors(self) -> None:
        event: dict[str, Any] = {
            "tags": {"is_operational_error": "true"},
            "exception": {
                "values": [
                    {
                        "type": "IntegrityError",
                        "module": "sqlalchemy.exc",
                        "value": f"Key (client_id)=({_CLIENT_ID}) already exists.",
                    }
                ]
            },
        }

        assert before_send(cast(Any, event), {}) is None
