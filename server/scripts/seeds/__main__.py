"""CLI entry point for the modular seed system.

    python -m scripts.seeds scenarios                  # JSON of named scenarios
    python -m scripts.seeds describe                    # JSON of components/variants
    python -m scripts.seeds build --scenario billing    # seed a named scenario
    python -m scripts.seeds build --spec '{...}'        # seed an explicit spec
    python -m scripts.seeds demo                         # the full multi-org demo

The heavy runner (which imports polar) is imported lazily inside each command, so
`scenarios` stays instant.
"""

from __future__ import annotations

import asyncio
import json

import typer

from scripts.seeds.base import SeedError

cli = typer.Typer()


@cli.command()
def scenarios() -> None:
    from scripts.seeds.presets.scenarios import list_scenarios

    typer.echo(json.dumps(list_scenarios()))


@cli.command()
def describe() -> None:
    from scripts.seeds.runner import describe as describe_components

    typer.echo(json.dumps(describe_components()))


@cli.command()
def build(
    spec: str | None = typer.Option(None, "--spec", help="JSON spec to seed"),
    scenario: str | None = typer.Option(None, "--scenario", help="Named scenario"),
    slug: str = typer.Option("acme-test", "--slug"),
    owner: str = typer.Option("admin@polar.sh", "--owner"),
) -> None:
    from scripts.seeds.runner import build as run_build
    from scripts.seeds.runner import build_scenario as run_scenario

    try:
        if scenario:
            result = asyncio.run(run_scenario(scenario, slug, owner))
        elif spec:
            result = asyncio.run(run_build(json.loads(spec)))
        else:
            raise SeedError("provide --scenario or --spec")
    except SeedError as error:
        typer.echo(str(error), err=True)
        raise typer.Exit(1)
    typer.echo(json.dumps(result))


@cli.command()
def demo(
    skip_tinybird: bool = typer.Option(False, "--skip-tinybird"),
    polar_self: bool = typer.Option(True, "--polar-self/--no-polar-self"),
) -> None:
    from scripts.seeds.presets import DEMO_ORGS
    from scripts.seeds.runner import build_demo as run_demo

    try:
        result = asyncio.run(
            run_demo(
                DEMO_ORGS, skip_tinybird=skip_tinybird, include_polar_self=polar_self
            )
        )
    except SeedError as error:
        typer.echo(str(error), err=True)
        raise typer.Exit(1)
    typer.echo(json.dumps(result))


if __name__ == "__main__":
    cli()
