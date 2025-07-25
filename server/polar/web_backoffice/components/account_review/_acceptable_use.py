import contextlib
from collections.abc import Generator
from typing import Any

from tagflow import tag, text


class AcceptableUseVerdict:
    """Acceptable use compliance assessment component."""

    def __init__(self, verdict_data: dict[str, Any]):
        self.verdict = verdict_data["verdict"]  # PASS | FAIL | UNCERTAIN
        self.risk_score = verdict_data["risk_score"]  # 0-100
        self.violated_sections = verdict_data.get("violated_sections", [])
        self.reason = verdict_data["reason"]

    @property
    def verdict_text(self) -> str:
        """Get the verdict text."""
        return self.verdict.upper()

    @property
    def verdict_classes(self) -> str:
        """Get CSS classes for the verdict badge."""
        if self.verdict.upper() == "PASS":
            return "bg-green-100 text-green-800"
        elif self.verdict.upper() == "UNCERTAIN":
            return "bg-yellow-100 text-yellow-800"
        else:  # FAIL
            return "bg-red-100 text-red-800"

    @property
    def risk_level_text(self) -> str:
        """Get risk level description based on risk score."""
        if self.risk_score < 30:
            return "Low Risk"
        elif self.risk_score < 70:
            return "Medium Risk"
        else:
            return "High Risk"

    @property
    def assessment_text(self) -> str:
        """Get detailed compliance assessment text."""
        base_text = f"Compliance assessment shows {self.risk_level_text.lower()} (score: {self.risk_score:.1f}/100). {self.reason}"

        if self.violated_sections:
            sections_text = ", ".join(self.violated_sections)
            base_text += f" Violated sections: {sections_text}."

        return base_text

    @contextlib.contextmanager
    def _render_indicator(self) -> Generator[None]:
        """Render the compliance indicator with badge and risk score."""
        with tag.div(classes="flex items-center gap-2"):
            with tag.div(
                classes=f"px-2 py-1 rounded text-xs font-medium {self.verdict_classes}"
            ):
                text(self.verdict_text)

            yield

    @contextlib.contextmanager
    def _render_detailed_assessment(self) -> Generator[None]:
        """Render detailed compliance assessment."""
        with tag.div(classes="space-y-3"):
            # Risk score and level
            with tag.div(classes="flex justify-between"):
                with tag.span(classes="font-medium"):
                    text("Risk Score:")
                with tag.span():
                    text(f"{self.risk_score:.1f}/100")

            with tag.div(classes="flex justify-between"):
                with tag.span(classes="font-medium"):
                    text("Risk Level:")
                with tag.span():
                    text(self.risk_level_text)

            # Violated sections (if any)
            if self.violated_sections:
                with tag.div():
                    with tag.div(classes="font-medium mb-2"):
                        text("Violated Sections:")
                    with tag.ul(classes="list-disc list-inside space-y-1"):
                        for section in self.violated_sections:
                            with tag.li(classes="text-sm text-gray-700"):
                                text(section)

            # Assessment details
            with tag.div(classes="mt-4 p-3 bg-gray-50 rounded-lg"):
                with tag.div(classes="text-sm font-medium mb-1"):
                    text("Assessment Details:")
                with tag.div(classes="text-sm text-gray-700"):
                    text(self.assessment_text)

            # Risk level legend
            with tag.div(classes="mt-4 text-xs text-gray-600"):
                text("Risk levels: Low (0-29), Medium (30-69), High (70-100)")
            yield

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        """Render the complete acceptable use verdict component."""
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title"):
                text("Acceptable Use Policy")
                with self._render_indicator():
                    pass
            with self._render_detailed_assessment():
                pass
        yield
