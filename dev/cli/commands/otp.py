"""Print a login code for the sign-in waiting in the browser."""

import time
from typing import Annotated

import typer

from shared import SERVER_DIR, console, print_output_tail, run_command


def _minutes(seconds: float) -> str:
    minutes = round(seconds / 60)
    if minutes < 1:
        return "less than a minute"
    return f"{minutes} minute{'' if minutes == 1 else 's'}"


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def otp(
        email: Annotated[
            str | None,
            typer.Argument(help="Only look at sign-ins for this email address"),
        ] = None,
    ) -> None:
        """Print a login code for the most recent email sign-in you started."""
        command = ["uv", "run", "python", "-m", "scripts.dev_login_code"]
        if email:
            command += ["--email", email]
        result = run_command(command, cwd=SERVER_DIR, capture=True)

        issued = dict(
            line.split("=", 1) for line in (result.stdout if result else "").splitlines() if "=" in line
        )
        if "CODE" not in issued:
            if result and result.returncode == 0:
                waiting = f" for [bold]{email}[/bold]" if email else ""
                console.print(f"[yellow]No sign-in is waiting for a code{waiting}.[/yellow]")
                console.print("  Enter your email on the login page first, then run [bold]dev otp[/bold] again")
            else:
                console.print("[red]✗[/red] Could not issue a login code")
                print_output_tail(result)
            raise typer.Exit(1)

        now = time.time()
        requested = _minutes(now - int(issued["CREATED_AT"]))
        expires = _minutes(int(issued["EXPIRES_AT"]) - now)
        console.print(f"\n  [bold green]{issued['CODE']}[/bold green]  [dim]{issued['EMAIL']}[/dim]")
        console.print(f"  [dim]Requested {requested} ago, expires in {expires}[/dim]\n")
