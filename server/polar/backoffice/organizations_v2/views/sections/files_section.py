"""Files section with file listing and downloads."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from starlette.datastructures import URL
from tagflow import attr, tag, text

from polar.file.service import file as file_service
from polar.models import File, Organization

from ....components import card, empty_state


class FilesSection:
    """Render the files section with file listing."""

    def __init__(
        self,
        organization: Organization,
        files: list[File] | None = None,
        page: int = 1,
        limit: int = 10,
        total_count: int = 0,
    ):
        self.org = organization
        self.files = files or []
        self.page = page
        self.limit = limit
        self.total_count = total_count

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

    def _render_pagination(self, request: Request) -> None:
        """Render pagination controls for files."""
        start = (self.page - 1) * self.limit + 1
        end = min(self.page * self.limit, self.total_count)

        # Calculate URLs for navigation
        next_url: URL | None = None
        if end < self.total_count:
            next_url = request.url.replace_query_params(
                **{**request.query_params, "files_page": self.page + 1}
            ).replace(fragment="files")
        previous_url: URL | None = None
        if start > 1:
            previous_url = request.url.replace_query_params(
                **{**request.query_params, "files_page": self.page - 1}
            ).replace(fragment="files")

        with tag.div(classes="flex justify-between"):
            with tag.div(classes="text-sm"):
                text("Showing ")
                with tag.span(classes="font-bold"):
                    text(str(start))
                text(" to ")
                with tag.span(classes="font-bold"):
                    text(str(end))
                text(" of ")
                with tag.span(classes="font-bold"):
                    text(str(self.total_count))
                text(" entries")
            with tag.div(classes="join grid grid-cols-2"):
                with tag.a(
                    classes="join-item btn",
                    href=str(previous_url) if previous_url else "",
                ):
                    if previous_url is None:
                        attr("disabled", True)
                    text("Previous")
                with tag.a(
                    classes="join-item btn",
                    href=str(next_url) if next_url else "",
                ):
                    if next_url is None:
                        attr("disabled", True)
                    text("Next")

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the files section."""

        with tag.div(classes="space-y-6", id="files"):
            # Files list card
            with card(bordered=True):
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Downloadable Files")
                    with tag.div(classes="text-sm text-base-content/60"):
                        text(f"{self.total_count} file(s)")

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
                                    # Generate presigned download URL
                                    download_url, _ = (
                                        file_service.generate_download_url(file)
                                    )

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
                                            with tag.a(
                                                href=download_url,
                                                target="_blank",
                                                rel="noopener noreferrer",
                                                classes="btn btn-sm btn-ghost",
                                            ):
                                                text("Download")

                    # Pagination controls
                    if self.total_count > self.limit:
                        self._render_pagination(request)
                else:
                    with empty_state(
                        "No Files",
                        "This organization hasn't uploaded any downloadable files yet.",
                    ):
                        pass

            # File storage info
            with card(bordered=True):
                with tag.h3(classes="text-md font-bold mb-3"):
                    text("Storage Information")

                with tag.div(classes="space-y-2 text-sm"):
                    page_size = sum(f.size for f in self.files if f.size)

                    with tag.div(classes="flex justify-between"):
                        with tag.span(classes="text-base-content/60"):
                            text("Total Files:")
                        with tag.span(classes="font-semibold"):
                            text(str(self.total_count))

                    with tag.div(classes="flex justify-between"):
                        with tag.span(classes="text-base-content/60"):
                            text("Page Size:")
                        with tag.span(classes="font-semibold"):
                            text(self.format_file_size(page_size))

            yield


__all__ = ["FilesSection"]
