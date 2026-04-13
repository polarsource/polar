"""
Email capture for E2E tests.

Provides an ``EmailCapture`` that collects emails sent during a test,
and a factory to create the mock that wires into it.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import AsyncMock, MagicMock


@dataclass
class CapturedEmail:
    to: str
    subject: str


@dataclass
class EmailCapture:
    """Collects all emails that would be sent during the test."""

    emails: list[CapturedEmail] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.emails)

    def find(self, *, to: str | None = None) -> list[CapturedEmail]:
        results = self.emails
        if to is not None:
            results = [e for e in results if e.to == to]
        return results


def create_email_sender_mock(capture: EmailCapture) -> MagicMock:
    """Create a mock email sender that records emails into *capture*."""

    async def _capture_send(
        *,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = "",
        from_email_addr: str = "",
        email_headers: dict[str, str] | None = None,
        reply_to_name: str | None = None,
        reply_to_email_addr: str | None = None,
        attachments: Any = None,
    ) -> str:
        capture.emails.append(CapturedEmail(to=to_email_addr, subject=subject))
        return f"mock-email-{uuid.uuid4()}"

    mock = MagicMock()
    mock.send = AsyncMock(side_effect=_capture_send)
    return mock
