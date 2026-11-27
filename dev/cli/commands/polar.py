"""Run the Polar CLI from source in the current directory."""

import os
import subprocess

import typer

from shared import CLIENTS_DIR, ROOT_DIR, check_command_exists, console

CLI_ENTRY = CLIENTS_DIR / "packages" / "cli" / "src" / "cli.ts"
INSTALL = ROOT_DIR / "dev" / "cli" / "install"
ALIAS_MODES = {"--link": [], "--unlink": ["--repo-only"]}


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command(
        add_help_option=False,
        context_settings={"allow_extra_args": True, "ignore_unknown_options": True},
    )
    def polar(ctx: typer.Context) -> None:
        """Run the Polar CLI from source in the current directory.

        Examples:
          dev polar auth login --local
          dev polar config validate
          dev polar --link      Make `dev polar` work in any directory
          dev polar --unlink    Make `dev` work inside the Polar repo only
        """
        if len(ctx.args) == 1 and ctx.args[0] in ALIAS_MODES:
            raise typer.Exit(
                subprocess.run([str(INSTALL), *ALIAS_MODES[ctx.args[0]]]).returncode
            )
        if not check_command_exists("bun"):
            console.print("[red]bun not found. Install it from https://bun.sh[/red]")
            raise typer.Exit(1)
        cmd = ["bun", "--no-env-file", str(CLI_ENTRY), *ctx.args]
        os.execvpe(cmd[0], cmd, {**os.environ, "POLAR_PREVIEW": "1"})
