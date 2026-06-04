import hashlib
import hmac

from polar.integrations.slack.verification import verify_slack_signature


def _signature(signing_secret: str, body: bytes, timestamp: int) -> str:
    basestring = f"v0:{timestamp}:".encode() + body
    digest = hmac.new(signing_secret.encode(), basestring, hashlib.sha256).hexdigest()
    return f"v0={digest}"


class TestVerifySlackSignature:
    def test_valid_signature(self) -> None:
        timestamp = 1_700_000_000
        body = b'{"type":"event_callback"}'
        signing_secret = "ss-test-secret"

        assert verify_slack_signature(
            signing_secret=signing_secret,
            request_body=body,
            signature_header=_signature(signing_secret, body, timestamp),
            timestamp_header=str(timestamp),
            now=timestamp,
        )

    def test_malformed_signature_header_returns_false(self) -> None:
        timestamp = 1_700_000_000

        assert not verify_slack_signature(
            signing_secret="ss-test-secret",
            request_body=b"{}",
            signature_header="v0=\N{SNOWMAN}",
            timestamp_header=str(timestamp),
            now=timestamp,
        )
