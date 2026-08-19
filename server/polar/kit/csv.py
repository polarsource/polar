import collections
import collections.abc
import csv
from typing import TYPE_CHECKING, Any, BinaryIO

from fastapi.responses import StreamingResponse

if TYPE_CHECKING:
    import _csv

from .http import get_content_disposition


def get_iterable_from_binary_io(file: BinaryIO) -> collections.abc.Iterable[str]:
    for line in file:
        yield line.decode("utf-8")


class IterableCSVWriter:
    """
    Utility class wrapping the built-in csv.writer allowing
    to generate CSV rows as strings.

    It's useful to generate CSV with StreamingResponse, for example.
    """

    writer: "_csv._writer"

    def __init__(
        self,
        dialect: "_csv._DialectLike" = "excel",
        *,
        delimiter: str = ",",
        quotechar: str | None = '"',
        escapechar: str | None = None,
        doublequote: bool = True,
        skipinitialspace: bool = False,
        lineterminator: str = "\r\n",
        quoting: "_csv._QuotingType" = 0,
        strict: bool = False,
    ) -> None:
        self._lines: collections.deque[str] = collections.deque()
        self.writer = csv.writer(
            self,
            dialect=dialect,
            delimiter=delimiter,
            quotechar=quotechar,
            escapechar=escapechar,
            doublequote=doublequote,
            skipinitialspace=skipinitialspace,
            lineterminator=lineterminator,
            quoting=quoting,
            strict=strict,
        )

    def getrow(self, row: collections.abc.Iterable[Any]) -> str:
        self.writer.writerow(row)
        return self.read()

    def write(self, line: str) -> None:
        self._lines.append(line)

    def read(self) -> str:
        return self._lines.popleft()


class CSVStreamingResponse(StreamingResponse):
    """
    A StreamingResponse that streams CSV data.

    Declare it as response_class on a FastAPI endpoint to generate the correct OpenAPI schema for CSV responses.
    """

    media_type = "text/csv"

    def __init__(
        self,
        content: collections.abc.AsyncGenerator[str],
        filename: str,
        status_code: int = 200,
    ):
        super().__init__(
            content,
            status_code=status_code,
            media_type=self.media_type,
            headers={"Content-Disposition": get_content_disposition(filename)},
        )
