"""Files section with file listing and downloads."""

import contextlib
from collections.abc import Generator

from fastapi import Request

from polar.file.service import file as file_service
from polar.models import File, Organization

from ....components import card, empty_state
from polar.backoffice.document import get_document


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

        doc = get_document()        """Format file size in human-readable format."""
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

        doc = get_document()        doc = get_document()
        """Render the files section."""

        with doc.div(classes="space-y-6"):
            # Files list card
            with card(bordered=True):
                with doc.div(classes="flex items-center justify-between mb-4"):
                    with doc.h2(classes="text-lg font-bold"):
                        doc.text("Downloadable Files")
                    with doc.div(classes="text-sm text-base-content/60"):
                        doc.text(f"{len(self.files)} file(s)")

                if self.files:
                    # Files table
                    with doc.div(classes="overflow-x-auto"):
                        with doc.table(classes="table table-zebra w-full"):
                            with doc.thead():
                                with doc.tr():
                                    with doc.th():
                                        doc.text("Name")
                                    with doc.th():
                                        doc.text("Type")
                                    with doc.th():
                                        doc.text("Size")
                                    with doc.th():
                                        doc.text("Created")
                                    with doc.th():
                                        doc.text("Actions")

                            with doc.tbody():
                                for file in self.files:
                                    # Generate presigned download URL
                                    download_url, _ = (
                                        file_service.generate_download_url(file)
                                    )

                                    with doc.tr():
                                        with doc.td():
                                            with doc.div(classes="font-medium"):
                                                doc.text(file.name)

                                        with doc.td():
                                            with doc.span(
                                                classes="badge badge-sm badge-ghost"
                                            ):
                                                doc.text(file.mime_type or "unknown")

                                        with doc.td():
                                            doc.text(
                                                self.format_file_size(file.size)
                                                if file.size
                                                else "N/A"
                                            )

                                        with doc.td():
                                            doc.text(
                                                file.created_at.strftime("%Y-%m-%d")
                                                if file.created_at
                                                else "N/A"
                                            )

                                        with doc.td():
                                            with doc.a(
                                                href=download_url,
                                                target="_blank",
                                                rel="noopener noreferrer",
                                                classes="btn btn-sm btn-ghost",
                                            ):
                                                doc.text("Download")
                else:
                    with empty_state(
                        "No Files",
                        "This organization hasn't uploaded any downloadable files yet.",
                    ):
                        pass

            # File storage info
            with card(bordered=True):
                with doc.h3(classes="text-md font-bold mb-3"):
                    doc.text("Storage Information")

                with doc.div(classes="space-y-2 text-sm"):
                    total_size = sum(f.size for f in self.files if f.size)

                    with doc.div(classes="flex justify-between"):
                        with doc.span(classes="text-base-content/60"):
                            doc.text("Total Files:")
                        with doc.span(classes="font-semibold"):
                            doc.text(str(len(self.files)))

                    with doc.div(classes="flex justify-between"):
                        with doc.span(classes="text-base-content/60"):
                            doc.text("Total Size:")
                        with doc.span(classes="font-semibold"):
                            doc.text(self.format_file_size(total_size))

            yield


__all__ = ["FilesSection"]
