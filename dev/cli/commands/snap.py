"""Deterministic before/after visual regression capture.

`dev snap` gathers the inputs (feature branch, URL(s) — auto-detected from the
diff by walking the frontend import graph, or entered manually), writes a job
file, then owns the whole flow: start the dev stack, screenshot every URL on the
feature branch and again on the base branch with a headless Playwright runner
(`clients/apps/web/scripts/snap-capture.mjs`), and save raw before/after PNGs plus
a local pixel-diff verdict to result/. No model, no tokens.

It shows a live status + ETA progress bar and prints a deterministic summary when
done. `--interactive` shows the browser (headed) instead of running headless.
"""

import html
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Annotated

import typer
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
)
from rich.prompt import Confirm, Prompt
from rich.table import Column, Table
from rich.text import Text

from shared import (
    DEFAULT_API_PORT,
    ROOT_DIR,
    check_command_exists,
    console,
    is_port_in_use,
    run_command,
)

SCREENSHOTS_DIR = ROOT_DIR / "screenshots"
RUNS_DIR = SCREENSHOTS_DIR / "runs"
DEV_CLI = ROOT_DIR / "dev" / "cli" / "dev"
DEFAULT_BASE_BRANCH = "main"
DEFAULT_WEB_PORT = 3000  # both sides run here, sequentially
DEFAULT_LOGIN_EMAIL = "admin@polar.sh"
DEFAULT_AUTH_PATHS = ["/dashboard"]  # path prefixes that require login

# Viewports to capture at. Each selected one is shot per URL per side, with the
# name baked into the filename (`<slug>_<viewport>_<side>.png`).
VIEWPORTS = {
    "desktop": {"name": "desktop", "width": 1440, "height": 900},
    "mobile": {"name": "mobile", "width": 390, "height": 844},
}

# Auto-detect is deterministic: it walks the frontend import graph to find which
# App Router pages (transitively) import the changed files — no model, no upkeep.
# `[organization]` segments resolve to this dev org slug; routes behind other
# dynamic segments (ids we can't fabricate) are skipped.
DEFAULT_DEV_ORG = "admin-org"
WEB_DIR = ROOT_DIR / "clients" / "apps" / "web"
WEB_SRC_DIR = WEB_DIR / "src"
WEB_APP_DIR = WEB_SRC_DIR / "app"
PACKAGES_DIR = ROOT_DIR / "clients" / "packages"
# Deterministic Playwright capture runner.
SNAP_CAPTURE_JS = WEB_DIR / "scripts" / "snap-capture.mjs"
IMPORT_EXTS = (".tsx", ".ts", ".jsx", ".js")
# Matches the module specifier in `from '…'`, `import '…'`, `import('…')`,
# `require('…')`, and `export … from '…'`.
IMPORT_SPEC_RE = re.compile(r"""(?:from|import|require)\s*\(?\s*["']([^"']+)["']""")

# Rough run-duration model, refined from history. Defaults are first-run guesses:
# a fixed base (env + server boot, both branches) plus per-URL. ONE shared,
# committed file so everyone (incl. new hires) gets an estimate from day one. To
# stay merge-friendly it stores only tiny running SUMS (not a growing list of
# runs), split into auth/public buckets — a run just bumps five numbers, so
# conflicts are rare and resolve trivially (take either side, or sum the
# counters). The dirty-tree check ignores this file so a run's own write doesn't
# block the next run.
TIMINGS_FILE = ROOT_DIR / "dev" / "snap-timings.json"
DEFAULT_BASE_SECONDS = 150.0
DEFAULT_PER_URL_SECONDS = 30.0

# Local image-diff verdict thresholds. A pixel counts as "changed" only if its
# largest per-channel difference exceeds PIXEL_THRESHOLD (swallows anti-aliasing
# / sub-pixel rendering noise). A pair is "CHANGED" if at least CHANGED_PCT of
# pixels changed, or the two images differ in size.
DIFF_PIXEL_THRESHOLD = 30  # 0–255
DIFF_CHANGED_PCT = 0.1  # percent of pixels

def _current_branch() -> str | None:
    result = run_command(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT_DIR, capture=True
    )
    if result and result.returncode == 0:
        return result.stdout.strip() or None
    return None


def _dirty_files() -> list[str]:
    """Porcelain status lines (excluding our own timings file), or [] if clean."""
    result = run_command(
        ["git", "status", "--porcelain"], cwd=ROOT_DIR, capture=True
    )
    if result and result.returncode == 0 and result.stdout.strip():
        return [
            line
            for line in result.stdout.strip().split("\n")
            if line and "dev/snap-timings.json" not in line
        ]
    return []


def _wait_for_port(port: int, timeout: float) -> bool:
    """Poll until something is listening on the port, or give up after timeout."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if is_port_in_use(port):
            return True
        time.sleep(1.0)
    return False


def _start_background(cmd: list[str], log_path: Path) -> subprocess.Popen:
    """Start a server in its own process group, logging to log_path."""
    log = open(log_path, "w")
    return subprocess.Popen(
        cmd,
        cwd=str(ROOT_DIR),
        stdout=log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )


def _stop_background(proc: subprocess.Popen | None) -> None:
    """Kill a background server (and its child processes) if still running."""
    if proc is None or proc.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        try:
            proc.terminate()
        except ProcessLookupError:
            pass


def _url_slug(url: str) -> str:
    """Slug for a URL/path, used in screenshot filenames. Drops scheme/host/query."""
    path = re.sub(r"^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]+", "", url).split("?")[0]
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", path).strip("-").lower()
    return slug or "home"


def _is_authed(url: str, auth_paths: list[str]) -> bool:
    """True if the URL's path sits behind login (matches an authed prefix)."""
    path = re.sub(r"^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]+", "", url).split("?")[0] or "/"
    return any(path == p or path.startswith(p.rstrip("/") + "/") for p in auth_paths)


def _build_shots(urls: list[str]) -> list[dict]:
    """Turn URLs into shots with unique filename slugs."""
    shots: list[dict] = []
    seen: dict[str, int] = {}
    for url in urls:
        slug = _url_slug(url)
        if slug in seen:
            seen[slug] += 1
            slug = f"{slug}-{seen[slug]}"
        else:
            seen[slug] = 1
        shots.append({"url": url, "slug": slug})
    return shots


def _parse_urls(raw: str) -> list[str]:
    """Split a comma-separated URL string into a clean list."""
    return [u.strip() for u in raw.split(",") if u.strip()]


def _prompt_urls() -> list[str]:
    """Interactively collect URLs to capture, one at a time."""
    console.print("[bold]URLs to capture[/bold] [dim](path or full URL)[/dim]")
    urls: list[str] = []
    while True:
        url = Prompt.ask(f"  [cyan]{len(urls) + 1}[/cyan]  url").strip()
        if not url:
            console.print("     [yellow]Enter a URL.[/yellow]")
            continue
        urls.append(url)
        if not Confirm.ask("     [dim]add another?[/dim]", default=False):
            console.print()
            return urls


def _parse_viewports(raw: str) -> list[dict]:
    """Resolve a comma-separated viewport-name string to viewport dicts."""
    chosen = [v.strip().lower() for v in raw.split(",") if v.strip()]
    picked = [VIEWPORTS[v] for v in chosen if v in VIEWPORTS]
    return picked or [VIEWPORTS["desktop"]]


def _prompt_viewports() -> list[dict]:
    """Keyboard checkbox to pick viewports (desktop pre-checked). Falls back to
    desktop-only when there's no TTY or InquirerPy is missing."""
    if sys.stdin.isatty():
        try:
            from InquirerPy import inquirer
            from InquirerPy.base.control import Choice

            picked = inquirer.checkbox(
                message="Which viewports?",
                choices=[
                    Choice(
                        value=key,
                        name=f"{vp['name'].capitalize()}  ({vp['width']}×{vp['height']})",
                        enabled=(key == "desktop"),
                    )
                    for key, vp in VIEWPORTS.items()
                ],
                instruction="↑/↓ move · space toggle · enter confirm",
                transformer=lambda res: f"{len(res)} selected",
            ).execute()
            return [VIEWPORTS[k] for k in picked] or [VIEWPORTS["desktop"]]
        except Exception:
            pass
    return [VIEWPORTS["desktop"]]


def _ask_autodetect() -> bool:
    """Keyboard select: auto-detect URLs from the diff, or enter them manually.

    Falls back to a y/n prompt when there's no TTY or InquirerPy is missing.
    """
    if sys.stdin.isatty():
        try:
            from InquirerPy import inquirer
            from InquirerPy.base.control import Choice

            return inquirer.select(
                message="How should we pick the URLs to test?",
                choices=[
                    Choice(value=True, name="Automagic detection (based on the git diff)"),
                    Choice(value=False, name="Enter URLs manually"),
                ],
                default=True,
            ).execute()
        except Exception:
            pass
    return Confirm.ask(
        "Auto-detect URLs to test from the git diff?", default=False
    )


def _resolve_import(spec: str, from_file: Path) -> Path | None:
    """Resolve a JS/TS import specifier to a source file under web/src or a shared
    package's src. Handles relative, `@/…` (→ web/src), and `@polar-sh/<pkg>/…`
    (→ packages/<pkg>/src) — plus extension and `/index` resolution. Returns None
    for node_modules / asset / unresolved specifiers."""
    if spec.startswith("."):
        base = from_file.parent / spec
    elif spec.startswith("@/"):
        base = WEB_SRC_DIR / spec[2:]
    elif spec.startswith("@polar-sh/"):
        pkg, _, sub = spec[len("@polar-sh/") :].partition("/")
        base = PACKAGES_DIR / pkg / "src" / sub
    else:
        return None  # bare module (react, etc.) — not ours
    base_str = str(base)
    for ext in IMPORT_EXTS:
        cand = Path(base_str + ext)
        if cand.is_file():
            return cand
    if base.is_file():
        return base
    for ext in IMPORT_EXTS:
        cand = base / f"index{ext}"
        if cand.is_file():
            return cand
    return None


def _iter_frontend_sources():
    """All .ts/.tsx under web/src and every shared package's src."""
    roots = [WEB_SRC_DIR, *PACKAGES_DIR.glob("*/src")]
    for root in roots:
        if root.is_dir():
            yield from root.rglob("*.ts")
            yield from root.rglob("*.tsx")


def _build_reverse_imports() -> dict[Path, set[Path]]:
    """Map each source file to the set of files that import it (reverse graph)."""
    rev: dict[Path, set[Path]] = {}
    for f in _iter_frontend_sources():
        try:
            text = f.read_text(errors="ignore")
        except OSError:
            continue
        for spec in IMPORT_SPEC_RE.findall(text):
            target = _resolve_import(spec, f)
            if target is not None:
                rev.setdefault(target, set()).add(f)
    return rev


def _is_route_file(f: Path) -> bool:
    """A file is a route if it's an App Router `page.*` under web/src/app."""
    return WEB_APP_DIR in f.parents and f.name.startswith("page.")


def _route_url(page: Path) -> str | None:
    """Convert an App Router page file to a navigable URL, or None if it sits
    behind a dynamic segment we can't resolve (an id/slug we can't fabricate)."""
    try:
        rel = page.relative_to(WEB_APP_DIR)
    except ValueError:
        return None
    segs: list[str] = []
    for part in rel.parts[:-1]:  # drop the `page.*` filename
        if part.startswith("(") and part.endswith(")"):
            continue  # route group — not part of the URL
        if part.startswith("@"):
            continue  # parallel-route slot
        if part.startswith("[") and part.endswith("]"):
            name = part[1:-1].lstrip(".")  # strip catch-all dots
            if name in ("organization", "org"):
                segs.append(DEFAULT_DEV_ORG)
            else:
                return None  # id/slug — not deterministically navigable
        else:
            segs.append(part)
    return "/" + "/".join(segs)


def _changed_frontend_files(base: str, feature: str) -> list[Path]:
    """Committed .ts/.tsx changes (`base...feature`) under web/src or packages."""
    result = run_command(
        ["git", "diff", "--name-only", f"{base}...{feature}", "--",
         "clients/apps/web/src", "clients/packages"],
        cwd=ROOT_DIR,
        capture=True,
    )
    if not (result and result.returncode == 0):
        return []
    return [
        ROOT_DIR / line
        for line in result.stdout.split()
        if line.endswith((".ts", ".tsx"))
    ]


def _detect_urls(feature: str, base: str) -> list[dict]:
    """Map the diff to affected routes by walking the frontend import graph: which
    App Router pages (transitively) import each changed file.

    Deterministic — no model, no servers, ~instant. Returns [{path, reason}];
    routes behind unresolvable dynamic segments (ids) are skipped."""
    changed = _changed_frontend_files(base, feature)
    if not changed:
        return []
    rev = _build_reverse_imports()

    routes: dict[str, str] = {}  # url -> reason (first writer wins)
    for origin in changed:
        if _is_route_file(origin):
            url = _route_url(origin)
            if url:
                routes.setdefault(url, f"{origin.name} changed directly")
        # Walk upward to every page that (transitively) imports this file.
        seen: set[Path] = set()
        stack = [origin]
        while stack:
            cur = stack.pop()
            if cur in seen:
                continue
            seen.add(cur)
            if _is_route_file(cur):
                url = _route_url(cur)
                if url:
                    routes.setdefault(url, f"uses {origin.name}")
                continue  # pages are sinks — nothing imports them
            stack.extend(rev.get(cur, ()))

    # Dashboard/app routes first (most reviewer-relevant), then the rest; A–Z within.
    def _sort_key(item: tuple[str, str]) -> tuple[int, str]:
        url = item[0]
        return (0 if url.startswith("/dashboard") else 1, url)

    return [
        {"path": url, "reason": reason}
        for url, reason in sorted(routes.items(), key=_sort_key)
    ]


def _select_detected(detected: list[dict]) -> list[str]:
    """Keyboard checkbox multi-select of the detected URLs (all pre-checked).

    Falls back to plain y/n prompts when there's no TTY or InquirerPy is missing.
    """
    if sys.stdin.isatty():
        try:
            from InquirerPy import inquirer
            from InquirerPy.base.control import Choice

            choices = [
                Choice(
                    value=item["path"],
                    name=item["path"] + (f"  —  {item['reason']}" if item["reason"] else ""),
                    enabled=True,
                )
                for item in detected
            ]
            return inquirer.checkbox(
                message=f"Select URLs to test ({len(detected)} detected):",
                choices=choices,
                instruction="↑/↓ move · space toggle · a toggle all · enter confirm",
                keybindings={"toggle-all": [{"key": "a"}]},
                cycle=True,
                transformer=lambda res: f"{len(res)} selected",
            ).execute()
        except Exception:
            pass  # fall back to the plain prompts below

    console.print(f"\n[bold]Detected {len(detected)} candidate URL(s):[/bold]")
    for i, item in enumerate(detected, 1):
        reason = f"  [dim]— {item['reason']}[/dim]" if item["reason"] else ""
        console.print(f"  [cyan]{i}[/cyan]  {item['path']}{reason}")
    console.print()
    if Confirm.ask("Test all of them?", default=True):
        return [item["path"] for item in detected]
    return [
        item["path"]
        for item in detected
        if Confirm.ask(f"  test [cyan]{item['path']}[/cyan]?", default=True)
    ]


def _eta_progress() -> Progress:
    """Live status on the left, with a compact right-aligned ETA bar.

    The status column flexes to fill the width; the bar is a fixed, narrow size
    pinned to the right, so it doesn't jump around as the status text changes.
    """
    return Progress(
        SpinnerColumn(style="cyan"),
        TextColumn(
            "[bold]{task.fields[status]}",
            table_column=Column(ratio=1, no_wrap=True, overflow="ellipsis"),
        ),
        BarColumn(bar_width=24, complete_style="cyan", finished_style="green"),
        TextColumn("[dim]{task.percentage:>3.0f}%[/dim]"),
        console=console,
        transient=True,
        expand=True,
    )


def _tick_progress(progress: Progress, task, t0: float, total: float, stop) -> None:
    """Advance the bar by wall-clock vs the estimate (cap at 99% until done)."""
    while not stop.is_set():
        progress.update(task, completed=min(time.monotonic() - t0, total * 0.99))
        time.sleep(0.3)


def _dev_up(run_dir: Path, set_status, label: str, wipe_next: bool = False) -> None:
    """Rebuild for the branch currently checked out (on BOTH branches): run
    `dev up` to install deps, run migrations, and rebuild the workspace packages
    (`@polar-sh/ui` ships as prebuilt `dist/`, so a branch's UI changes only land
    once its packages are rebuilt). Since the web server is restarted fresh per
    branch, turbopack picks up the rebuilt `dist` on startup.

    With `wipe_next`, also delete `clients/apps/web/.next` first (Next's compiled
    cache) — a slower, belt-and-suspenders guarantee against a stale build, at the
    cost of a full cold compile of every route. Output appends to devup.log."""
    set_status(f"Building {label} (dev up)…")
    if wipe_next:
        shutil.rmtree(WEB_DIR / ".next", ignore_errors=True)
    with open(run_dir / "devup.log", "a") as devlog:
        devlog.write(f"\n===== dev up — {label} =====\n")
        devlog.flush()
        subprocess.run(
            [str(DEV_CLI), "up", "--skip-integrations"],
            cwd=str(ROOT_DIR),
            stdout=devlog,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
        )


def _start_api(run_dir: Path, set_status) -> tuple[subprocess.Popen | None, str | None]:
    """Start the API we own (so we can read the OTP from its log). Returns
    (proc, error)."""
    set_status("Starting API…")
    proc = _start_background([str(DEV_CLI), "api"], run_dir / "api.log")
    if not _wait_for_port(DEFAULT_API_PORT, 120):
        return proc, (
            "The API didn't come up. See "
            f"{(run_dir / 'api.log').relative_to(ROOT_DIR)}."
        )
    return proc, None


def _start_web(run_dir: Path, set_status) -> tuple[subprocess.Popen | None, str | None]:
    """Start a fresh web server (clean turbopack build against the wiped `.next` and
    the just-rebuilt packages). Returns (proc, error)."""
    set_status("Starting web…")
    proc = _start_background([str(DEV_CLI), "web"], run_dir / "web.log")
    if not _wait_for_port(DEFAULT_WEB_PORT, 120):
        return proc, (
            "The web server didn't come up. See "
            f"{(run_dir / 'web.log').relative_to(ROOT_DIR)}."
        )
    return proc, None


def _format_duration(seconds: float) -> str:
    minutes, secs = divmod(int(round(seconds)), 60)
    return f"{minutes}m {secs}s" if minutes else f"{secs}s"


def _empty_bucket() -> dict:
    return {"n": 0, "sum_x": 0.0, "sum_y": 0.0, "sum_xx": 0.0, "sum_xy": 0.0}


def _load_model() -> dict:
    """Load the shared timing model: per-bucket running sums (x=urls, y=seconds)."""
    try:
        data = json.loads(TIMINGS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        data = {}
    return {
        "public": {**_empty_bucket(), **data.get("public", {})},
        "auth": {**_empty_bucket(), **data.get("auth", {})},
    }


def _save_timing(num_urls: int, needs_login: bool, seconds: float) -> None:
    """Fold a successful run's duration into the shared model (bumps 5 numbers)."""
    model = _load_model()
    bucket = model["auth" if needs_login else "public"]
    x, y = float(num_urls), float(seconds)
    bucket["n"] += 1
    bucket["sum_x"] += x
    bucket["sum_y"] += y
    bucket["sum_xx"] += x * x
    bucket["sum_xy"] += x * y
    try:
        TIMINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        TIMINGS_FILE.write_text(json.dumps(model, indent=2) + "\n")
    except OSError:
        pass


def _estimate_seconds(num_urls: int, needs_login: bool) -> float:
    """Rough estimate: base overhead + per-URL, learned from the shared sums.

    Robust to sparse/noisy data: a couple of runs can yield a least-squares line
    with a negative intercept — we keep the (meaningful) per-URL slope and clamp the
    base to zero rather than throwing the fit away and extrapolating wildly."""
    bucket = _load_model()["auth" if needs_login else "public"]
    n = bucket["n"]
    if n:
        mean_x = bucket["sum_x"] / n
        mean_y = bucket["sum_y"] / n
        # Fit base + per_url * urls by least squares when URL counts have varied.
        denom = n * bucket["sum_xx"] - bucket["sum_x"] ** 2
        if n >= 2 and denom > 0:
            slope = (n * bucket["sum_xy"] - bucket["sum_x"] * bucket["sum_y"]) / denom
            if slope >= 0:
                base = (bucket["sum_y"] - slope * bucket["sum_x"]) / n
                return max(base, 0.0) + slope * num_urls
        # No spread in URL counts (or a noisy negative slope): scale the empirical
        # mean by the URL ratio — sane, and never negative.
        if mean_x > 0:
            return mean_y * num_urls / mean_x
    return DEFAULT_BASE_SECONDS + DEFAULT_PER_URL_SECONDS * num_urls


def _git_checkout(branch: str) -> bool:
    """Check out a branch; return True on success."""
    result = run_command(["git", "checkout", branch], cwd=ROOT_DIR, capture=True)
    return bool(result and result.returncode == 0)


def _wait_for_http(url: str, timeout: float) -> bool:
    """Poll until the URL returns any HTTP response (Next finished recompiling)."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = run_command(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "30", url],
            cwd=ROOT_DIR,
            capture=True,
        )
        if result and result.returncode == 0 and result.stdout.strip() not in ("", "000"):
            return True
        time.sleep(1.0)
    return False


def _run_capture(
    job_path: Path, side: str, progress: Progress, task, headed: bool, script_src: str
) -> int:
    """Run the Playwright capture for one side, teeing output to a log and
    surfacing `STATUS:` lines in the progress bar. Returns the exit code.

    The script is piped to node via stdin (not run by path) because the capture
    also happens on the BASE branch, where the script file doesn't exist — but its
    source, read once on the feature branch, lives on in memory. node resolves
    `@playwright/test` from cwd (the web app), so its node_modules is found."""
    log_path = job_path.parent / f"capture-{side}.log"
    cmd = ["node", "--input-type=module", "-", str(job_path), side]
    if headed:
        cmd.append("--headed")
    with open(log_path, "w") as logf:
        proc = subprocess.Popen(
            cmd,
            cwd=str(WEB_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        proc.stdin.write(script_src)  # ~6KB — fits the pipe buffer, no deadlock
        proc.stdin.close()
        for raw in proc.stdout or []:
            logf.write(raw)
            logf.flush()
            line = raw.strip()
            if line.startswith("STATUS:"):
                progress.update(task, status=line[len("STATUS:"):].strip()[:60])
        return proc.wait()


def _diff_pair(before: Path, after: Path, diff_out: Path) -> dict:
    """Deterministic local pixel diff of a before/after pair.

    Returns a verdict dict (changed?, % pixels changed, bounding box of the change,
    size delta) and, when changed, writes a `diff_out` heatmap (dimmed `after` with
    changed pixels painted red). No network, no model — pure pixel comparison."""
    import numpy as np
    from PIL import Image

    a = Image.open(before).convert("RGB")
    b = Image.open(after).convert("RGB")
    size_a, size_b = a.size, b.size  # (w, h)
    size_changed = size_a != size_b

    # Compare the overlapping top-left region; report the size delta separately.
    w = min(size_a[0], size_b[0])
    h = min(size_a[1], size_b[1])
    arr_a = np.asarray(a.crop((0, 0, w, h)), dtype=np.int16)
    arr_b = np.asarray(b.crop((0, 0, w, h)), dtype=np.int16)

    # Per-pixel largest channel difference, thresholded to ignore AA noise.
    delta = np.abs(arr_a - arr_b).max(axis=2)
    changed = delta > DIFF_PIXEL_THRESHOLD
    n_changed = int(changed.sum())
    pct = (n_changed / changed.size * 100.0) if changed.size else 0.0

    bbox = None
    if n_changed:
        ys, xs = np.where(changed)
        bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))

    is_changed = bool(size_changed or pct >= DIFF_CHANGED_PCT)

    diff_path = None
    if is_changed and n_changed:
        gray = np.asarray(b.crop((0, 0, w, h)).convert("L"), dtype=np.float32)
        canvas = np.repeat((gray * 0.35)[:, :, None], 3, axis=2).astype(np.uint8)
        canvas[changed] = (255, 0, 0)
        Image.fromarray(canvas, "RGB").save(diff_out)
        diff_path = diff_out

    return {
        "changed": is_changed,
        "pct": pct,
        "bbox": bbox,
        "size_before": size_a,
        "size_after": size_b,
        "size_changed": size_changed,
        "diff_path": diff_path,
    }


def _compute_verdicts(result_dir: Path) -> list[dict]:
    """Diff every `<slug>_before.png` / `<slug>_after.png` pair in `result_dir`.

    Returns one verdict dict per pair (with `slug`). A single sentinel
    `[{"unavailable": True}]` means the imaging deps couldn't be loaded."""
    pairs = sorted(result_dir.glob("*_before.png"))
    if not pairs:
        return []
    verdicts: list[dict] = []
    for before in pairs:
        slug = before.name[: -len("_before.png")]
        after = result_dir / f"{slug}_after.png"
        if not after.exists():
            continue
        try:
            v = _diff_pair(before, after, result_dir / f"{slug}_diff.png")
        except ImportError:
            return [{"unavailable": True}]
        except Exception as exc:  # noqa: BLE001 — surface, don't crash the run
            v = {"error": str(exc)}
        v["slug"] = slug
        verdicts.append(v)
    return verdicts


def _verdict_lines(verdicts: list[dict]) -> list[str]:
    """Render verdicts as Rich markup lines for the result panel."""
    if not verdicts:
        return []
    if verdicts[0].get("unavailable"):
        return [
            "",
            "[dim]Verdicts skipped — pillow/numpy unavailable.[/dim]",
        ]
    lines = ["", "[bold]Verdicts[/bold]"]
    for v in verdicts:
        slug = v.get("slug", "?")
        if v.get("error"):
            lines.append(f"  [yellow]?[/yellow] {slug} — [dim]diff failed: {v['error']}[/dim]")
            continue
        if not v["changed"]:
            lines.append(
                f"  [green]○[/green] {slug} — [green]unchanged[/green] "
                f"[dim]({v['pct']:.2f}%)[/dim]"
            )
            continue
        bits = [f"{v['pct']:.1f}% of pixels"]
        if v["size_changed"]:
            (wb, hb), (wa, ha) = v["size_before"], v["size_after"]
            bits.append(f"size {wb}×{hb}→{wa}×{ha}")
        if v["bbox"]:
            x0, y0, x1, y1 = v["bbox"]
            bits.append(f"region ({x0},{y0})–({x1},{y1})")
        lines.append(
            f"  [yellow]●[/yellow] {slug} — [yellow]CHANGED[/yellow]  ·  "
            + "  ·  ".join(bits)
        )
        if v.get("diff_path"):
            path = v["diff_path"]
            try:
                path = path.relative_to(ROOT_DIR)
            except ValueError:
                pass
            lines.append(f"      [dim]heatmap → {path}[/dim]")
    return lines


_REPORT_CSS = """
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:#0b0d12;color:#e6e8ee}
header.top{position:sticky;top:0;z-index:5;background:#0b0d12e6;backdrop-filter:blur(6px);padding:14px 24px;border-bottom:1px solid #222634;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
header.top h1{font-size:16px;margin:0;font-weight:700}
.meta{color:#9aa3b2;font-size:13px}
.spacer{flex:1}
.filter{color:#cdd3df;font-size:13px;user-select:none;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
main{padding:24px;display:flex;flex-direction:column;gap:28px;max-width:1200px;margin:0 auto}
.card{background:#11151d;border:1px solid #222634;border-radius:14px;overflow:hidden}
.card .head{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #222634;flex-wrap:wrap}
.head h2{font-size:14px;margin:0;font-weight:600;word-break:break-all}
.vp{color:#9aa3b2;font-size:12px;border:1px solid #2a3040;border-radius:999px;padding:1px 8px}
.badge{font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px;white-space:nowrap}
.badge.changed{background:#3a1d24;color:#ff86a4}
.badge.same{background:#16241b;color:#7ee3a6}
.note{color:#9aa3b2;font-size:12px}
body.changed-only .card[data-changed="0"]{display:none}
.cmp{position:relative;line-height:0;--x:50%;background:#fff;width:fit-content;max-width:100%}
.cmp .base{display:block;max-width:100%;height:auto}
.cmp .over{position:absolute;top:0;left:0;width:100%;height:auto;clip-path:inset(0 calc(100% - var(--x)) 0 0)}
.cmp .divider{position:absolute;top:0;bottom:0;left:var(--x);width:2px;margin-left:-1px;background:#4f7cff;box-shadow:0 0 0 1px #0006;pointer-events:none}
.cmp input.slider{position:absolute;top:8px;left:8px;right:8px;width:calc(100% - 16px);z-index:2;cursor:ew-resize}
.controls{display:flex;gap:16px;align-items:center;padding:10px 16px;border-top:1px solid #222634;color:#cdd3df;font-size:13px}
.controls label{cursor:pointer;display:inline-flex;gap:5px;align-items:center}
.legend{color:#9aa3b2;font-size:12px;margin-left:auto}
"""

_REPORT_JS = """
document.querySelectorAll('.cmp').forEach(function(c){
  var s=c.querySelector('.slider');
  s.addEventListener('input',function(){c.style.setProperty('--x',s.value+'%')});
});
function setOver(radio,mode){
  var o=radio.closest('.card').querySelector('.over');
  if(o.dataset[mode]) o.src=o.dataset[mode];
}
var f=document.getElementById('filter');
if(f) f.addEventListener('change',function(){document.body.classList.toggle('changed-only',f.checked)});
"""


def _write_report(run_dir: Path, verdicts: list[dict]) -> Path | None:
    """Write a self-contained `report.html` to run_dir: one card per before/after
    pair with a drag-to-compare slider (and a Diff-heatmap toggle for changed
    ones), changed-first. Opens with file:// — no server, no deps. Returns its
    path, or None if there's nothing to show."""
    if not verdicts or verdicts[0].get("unavailable"):
        return None
    usable = [v for v in verdicts if v.get("slug") and not v.get("error")]
    if not usable:
        return None

    try:
        job = json.loads((run_dir / "job.json").read_text())
    except (OSError, json.JSONDecodeError):
        job = {}
    slug_to_url = {s["slug"]: s["url"] for s in job.get("shots", [])}
    vp_names = [vp["name"] for vp in job.get("viewports", [])]

    def _split(slug: str) -> tuple[str, str]:
        for vp in vp_names:
            if slug.endswith(f"_{vp}"):
                return slug[: -len(vp) - 1], vp
        return slug, ""

    usable.sort(key=lambda v: (0 if v["changed"] else 1, v["slug"]))
    changed_n = sum(1 for v in usable if v["changed"])

    cards = []
    for i, v in enumerate(usable):
        slug = v["slug"]
        url_slug, vp = _split(slug)
        url = html.escape(slug_to_url.get(url_slug, url_slug))
        before, after = f"result/{slug}_before.png", f"result/{slug}_after.png"
        diff = f"result/{slug}_diff.png" if v.get("diff_path") else ""
        badge = (
            f'<span class="badge changed">CHANGED · {v["pct"]:.1f}%</span>'
            if v["changed"]
            else '<span class="badge same">unchanged</span>'
        )
        vp_chip = f'<span class="vp">{html.escape(vp)}</span>' if vp else ""
        note = ""
        if v.get("size_changed"):
            (wb, hb), (wa, ha) = v["size_before"], v["size_after"]
            note = f'<span class="note">size {wb}×{hb}→{wa}×{ha}</span>'
        diff_radio = (
            f'<label><input type="radio" name="m{i}" '
            f"onchange=\"setOver(this,'diff')\"> Diff</label>"
            if diff
            else ""
        )
        cards.append(
            f'<section class="card" data-changed="{1 if v["changed"] else 0}">'
            f'<div class="head">{badge}<h2>{url}</h2>{vp_chip}{note}</div>'
            f'<div class="cmp" style="--x:50%">'
            f'<img class="base" src="{before}" alt="before" loading="lazy">'
            f'<img class="over" src="{after}" data-after="{after}" '
            f'data-diff="{diff}" alt="after" loading="lazy">'
            f'<div class="divider"></div>'
            f'<input class="slider" type="range" min="0" max="100" value="50" '
            f'aria-label="reveal after">'
            f'</div>'
            f'<div class="controls">'
            f'<label><input type="radio" name="m{i}" checked '
            f"onchange=\"setOver(this,'after')\"> After</label>{diff_radio}"
            f'<span class="legend">◀ before · after ▶ — drag to compare</span>'
            f'</div></section>'
        )

    feature = html.escape(str(job.get("feature_branch", "")))
    base = html.escape(str(job.get("base_branch", "")))
    created = html.escape(str(job.get("created_at", "")))
    filter_html = (
        '<label class="filter"><input type="checkbox" id="filter"> changed only</label>'
        if changed_n
        else ""
    )
    doc = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>snap · {feature} vs {base}</title>"
        f"<style>{_REPORT_CSS}</style></head><body>"
        '<header class="top"><h1>Visual regression</h1>'
        f'<span class="meta">{feature} <span style="color:#4f7cff">→</span> '
        f"{base} · {created}</span>"
        '<span class="spacer"></span>'
        f'<span class="meta">{changed_n} changed / {len(usable)} total</span>'
        f"{filter_html}</header>"
        f"<main>{''.join(cards)}</main>"
        f"<script>{_REPORT_JS}</script></body></html>"
    )
    out = run_dir / "report.html"
    out.write_text(doc)
    return out


def _finalize(
    run_dir: Path,
    returncode: int,
    log_path: Path | None,
    expected: int,
    elapsed: float | None = None,
) -> bool:
    """Print a deterministic pass/fail summary and return whether the run passed.

    A run passes only if capture exited cleanly and produced exactly the expected
    number of screenshots.
    """
    rel = run_dir.relative_to(ROOT_DIR)
    result_dir = run_dir / "result"
    # Count only the captures (before/after) — not the `_diff.png` heatmaps we
    # write below — so the expected-screenshot check stays accurate.
    produced = (
        len([p for p in result_dir.glob("*.png") if not p.name.endswith("_diff.png")])
        if result_dir.exists()
        else 0
    )

    problems: list[str] = []
    if returncode != 0:
        problems.append(f"capture exited with code {returncode}")
    if produced != expected:
        problems.append(f"expected {expected} screenshot(s), but got {produced}")

    ok = not problems
    lines: list[str] = []
    if ok:
        took = f" in {_format_duration(elapsed)}" if elapsed is not None else ""
        lines.append(
            f"[green]✓[/green] {produced} screenshot(s){took} → "
            f"[bold]{rel}/result/[/bold]"
        )
    else:
        lines.append("[red]✗ Regression run failed:[/red]")
        for problem in problems:
            lines.append(f"  [red]•[/red] {problem}")
        if log_path and log_path.exists():
            lines.append("")
            lines.append(
                f"[dim]See {log_path.relative_to(ROOT_DIR)} for what happened.[/dim]"
            )

    # Deterministic local diff verdict per before/after pair (no model involved),
    # plus a self-contained HTML report (drag-to-compare slider per pair).
    if result_dir.exists() and produced:
        verdicts = _compute_verdicts(result_dir)
        lines.extend(_verdict_lines(verdicts))
        report = _write_report(run_dir, verdicts)
        if report:
            lines.append("")
            lines.append(f"[dim]report → [/dim][bold]{report.relative_to(ROOT_DIR)}[/bold]")

    console.print()
    console.print(
        Panel(
            "\n".join(lines),
            title=_gradient_title("Regression result"),
            border_style="blue" if ok else "red",
            padding=(1, 2),
        )
    )
    console.print()
    return ok


def _maybe_open_result(run_dir: Path) -> None:
    """Ask whether to open the side-by-side diff report, the screenshots folder, or
    neither."""
    if not sys.stdin.isatty():
        return
    result_dir = run_dir / "result"
    report = run_dir / "report.html"
    has_report = report.exists()
    has_pngs = result_dir.exists() and any(result_dir.glob("*.png"))
    if not (has_report or has_pngs):
        return
    opener = (
        "open"
        if sys.platform == "darwin"
        else "xdg-open"
        if sys.platform.startswith("linux")
        else None
    )
    if opener is None:
        return
    folder_label = "Finder" if sys.platform == "darwin" else "file browser"

    choices: list[tuple[str, str]] = []
    if has_report:
        choices.append(("report", "Open the side-by-side diff report"))
    if has_pngs:
        choices.append(("folder", f"Open the screenshots in {folder_label}"))
    choices.append(("exit", "Exit"))

    try:
        from InquirerPy import inquirer
        from InquirerPy.base.control import Choice
    except Exception:
        # No InquirerPy — one-shot confirm on the best target, then done.
        label = "diff report" if has_report else folder_label
        if Confirm.ask(f"[dim]Open the {label}?[/dim]", default=True):
            subprocess.run([opener, str(report if has_report else result_dir)])
        return

    # Loop so you can open the report, come back, and open the folder too.
    while True:
        choice = inquirer.select(
            message="All done. What now?",
            choices=[Choice(value=v, name=n) for v, n in choices],
            default=choices[0][0],
        ).execute()
        if choice == "report":
            subprocess.run([opener, str(report)])
        elif choice == "folder":
            subprocess.run([opener, str(result_dir)])
        else:  # exit
            return


# Shared cyan→blue gradient used for the "Snap" title and every panel title.
GRADIENT_START = (0x22, 0xD3, 0xEE)  # cyan
GRADIENT_END = (0x4F, 0x7C, 0xFF)  # blue


def _gradient(word: str, start: tuple[int, int, int], end: tuple[int, int, int]) -> Text:
    """Bold `word` with a per-letter color gradient from start→end (RGB)."""
    text = Text()
    last = max(len(word) - 1, 1)
    for i, char in enumerate(word):
        f = i / last
        r, g, b = (round(s + (e - s) * f) for s, e in zip(start, end))
        text.append(char, style=f"bold #{r:02x}{g:02x}{b:02x}")
    return text


def _gradient_title(text: str) -> Text:
    """A panel title in the shared cyan→blue gradient."""
    return _gradient(text, GRADIENT_START, GRADIENT_END)


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def snap(
        branch: Annotated[
            str | None,
            typer.Option("--branch", "-b", help="Feature branch (defaults to current)"),
        ] = None,
        url: Annotated[
            str | None,
            typer.Option("--url", "-u", help="URL(s) to capture — one, or comma-separated"),
        ] = None,
        base: Annotated[
            str, typer.Option("--base", help="Branch to compare against")
        ] = DEFAULT_BASE_BRANCH,
        detect: Annotated[
            bool | None,
            typer.Option(
                "--detect/--no-detect",
                help="Auto-detect URLs to test from the git diff (prompts if unset)",
            ),
        ] = None,
        email: Annotated[
            str,
            typer.Option(
                "--email", help="Dashboard login email (OTP code is read from API logs)"
            ),
        ] = DEFAULT_LOGIN_EMAIL,
        auth_path: Annotated[
            list[str] | None,
            typer.Option(
                "--auth-path",
                help="Path prefix(es) that require login (default: /dashboard)",
            ),
        ] = None,
        launch: Annotated[
            bool,
            typer.Option("--launch/--no-launch", help="Run the capture (vs just print the command)"),
        ] = True,
        interactive: Annotated[
            bool,
            typer.Option(
                "--interactive",
                help="Show the browser (headed) instead of running headless",
            ),
        ] = False,
        allow_dirty: Annotated[
            bool,
            typer.Option("--allow-dirty", help="Skip the clean-working-tree check"),
        ] = False,
        viewport: Annotated[
            str | None,
            typer.Option(
                "--viewport",
                help="Viewport(s) to capture, comma-separated: desktop,mobile "
                "(default: prompt, or desktop)",
            ),
        ] = None,
        wipe_next: Annotated[
            bool,
            typer.Option(
                "--wipe-next",
                help="Wipe .next on each branch (slower; forces a cold rebuild if "
                "you suspect a stale build)",
            ),
        ] = False,
    ) -> None:
        """
        Capture a before/after visual regression run with Playwright.

        Prompts for the feature branch and the URL(s) to capture, then starts the
        stack, screenshots each URL on the feature branch and on the base branch,
        and saves raw before/after PNGs (+ a local diff verdict) to result/.
        """
        console.print()
        title = _gradient("Snap", GRADIENT_START, GRADIENT_END)
        title.append("\nPolar's visual regression tool", style="dim")
        title.justify = "center"
        console.print(Panel(title, border_style="blue", padding=(1, 4)))
        console.print()

        # Require a clean working tree: the run checks out the base branch, and we
        # compare committed branches so before/after is unambiguous.
        if not allow_dirty:
            dirty = _dirty_files()
            if dirty:
                console.print(
                    "[red]Your working tree has uncommitted changes.[/red] "
                    "Commit them first — `dev snap` checks out the base "
                    "branch and compares committed code.\n"
                )
                for line in dirty[:10]:
                    console.print(f"  [dim]{line}[/dim]")
                if len(dirty) > 10:
                    console.print(f"  [dim]… and {len(dirty) - 10} more[/dim]")
                console.print(
                    "\n[dim]Commit your work, then re-run. "
                    "(Use --allow-dirty to override.)[/dim]"
                )
                raise typer.Exit(1)

        # 1. Feature branch (default to current, unless we're on the base branch)
        current = _current_branch()
        default_branch = None if current in (None, base, "master") else current
        if branch:
            feature_branch = branch
        else:
            feature_branch = Prompt.ask(
                "[bold]Feature branch[/bold]", default=default_branch or None
            )
        feature_branch = (feature_branch or "").strip()
        if not feature_branch:
            console.print("[red]A feature branch is required.[/red]")
            raise typer.Exit(1)
        if feature_branch == base:
            console.print(
                f"[red]The feature branch can't be the base branch ('{base}').[/red]"
            )
            raise typer.Exit(1)

        # 2. URL(s). Explicit --url wins; otherwise auto-detect from the diff
        # (opt-in) or collect them manually.
        if url:
            url_list = _parse_urls(url)
            if not url_list:
                console.print("[red]No valid URL provided.[/red]")
                raise typer.Exit(1)
        else:
            url_list = None
            want_detect = detect if detect is not None else _ask_autodetect()
            if want_detect:
                detected = _detect_urls(feature_branch, base)
                if detected:
                    chosen = _select_detected(detected)
                    if chosen:
                        url_list = chosen
                else:
                    console.print(
                        "[yellow]Couldn't detect any URLs from the diff — "
                        "enter them manually.[/yellow]"
                    )
            if url_list is None:
                url_list = _prompt_urls()

        shots = _build_shots(url_list)
        urls = [shot["url"] for shot in shots]

        # 3. Viewports. Explicit --viewport wins; otherwise the wizard asks (unless
        # scripted via --url, where we default to desktop).
        if viewport:
            viewports = _parse_viewports(viewport)
        elif url:
            viewports = [VIEWPORTS["desktop"]]
        else:
            viewports = _prompt_viewports()

        # Login (and owning the API to read its OTP) is only needed when at least
        # one URL is behind auth. Public pages (checkout, marketing, storefront)
        # skip login entirely.
        auth_prefixes = auth_path or DEFAULT_AUTH_PATHS
        needs_login = any(_is_authed(u, auth_prefixes) for u in urls)

        # snap owns the whole dev stack for the run: on each branch it wipes Next's
        # build cache and rebuilds packages, then (re)starts the web server clean —
        # so it can't share ports with your own dev servers (and it reads the OTP
        # from its own API log). Require both ports free.
        busy = [p for p in (DEFAULT_API_PORT, DEFAULT_WEB_PORT) if is_port_in_use(p)]
        if busy:
            busy_ports = ", ".join(f":{p}" for p in busy)
            body = Text.from_markup(
                f"[bold red]{busy_ports} already in use.[/bold red]\n\n"
                "`dev snap` runs the whole dev stack itself. It rebuilds "
                "packages and restarts the web server on each branch, and reads the "
                f"login OTP from its own API log. So it needs :{DEFAULT_API_PORT} "
                f"and :{DEFAULT_WEB_PORT} to itself."
            )
            console.print()
            console.print(
                Panel(
                    body,
                    title="[bold red]Ports in use[/bold red]",
                    border_style="red",
                    padding=(1, 2),
                )
            )
            console.print()
            raise typer.Exit(1)

        # Write the job file
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        run_dir = RUNS_DIR / timestamp
        (run_dir / "result").mkdir(parents=True, exist_ok=True)

        job = {
            "feature_branch": feature_branch,
            "base_branch": base,
            "urls": urls,
            "shots": shots,  # each: {url, slug}
            "needs_login": needs_login,
            "port": DEFAULT_WEB_PORT,
            "login_email": email,
            "viewports": viewports,
            "host": "127.0.0.1",
            "run_dir": str(run_dir.relative_to(ROOT_DIR)),
            "created_at": timestamp,
        }
        job_path = run_dir / "job.json"
        job_path.write_text(json.dumps(job, indent=2) + "\n")
        rel_job = job_path.relative_to(ROOT_DIR)
        # Each URL is shot once per viewport per side.
        captures = len(urls) * len(viewports)
        estimate_seconds = _estimate_seconds(captures, needs_login)

        # Summary of what we're about to do
        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column(style="bold cyan", min_width=14)
        table.add_column()
        table.add_row("Feature", feature_branch)
        table.add_row("Base", base)
        table.add_row("URLs", "\n".join(shot["url"] for shot in shots))
        table.add_row(
            "Login", email if needs_login else "[dim]not needed (public URLs)[/dim]"
        )
        table.add_row("Viewports", ", ".join(vp["name"] for vp in viewports))
        table.add_row("Browser", "headed (visible)" if interactive else "headless")
        table.add_row("Output", f"{run_dir.relative_to(ROOT_DIR)}/result/")
        table.add_row("Est. time", f"~{_format_duration(estimate_seconds)}")
        console.print(
            Panel(
                table,
                title=_gradient_title("Visual regression job"),
                border_style="blue",
                padding=(1, 1),
            )
        )
        console.print()

        # Capture is deterministic Playwright (no model). Requires node + the script.
        if not check_command_exists("node"):
            console.print(
                "[red]`node` is required for the capture step but isn't on PATH.[/red]"
            )
            raise typer.Exit(1)
        if not SNAP_CAPTURE_JS.exists():
            console.print(
                f"[red]Capture script missing:[/red] "
                f"{SNAP_CAPTURE_JS.relative_to(ROOT_DIR)}"
            )
            raise typer.Exit(1)
        # Read the capture script NOW (we're on the feature branch) and keep it in
        # memory — it's piped to node so it still runs after we check out base,
        # where the file itself doesn't exist.
        capture_src = SNAP_CAPTURE_JS.read_text()

        if not launch:
            console.print("[dim]--no-launch: job written; capture not started.[/dim]\n")
            console.print(
                f"  node {SNAP_CAPTURE_JS.relative_to(ROOT_DIR)} {rel_job} after\n"
            )
            return

        # We own the whole flow. Per branch: wipe .next + `dev up` (rebuild
        # packages), then (re)start web CLEAN against that build — a running server
        # can't be rebuilt under, so each side gets a fresh web. The API stays up
        # across the checkout (backend is unchanged for a frontend PR). Always
        # restore the feature branch and stop our servers at the end.
        expected = captures * 2  # before + after, per URL per viewport
        started = time.monotonic()
        total = max(estimate_seconds, 1.0)
        headed = interactive
        managed: list = []
        web_proc: subprocess.Popen | None = None
        capture_error: str | None = None
        returncode = 1
        stop = threading.Event()
        web_url = f"http://127.0.0.1:{DEFAULT_WEB_PORT}/"

        with _eta_progress() as progress:
            task = progress.add_task("", total=total, status="Starting…")
            ticker = threading.Thread(
                target=_tick_progress,
                args=(progress, task, started, total, stop),
                daemon=True,
            )
            ticker.start()
            set_status = lambda s: progress.update(task, status=s)  # noqa: E731

            def _stop_web() -> None:
                """Stop the web server and WAIT for it to fully exit (port freed) —
                turbopack workers must release `.next` before the next `_dev_up`
                wipes it, or the fresh build hits a stale compaction lock."""
                nonlocal web_proc
                proc = web_proc
                if proc is None:
                    return
                if proc in managed:
                    managed.remove(proc)
                web_proc = None
                _stop_background(proc)  # SIGTERM the process group
                deadline = time.monotonic() + 15
                while time.monotonic() < deadline and is_port_in_use(DEFAULT_WEB_PORT):
                    time.sleep(0.5)
                if is_port_in_use(DEFAULT_WEB_PORT):  # didn't go down — force it
                    try:
                        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    except (ProcessLookupError, PermissionError):
                        pass
                    time.sleep(1)

            def _start_web_warm() -> None:
                """Start a fresh web server and warm the first (cold) compile."""
                nonlocal web_proc, capture_error
                web_proc, capture_error = _start_web(run_dir, set_status)
                if web_proc is not None:
                    managed.append(web_proc)
                if capture_error is None:
                    set_status("Waiting for first build…")
                    _wait_for_http(web_url, 180)

            try:
                # AFTER — feature branch we're already on. Preflight guaranteed both
                # ports free, so nothing is running and the .next wipe is safe. The
                # API comes up once (after `dev up`'s migrations) and stays up across
                # the checkout — backend is unchanged for a frontend PR.
                _dev_up(run_dir, set_status, feature_branch, wipe_next)
                api_proc, capture_error = _start_api(run_dir, set_status)
                if api_proc is not None:
                    managed.append(api_proc)
                if capture_error is None:
                    _start_web_warm()
                if capture_error is None:
                    rc_after = _run_capture(
                        job_path, "after", progress, task, headed, capture_src
                    )
                    if rc_after != 0:
                        returncode = rc_after
                    else:
                        # BEFORE — base branch: stop web BEFORE the wipe, rebuild,
                        # restart web, capture.
                        set_status(f"Switching to {base}…")
                        if not _git_checkout(base):
                            capture_error = f"Couldn't check out '{base}'."
                        else:
                            _stop_web()
                            _dev_up(run_dir, set_status, base, wipe_next)
                            _start_web_warm()
                            if capture_error is None:
                                returncode = _run_capture(
                                    job_path, "before", progress, task, headed, capture_src
                                )
            finally:
                # Stop ALL servers FIRST (so the restore wipe can't corrupt a live
                # one), then restore the feature branch and rebuild it (don't leave
                # the checkout with the base branch's built packages).
                _stop_web()
                for proc in managed:
                    _stop_background(proc)
                managed.clear()
                if _git_checkout(feature_branch):
                    _dev_up(run_dir, set_status, feature_branch, wipe_next)
                stop.set()
                progress.update(task, completed=total, status="Done")

        if capture_error is not None:
            console.print(f"[red]{capture_error}[/red]")
            raise typer.Exit(1)

        elapsed = time.monotonic() - started
        fail_log = run_dir / (
            "capture-before.log"
            if (run_dir / "capture-before.log").exists()
            else "capture-after.log"
        )
        ok = _finalize(run_dir, returncode, fail_log, expected, elapsed)
        if not ok:
            raise typer.Exit(1)

        # Record the duration so future estimates improve.
        _save_timing(captures, needs_login, elapsed)
        _maybe_open_result(run_dir)
