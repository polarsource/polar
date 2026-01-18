"""Files section with file listing and downloads."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from markupflow import Fragment

from polar.file.service import file as file_service
from polar.models import File, Organization

from ....components import card, empty_state


class FilesSection:
    """Render the files section with file listing."""

    def __init__(
        self,
        organization: Organization,
        files: list[File] | None = None,
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
    def render(self, request: Request) -> Generator[Fragment]:
        """Render the files section."""
        fragment = Fragment()

        with fragment.div(class_="space-y-6"):
            # Files list card
            with card(bordered=True):
                with fragment.div(class_="flex items-center justify-between mb-4"):
                    with fragment.h2(class_="text-lg font-bold"):
                        fragment.text("Downloadable Files")
                    with fragment.div(class_="text-sm text-base-content/60"):
                        fragment.text(f"{len(self.files)} file(s)")

                if self.files:
                    # Files table
                    with fragment.div(class_="overflow-x-auto"):
                        with fragment.table(class_="table table-zebra w-full"):
                            with fragment.thead():
                                with fragment.tr():
                                    with fragment.th():
                                        fragment.text("Name")
                                    with fragment.th():
                                        fragment.text("Type")
                                    with fragment.th():
                                        fragment.text("Size")
                                    with fragment.th():
                                        fragment.text("Created")
                                    with fragment.th():
                                        fragment.text("Actions")

                            with fragment.tbody():
                                for file in self.files:
                                    # Generate presigned download URL
                                    download_url, _ = (
                                        file_service.generate_download_url(file)
                                    )

                                    with fragment.tr():
                                        with fragment.td():
                                            with fragment.div(class_="font-medium"):
                                                fragment.text(file.name)

                                        with fragment.td():
                                            with fragment.span(
                                                class_="badge badge-sm badge-ghost"
                                            ):
                                                fragment.text(
                                                    file.mime_type or "unknown"
                                                )

                                        with fragment.td():
                                            fragment.text(
                                                self.format_file_size(file.size)
                                                if file.size
                                                else "N/A"
                                            )

                                        with fragment.td():
                                            fragment.text(
                                                file.created_at.strftime("%Y-%m-%d")
                                                if file.created_at
                                                else "N/A"
                                            )

                                        with fragment.td():
                                            with fragment.a(
                                                href=download_url,
                                                target="_blank",
                                                rel="noopener noreferrer",
                                                class_="btn btn-sm btn-ghost",
                                            ):
                                                fragment.text("Download")
                else:
                    with empty_state(
                        "No Files",
                        "This organization hasn't uploaded any downloadable files yet.",
                    ):
                        pass

            # File storage info
            with card(bordered=True):
                with fragment.h3(class_="text-md font-bold mb-3"):
                    fragment.text("Storage Information")

                with fragment.div(class_="space-y-2 text-sm"):
                    total_size = sum(f.size for f in self.files if f.size)

                    with fragment.div(class_="flex justify-between"):
                        with fragment.span(class_="text-base-content/60"):
                            fragment.text("Total Files:")
                        with fragment.span(class_="font-semibold"):
                            fragment.text(str(len(self.files)))

                    with fragment.div(class_="flex justify-between"):
                        with fragment.span(class_="text-base-content/60"):
                            fragment.text("Total Size:")
                        with fragment.span(class_="font-semibold"):
                            fragment.text(self.format_file_size(total_size))

            yield fragment


__all__ = ["FilesSection"]
