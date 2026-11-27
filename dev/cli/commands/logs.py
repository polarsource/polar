"""View the local API and worker logs, or Docker container logs."""

import json
import os
import re
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated

import typer
from rich.markup import escape

from shared import SERVER_DIR, console

LOG_DIR = SERVER_DIR / ".logs"
PROCESSES = ("api", "worker")
ERROR_LEVELS = {"error", "critical", "fatal"}
HIDDEN_FIELDS = {
    "event",
    "level",
    "logger",
    "timestamp",
    "color_message",
    "exception",
    "correlation_id",
    "source_correlation_id",
    "message_id",
    "method",
    "path",
    "actor_name",
}
DURATION = re.compile(r"^(\d+)\s*([a-z]+)$")
UNITS = {
    "seconds": ("s", "sec", "secs", "second", "seconds"),
    "minutes": ("m", "min", "mins", "minute", "minutes"),
    "hours": ("h", "hr", "hrs", "hour", "hours"),
    "days": ("d", "day", "days"),
}


def _since(value: str | None) -> datetime | None:
    if value is None:
        return None
    match = DURATION.match(value.strip().lower())
    unit = next((unit for unit, names in UNITS.items() if match and match[2] in names), None)
    if unit is None:
        raise typer.BadParameter(f"'{value}' isn't a duration. Try 30s, 5min, 2h or 1d", param_hint="--since")
    return datetime.now(UTC) - timedelta(**{unit: int(match[1])})


def _read(process: str) -> list[dict]:
    records = []
    for path in (LOG_DIR / f"{process}.log.1", LOG_DIR / f"{process}.log"):
        if not path.exists():
            continue
        for line in path.read_text(errors="replace").splitlines():
            try:
                record = json.loads(line)
            except ValueError:
                continue
            record["process"] = process
            records.append(record)
    return records


def _timestamp(record: dict) -> datetime:
    return datetime.fromisoformat(record["timestamp"])


def _matches(record: dict, *, errors: bool, since: datetime | None, request: str | None) -> bool:
    if errors and record.get("level") not in ERROR_LEVELS:
        return False
    if since and _timestamp(record) < since:
        return False
    if request and request not in (record.get("correlation_id"), record.get("source_correlation_id")):
        return False
    return True


def _where(record: dict) -> str:
    if record.get("path"):
        return f"{record.get('method', '')} {record['path']}".strip()
    return record.get("actor_name") or record.get("logger", "")


def _local_time(record: dict) -> str:
    return _timestamp(record).astimezone().strftime("%H:%M:%S")


def _relative(filename: str) -> str:
    for marker in ("/site-packages/", f"{SERVER_DIR}/"):
        if marker in filename:
            return filename.split(marker, 1)[1]
    return filename


def _traceback_lines(exception: list[dict]) -> list[str]:
    lines = []
    for error in exception:
        frames = error.get("frames", [])
        ours = [frame for frame in frames if "site-packages" not in frame["filename"]]
        shown = ours[-6:]
        if frames and frames[-1] not in shown:
            shown.append(frames[-1])
        value = str(error.get("exc_value", "")).strip().splitlines()
        first = value[0] if value else ""
        lines.append(f"{error.get('exc_type')}: {first if len(first) <= 200 else first[:200] + '…'}")
        lines.extend(f"    {line}" for line in value[1:4])
        lines.extend(f"  {_relative(frame['filename'])}:{frame['lineno']} in {frame['name']}" for frame in shown)
    return lines


def _print_record(record: dict) -> None:
    extra = " ".join(
        f"{key}={str(value)[:120]}" for key, value in record.items() if key not in HIDDEN_FIELDS | {"process"}
    )
    level = record.get("level", "")
    style = "red" if level in ERROR_LEVELS else "yellow" if level == "warning" else "dim"
    console.print(
        f"[dim]{_local_time(record)}[/dim]  [{style}]{level:<7}[/{style}] {record['process']:<6}  "
        f"[cyan]{escape(_where(record))}[/cyan]  {escape(str(record.get('event', ''))[:300])}"
        + (f"  [dim]{escape(extra)}[/dim]" if extra else ""),
        soft_wrap=True,
        highlight=False,
    )


def _error_key(record: dict) -> tuple:
    exception = record.get("exception") or [{}]
    if exception[0]:
        return record["process"], _where(record), exception[-1].get("exc_type"), str(exception[-1].get("exc_value"))[:200]
    return record["process"], record.get("logger"), record.get("event")


def _print_errors(records: list[dict], tail: int) -> None:
    groups: dict[tuple, list[dict]] = {}
    for record in records:
        groups.setdefault(_error_key(record), []).append(record)
    latest = sorted(groups.values(), key=lambda group: _timestamp(group[-1]))[-tail:]
    if len(latest) < len(groups):
        console.print(
            f"[dim]{len(groups) - len(latest)} older errors not shown. Add --tail {len(groups)} to see them all.[/dim]",
            soft_wrap=True,
        )
    for group in latest:
        record = group[-1]
        repeats = f"  [dim](×{len(group)} since {_local_time(group[0])})[/dim]" if len(group) > 1 else ""
        console.print(
            f"\n[red]✗[/red] [dim]{_local_time(record)}[/dim]  {record['process']}  "
            f"[bold cyan]{escape(_where(record))}[/bold cyan]{repeats}",
            soft_wrap=True,
            highlight=False,
        )
        console.print(f"  {escape(str(record.get('event', ''))[:300])}", soft_wrap=True, highlight=False)
        for line in _traceback_lines(record.get("exception") or []):
            console.print(f"  {escape(line)}", soft_wrap=True, highlight=False)
        request = record.get("source_correlation_id") or record.get("correlation_id")
        if request:
            console.print(f"  [dim]Everything from this request: dev logs --request {request}[/dim]", soft_wrap=True)
    console.print()


def _follow(processes: list[str], *, errors: bool, request: str | None) -> None:
    files: dict[str, tuple[int, object]] = {}
    pending: dict[str, bytes] = {}

    def open_file(process: str, at_end: bool):
        path = LOG_DIR / f"{process}.log"
        path.parent.mkdir(exist_ok=True)
        path.touch()
        handle = path.open("rb")
        if at_end:
            handle.seek(0, os.SEEK_END)
        files[process] = (os.fstat(handle.fileno()).st_ino, handle)
        pending[process] = b""

    for process in processes:
        open_file(process, at_end=True)
    console.print(f"[dim]Following {', '.join(processes)} logs. Ctrl+C to stop.[/dim]")
    try:
        while True:
            idle = True
            for process in processes:
                inode, handle = files[process]
                chunk = handle.read()
                if not chunk:
                    path = LOG_DIR / f"{process}.log"
                    if not path.exists() or path.stat().st_ino != inode:
                        handle.close()
                        open_file(process, at_end=False)
                    continue
                idle = False
                *lines, pending[process] = (pending[process] + chunk).split(b"\n")
                for line in lines:
                    try:
                        record = json.loads(line)
                    except ValueError:
                        continue
                    record["process"] = process
                    if _matches(record, errors=errors, since=None, request=request):
                        if errors:
                            _print_errors([record], 1)
                        else:
                            _print_record(record)
            if idle:
                time.sleep(0.3)
    except KeyboardInterrupt:
        pass


def _show_local_logs(
    process: str | None, *, errors: bool, since: str | None, request: str | None, tail: int | None, follow: bool
) -> None:
    processes = [process] if process else list(PROCESSES)
    if follow:
        _follow(processes, errors=errors, request=request)
        return

    if not any((LOG_DIR / f"{name}.log").exists() for name in processes):
        console.print(
            f"No {' or '.join(processes)} log in server/.logs yet. The API and worker write there "
            "while they run in development, on a branch that has this feature. Restart them if they started before it.",
            soft_wrap=True,
        )
        raise typer.Exit(1)

    cutoff = _since(since)
    records = sorted(
        (
            record
            for name in processes
            for record in _read(name)
            if _matches(record, errors=errors, since=cutoff, request=request)
        ),
        key=_timestamp,
    )
    scope = f" since {since} ago" if since else ""
    if not records:
        what = "errors" if errors else "log records"
        console.print(f"No {what} in the {' and '.join(processes)} logs{scope}.")
        return
    if errors:
        _print_errors(records, tail or 5)
        return
    limit = tail or (None if request else 50)
    shown = records if limit is None else records[-limit:]
    if len(shown) < len(records):
        console.print(
            f"[dim]{len(records) - len(shown)} earlier records not shown. "
            f"Add --tail {len(records)} to see them all.[/dim]",
            soft_wrap=True,
        )
    for record in shown:
        _print_record(record)


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def logs(
        service: Annotated[
            str | None,
            typer.Argument(help="api or worker for the local server logs; db, redis, minio or tinybird for Docker"),
        ] = None,
        errors: Annotated[
            bool, typer.Option("--errors", help="Only errors, with tracebacks, repeats grouped")
        ] = False,
        since: Annotated[
            str | None, typer.Option("--since", help="Only records from the last 30s, 5min, 2h or 1d")
        ] = None,
        request: Annotated[
            str | None,
            typer.Option("--request", help="Everything the API and worker logged for one request (its correlation id)"),
        ] = None,
        follow: Annotated[
            bool | None,
            typer.Option("--follow/--no-follow", help="Keep printing new records (default: on for Docker, off for api and worker)"),
        ] = None,
        tail: Annotated[
            int | None, typer.Option("--tail", help="How many records or errors to show")
        ] = None,
    ) -> None:
        """View the local API and worker logs, or Docker container logs.

        dev logs --errors shows the latest API and worker errors with their tracebacks.
        """
        if service is not None and service not in PROCESSES and (errors or since or request):
            raise typer.BadParameter(
                f"--errors, --since and --request only work for {', '.join(PROCESSES)}, not the Docker service {service}",
                param_hint="SERVICE",
            )
        if service in PROCESSES or (service is None and (errors or since or request)):
            _show_local_logs(
                service, errors=errors, since=since, request=request, tail=tail, follow=bool(follow)
            )
            return

        cmd = ["docker", "compose", "logs"]
        if follow is not False:
            cmd.append("-f")
        cmd.extend(["--tail", str(tail or 100)])
        if service:
            cmd.append(service)

        console.print(f"[dim]Showing logs{' for ' + service if service else ''}...[/dim]\n")
        os.chdir(SERVER_DIR)
        os.execvp(cmd[0], cmd)
