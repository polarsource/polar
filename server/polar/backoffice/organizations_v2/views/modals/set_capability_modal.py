"""Modal for overriding a single organization capability."""

import contextlib
from collections.abc import Generator

from pydantic import ValidationError
from tagflow import tag, text

from polar.backoffice.components import button, modal
from polar.models import Organization
from polar.models.organization import STATUS_CAPABILITIES, CapabilityName


class SetCapabilityModal:
    def __init__(
        self,
        organization: Organization,
        capability: CapabilityName,
        capability_label: str,
        target_value: bool,
        form_action: str,
        validation_error: ValidationError | None = None,
    ):
        self.organization = organization
        self.capability = capability
        self.capability_label = capability_label
        self.target_value = target_value
        self.form_action = form_action
        self.validation_error = validation_error

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        current_value = self.organization.capabilities[self.capability]
        status_default = STATUS_CAPABILITIES[self.organization.status][self.capability]

        action_word = "Enable" if self.target_value else "Disable"

        with modal(f"{action_word} capability: {self.capability_label}", open=True):
            with tag.form(
                method="post",
                hx_post=self.form_action,
                hx_target="#modal",
                classes="flex flex-col gap-4",
            ):
                with tag.div(classes="alert"):
                    with tag.span(classes="text-sm"):
                        text(
                            "Overrides persist until the next status transition, "
                            "at which point the capability resets to the status "
                            "default."
                        )

                def _state(v: bool) -> str:
                    return "Enabled" if v else "Disabled"

                summary_rows: list[tuple[str, str, str]] = [
                    ("Capability:", self.capability, "font-mono text-sm"),
                    ("Current:", _state(current_value), "font-semibold text-sm"),
                    ("Target:", _state(self.target_value), "font-semibold text-sm"),
                    (
                        "Status default:",
                        _state(status_default),
                        "font-semibold text-sm",
                    ),
                ]

                with tag.div(classes="bg-base-200 p-4 rounded-lg space-y-2"):
                    for row_label, row_value, value_classes in summary_rows:
                        with tag.div(classes="flex items-center gap-2"):
                            with tag.span(classes="text-sm text-base-content/60"):
                                text(row_label)
                            with tag.span(classes=value_classes):
                                text(row_value)

                with tag.div(classes="form-control w-full"):
                    with tag.label(classes="label"):
                        with tag.span(classes="label-text font-semibold"):
                            text("Reason")
                        with tag.span(classes="label-text-alt text-error"):
                            text("Required (min 10 characters)")

                    with tag.textarea(
                        name="reason",
                        placeholder=(
                            "Explain why this capability is being overridden…"
                        ),
                        classes="textarea textarea-bordered w-full min-h-24",
                        required=True,
                    ):
                        pass

                    if self.validation_error:
                        for error in self.validation_error.errors():
                            if "reason" in error.get("loc", ()):
                                with tag.div(classes="label"):
                                    with tag.span(classes="label-text-alt text-error"):
                                        text(error["msg"])

                with tag.div(
                    classes=(
                        "modal-action pt-6 border-t border-base-200 "
                        "flex justify-end gap-2"
                    )
                ):
                    with tag.form(method="dialog"):
                        with button(ghost=True, type="submit"):
                            text("Cancel")

                    with button(variant="primary", outline=True, type="submit"):
                        text(f"{action_word} capability")

        yield


__all__ = ["SetCapabilityModal"]
