"""Normalize the free-text billing address state of BR and IN customers.

Each state becomes its bare ISO 3166-2 code (`SP`, `MH`), or is removed when it can't
be resolved. Dry-run by default: it writes every planned change to a CSV, which is also
the only record of the original values once `--execute` has run.
"""

import asyncio
import csv
import re
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast
from uuid import UUID

import pycountry
import typer
from sqlalchemy import ColumnElement, Text, Update, func, select, update
from sqlalchemy import cast as sql_cast

from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Customer
from polar.postgres import create_async_engine
from scripts.helper import configure_script_logging, read_engine, typer_async

cli = typer.Typer()

configure_script_logging()

COUNTRIES = ("BR", "IN")

# ISO 3166-2:IN codes replaced in 2023
LEGACY_CODES: dict[str, dict[str, str]] = {
    "BR": {},
    "IN": {"ct": "CG", "or": "OD", "tg": "TS", "ut": "UK"},
}

# Misspellings, state names with extra text, and cities that imply a state.
# Keys are normalized with `normalize`.
ALIASES: dict[str, dict[str, str]] = {
    "BR": {
        "aparecida de goiania": "GO",
        "bahia valente": "BA",
        "belem do para": "PA",
        "belo horizonte": "MG",
        "blumenau sc": "SC",
        "boa vista": "RR",
        "brasilia": "DF",
        "brasilia df": "DF",
        "cotia sp": "SP",
        "distrito federal df": "DF",
        "dom eliseu para": "PA",
        "espirito santos": "ES",
        "estado de sao paulo": "SP",
        "federal district": "DF",
        "florianopolis": "SC",
        "franca sp": "SP",
        "goiania": "GO",
        "goias go": "GO",
        "hortolandia": "SP",
        "itajai": "SC",
        "itapevi": "SP",
        "macapa": "AP",
        "manaus": "AM",
        "mato grosso mt": "MT",
        "matto grosso do sul": "MS",
        "minas gerais mg": "MG",
        "minas gerias": "MG",
        "niteroi": "RJ",
        "niteroi rio de janeiro": "RJ",
        "parana pr": "PR",
        "piedade jaboatao dos guararapes": "PE",
        "presidente epitacio": "SP",
        "recife": "PE",
        "rio da janeiro": "RJ",
        "rio de janeiro rj": "RJ",
        "rio grando do sul": "RS",
        "sao paulo brasil": "SP",
        "sao paulo sp": "SP",
        "sao vicente": "SP",
        "serafina correa": "RS",
    },
    "IN": {
        "ahandnagar": "MH",
        "ahmedabad": "GJ",
        "aligarh": "UP",
        "andhra": "AP",
        "andhrapradesh": "AP",
        "banaskantha": "GJ",
        "bangalore": "KA",
        "bangalore karnataka": "KA",
        "bluandshar": "UP",
        "chandigar": "CH",
        "chattisgarh": "CG",
        "chennai": "TN",
        "chhatisgarh": "CG",
        "chhtisgarh": "CG",
        "cuttack sadar cuttack od": "OD",
        "delhiii": "DL",
        "dindigul": "TN",
        "gautam buddha nagar": "UP",
        "gujarar": "GJ",
        "gujarata": "GJ",
        "gujrat": "GJ",
        "gurugram": "HR",
        "harayana": "HR",
        "j k": "JK",
        "jaipur": "RJ",
        "jammu": "JK",
        "jammu kashmir": "JK",
        "jharkahnd": "JH",
        "jmmu and kashmir": "JK",
        "kangra": "HP",
        "karanatak": "KA",
        "karanataka": "KA",
        "karantaka": "KA",
        "karmataka": "KA",
        "karnaka": "KA",
        "karnantaka": "KA",
        "karnataa": "KA",
        "karnatake": "KA",
        "karntaka": "KA",
        "katni": "MP",
        "ker": "KL",
        "kerela": "KL",
        "kerelam": "KL",
        "koklta": "WB",
        "m p": "MP",
        "madhaypradesh": "MP",
        "madhyapradesh": "MP",
        "maharahstra": "MH",
        "maharashtea": "MH",
        "maharashtra solapur": "MH",
        "maharasthra": "MH",
        "maharastra": "MH",
        "maharatashtra": "MH",
        "maharshtra": "MH",
        "maharstra": "MH",
        "meeghalaya": "ML",
        "mharastra": "MH",
        "mumbai": "MH",
        "murshidabad": "WB",
        "navi mumbai thane thane maharashtra": "MH",
        "new delhi": "DL",
        "noida": "UP",
        "orissa": "OD",
        "panjim": "GA",
        "pune": "MH",
        "rajsthan": "RJ",
        "ratnagiri": "MH",
        "sivagangai": "TN",
        "talengana": "TS",
        "tami": "TN",
        "tamilnadu": "TN",
        "telaganan": "TS",
        "telamgaana": "TS",
        "telanagana": "TS",
        "telanagane": "TS",
        "telangan": "TS",
        "telengana": "TS",
        "thanjavur tamilnadu": "TN",
        "thiruvananthapuram": "KL",
        "tirupur": "TN",
        "uttar pardesh": "UP",
        "uttar pradhesh": "UP",
        "uttar pradsh": "UP",
        "uttarakhan": "UK",
        "uttarpradesh": "UP",
        "utter pradesh": "UP",
        "utthar pradesh": "UP",
        "uttrakhand": "UK",
        "west bangal": "WB",
        "westbengal": "WB",
        "yamuna paar delhi": "DL",
    },
}


def normalize(value: str) -> str:
    folded = "".join(
        character
        for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    )
    return " ".join(re.sub(r"[^a-z\s]", " ", folded.lower()).split())


def _build_lookup(country: str) -> dict[str, str]:
    lookup = dict(ALIASES[country])
    for subdivision in pycountry.subdivisions.get(country_code=country) or []:
        code = cast(Any, subdivision).code.split("-")[1]
        lookup[normalize(cast(Any, subdivision).name)] = code
        lookup[code.lower()] = code
    lookup.update(LEGACY_CODES[country])
    return lookup


LOOKUPS = {country: _build_lookup(country) for country in COUNTRIES}


def resolve_state(country: str, state: str) -> str | None:
    return LOOKUPS[country].get(normalize(state))


@dataclass(frozen=True)
class Correction:
    customer_id: UUID
    country: str
    old_state: str
    new_state: str | None


async def plan_corrections(session: AsyncSession) -> tuple[list[Correction], int]:
    country = Customer.billing_address["country"].astext
    state = Customer.billing_address["state"].astext
    result = await session.execute(
        select(Customer.id, country, state).where(
            country.in_(COUNTRIES),
            func.coalesce(state, "") != "",
            Customer.deleted_at.is_(None),
        )
    )
    corrections = []
    unchanged = 0
    for customer_id, customer_country, old_state in result:
        new_state = resolve_state(customer_country, old_state)
        if new_state == old_state:
            unchanged += 1
            continue
        corrections.append(
            Correction(customer_id, customer_country, old_state, new_state)
        )
    return corrections, unchanged


def correction_statement(
    customer_ids: Sequence[UUID], old_state: str, new_state: str | None
) -> Update:
    address = Customer.billing_address
    corrected: ColumnElement[Any]
    if new_state is None:
        corrected = address.op("-")(sql_cast("state", Text))
    else:
        corrected = address.op("||")(func.jsonb_build_object("state", new_state))
    return (
        update(Customer)
        .values(billing_address=corrected, modified_at=Customer.modified_at)
        .where(
            Customer.id.in_(customer_ids),
            Customer.billing_address["state"].astext == old_state,
        )
    )


async def apply_corrections(
    session: AsyncSession,
    corrections: Sequence[Correction],
    *,
    batch_size: int = 1000,
    sleep_seconds: float = 0,
) -> int:
    grouped: dict[tuple[str, str | None], list[UUID]] = defaultdict(list)
    for correction in corrections:
        grouped[(correction.old_state, correction.new_state)].append(
            correction.customer_id
        )

    updated = 0
    for (old_state, new_state), customer_ids in grouped.items():
        for start in range(0, len(customer_ids), batch_size):
            result = await session.execute(
                correction_statement(
                    customer_ids[start : start + batch_size], old_state, new_state
                )
            )
            await session.commit()
            updated += cast(Any, result).rowcount
            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)
    return updated


def write_corrections(corrections: Sequence[Correction], output: Path) -> None:
    with output.open("w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["customer_id", "country", "old_state", "new_state"])
        for correction in corrections:
            writer.writerow(
                [
                    correction.customer_id,
                    correction.country,
                    correction.old_state,
                    correction.new_state or "",
                ]
            )


def print_summary(corrections: Sequence[Correction], unchanged: int) -> None:
    removed = Counter(
        (correction.country, correction.old_state)
        for correction in corrections
        if correction.new_state is None
    )
    typer.echo(f"Already a code: {unchanged}")
    typer.echo(f"Set to a code: {len(corrections) - removed.total()}")
    typer.echo(f"State removed: {removed.total()}")
    for (country, old_state), count in sorted(removed.items()):
        typer.echo(f"  {country} {old_state!r}: {count}")


@cli.command()
@typer_async
async def backfill_customer_billing_address_state(
    execute: bool = typer.Option(False, help="Apply the changes; dry-run otherwise"),
    output: Path = typer.Option(
        Path("customer_billing_address_state_corrections.csv"),
        help="CSV of the planned changes, including the original values",
    ),
    batch_size: int = typer.Option(1000, help="Number of rows to update per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = read_engine(command_timeout=600)
    try:
        async with create_async_sessionmaker(engine)() as session:
            corrections, unchanged = await plan_corrections(session)
    finally:
        await engine.dispose()

    write_corrections(corrections, output)
    print_summary(corrections, unchanged)
    typer.echo(f"Planned changes written to {output}")

    if not execute:
        typer.echo("Dry run: nothing was updated. Pass --execute to apply.")
        return

    engine = create_async_engine("script")
    try:
        async with create_async_sessionmaker(engine)() as session:
            updated = await apply_corrections(
                session, corrections, batch_size=batch_size, sleep_seconds=sleep_seconds
            )
    finally:
        await engine.dispose()
    typer.echo(f"Updated {updated} customers")


if __name__ == "__main__":
    cli()
