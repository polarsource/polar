"""Run all lint, type, and test checks for the repo (server + web)."""

import time
from typing import Annotated

import typer
from rich.table import Table

from shared import CLIENTS_DIR, SERVER_DIR, console, run_command

# (label, command, cwd). Non-mutating checks only — `lint_check` /
# `format:check`, not the autofixing variants.
LINT_STEPS = [
    ("server lint", ["uv", "run", "task", "lint_check"], SERVER_DIR),
    ("server types", ["uv", "run", "task", "lint_types"], SERVER_DIR),
    ("web lint", ["pnpm", "lint"], CLIENTS_DIR),
    ("web types", ["pnpm", "typecheck"], CLIENTS_DIR),
]
TEST_STEPS = [
    ("server tests", ["uv", "run", "task", "test_fast"], SERVER_DIR),
    ("web tests", ["pnpm", "test"], CLIENTS_DIR),
]


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def check(
        quick: Annotated[
            bool,
            typer.Option("--quick", help="Lint + type-check only; skip the test suites."),
        ] = False,
        fail_fast: Annotated[
            bool,
            typer.Option("--fail-fast", help="Stop at the first failing check."),
        ] = False,
    ) -> None:
        """Run every lint, type-check, and test for server and web.

        Runs all checks and prints a summary; exits non-zero if any fail. Use
        --quick to skip the (slow) test suites, --fail-fast to stop on first fail.
        """
        steps = LINT_STEPS + ([] if quick else TEST_STEPS)

        if not quick and not prompt_setup():
            raise typer.Exit(1)

        results: list[tuple[str, bool, float]] = []
        for label, cmd, cwd in steps:
            console.print(f"\n[bold blue]▶ {label}[/bold blue]  [dim]{' '.join(cmd)}[/dim]")
            start = time.time()
            result = run_command(cmd, cwd=cwd)
            ok = bool(result) and result.returncode == 0
            results.append((label, ok, time.time() - start))
            if not ok and fail_fast:
                break

        summary = Table(show_header=True, box=None, padding=(0, 2))
        summary.add_column("Check", style="bold")
        summary.add_column("Result")
        summary.add_column("Time", style="dim", justify="right")
        for label, ok, elapsed in results:
            status = "[green]pass[/green]" if ok else "[red]fail[/red]"
            summary.add_row(label, status, f"{elapsed:.0f}s")

        console.print()
        console.print(summary)

        failed = [label for label, ok, _ in results if not ok]
        if failed:
            console.print(f"\n[red]✗ {len(failed)} check(s) failed:[/red] {', '.join(failed)}\n")
            raise typer.Exit(1)
        console.print("\n[green]✓ All checks passed[/green]\n")
