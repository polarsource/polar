"""Files section with file listing and downloads."""

import contextlib
from collections.abc import Generator
from typing import Any

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization

from ....components import button, card, empty_state


class FilesSection:
    """Render the files section with file listing."""

    def __init__(
        self,
        organization: Organization,
        files: list[Any] | None = None,
    ):
        self.org = organization
        self.files = files or []

    def format_file_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the files section."""

        with tag.div(classes="space-y-6"):
            # Files list card
            with card(bordered=True):
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Uploaded Files")
                    with tag.div(classes="text-sm text-base-content/60"):
                        text(f"{len(self.files)} file(s)")

                if self.files:
                    # Files table
                    with tag.div(classes="overflow-x-auto"):
                        with tag.table(classes="table table-zebra w-full"):
                            with tag.thead():
                                with tag.tr():
                                    with tag.th():
                                        text("Name")
                                    with tag.th():
                                        text("Type")
                                    with tag.th():
                                        text("Size")
                                    with tag.th():
                                        text("Created")
                                    with tag.th():
                                        text("Actions")

                            with tag.tbody():
                                for file in self.files:
                                    with tag.tr():
                                        with tag.td():
                                            with tag.div(classes="font-medium"):
                                                text(file.name)

                                        with tag.td():
                                            with tag.span(
                                                classes="badge badge-sm badge-ghost"
                                            ):
                                                text(file.mime_type or "unknown")

                                        with tag.td():
                                            text(
                                                self.format_file_size(file.size)
                                                if file.size
                                                else "N/A"
                                            )

                                        with tag.td():
                                            text(
                                                file.created_at.strftime("%Y-%m-%d")
                                                if file.created_at
                                                else "N/A"
                                            )

                                        with tag.td():
                                            with button(
                                                variant="secondary",
                                                size="sm",
                                                ghost=True,
                                                hx_get=f"/backoffice/organizations/{self.org.id}/files/{file.id}/download",
                                            ):
                                                text("Download")
                else:
                    with empty_state(
                        "No Files",
                        "This organization hasn't uploaded any files yet.",
                    ):
                        pass

            # File storage info
            with card(bordered=True):
                with tag.h3(classes="text-md font-bold mb-3"):
                    text("Storage Information")

                with tag.div(classes="space-y-2 text-sm"):
                    total_size = sum(f.size for f in self.files if f.size)

                    with tag.div(classes="flex justify-between"):
                        with tag.span(classes="text-base-content/60"):
                            text("Total Files:")
                        with tag.span(classes="font-semibold"):
                            text(str(len(self.files)))

                    with tag.div(classes="flex justify-between"):
                        with tag.span(classes="text-base-content/60"):
                            text("Total Size:")
                        with tag.span(classes="font-semibold"):
                            text(self.format_file_size(total_size))

            yield


__all__ = ["FilesSection"]
