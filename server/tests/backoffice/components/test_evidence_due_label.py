"""Tests for the shared evidence-due label: the red "Past due" marker must
only show while a response is still owed — resolved disputes keep a stale
``past_due`` flag stamped by the processor."""

from datetime import UTC, datetime

from tagflow import document, tag

from polar.backoffice.components import evidence_due_label
from polar.models.dispute import DisputeStatus

DEADLINE = datetime(2026, 7, 20, 8, 29, tzinfo=UTC)


def _render(
    evidence_due_by: datetime | None,
    past_due: bool | None,
    status: DisputeStatus | None,
) -> str:
    with document() as doc:
        with tag.div():
            evidence_due_label(evidence_due_by, past_due, status)
    return doc.to_html()


class TestEvidenceDueLabel:
    def test_past_due_needs_response_shows_marker(self) -> None:
        html = _render(DEADLINE, True, DisputeStatus.needs_response)
        assert "Past due" in html
        assert "Jul 20, 2026 08:29 UTC" in html

    def test_past_due_resolved_dispute_suppresses_marker(self) -> None:
        for status in (
            DisputeStatus.lost,
            DisputeStatus.won,
            DisputeStatus.under_review,
        ):
            html = _render(DEADLINE, True, status)
            assert "Past due" not in html
            assert "Jul 20, 2026 08:29 UTC" in html

    def test_upcoming_deadline_has_no_marker(self) -> None:
        html = _render(DEADLINE, False, DisputeStatus.needs_response)
        assert "Past due" not in html
        assert "Jul 20, 2026 08:29 UTC" in html

    def test_no_deadline_renders_dash(self) -> None:
        assert "—" in _render(None, False, None)
