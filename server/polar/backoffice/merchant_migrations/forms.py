from datetime import date
from typing import Annotated

from pydantic import BeforeValidator, Field

from polar.kit.schemas import empty_str_to_none

from .. import forms


class AnnotatePanStepForm(forms.BaseForm):
    """What Ops tells the merchant about a step we're waiting on."""

    note: Annotated[
        str | None,
        forms.TextAreaField(rows=3),
        BeforeValidator(empty_str_to_none),
        Field(
            title="Note",
            description=(
                "Shown to the merchant on this step. Say what is happening and "
                "what they should expect."
            ),
        ),
    ] = None
    expected_at: Annotated[
        date | None,
        forms.InputField(type="date"),
        BeforeValidator(empty_str_to_none),
        Field(
            title="Expected by",
            description="When this step should land. Overdue steps are flagged.",
        ),
    ] = None
    in_progress: Annotated[
        bool,
        Field(
            title="Mark as in progress",
            description="Use once the owner has actually picked the step up.",
        ),
    ] = False
