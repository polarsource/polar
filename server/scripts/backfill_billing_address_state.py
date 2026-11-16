"""Normalize the free-text state of BR and IN billing addresses.

Covers every model bearing an address: customers, orders, credit notes and
checkouts. Each state becomes its ISO 3166-2 code (`BR-SP`, `IN-MH`),
the form `Address` stores. A state that can't
be resolved is removed from customers and left untouched everywhere else.

Dry-run by default: it writes every planned change to a CSV, which is also the only
record of the original values once `--execute` has run.
"""

import asyncio
import csv
import re
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any, cast
from uuid import UUID

import pycountry
import typer
from sqlalchemy import ColumnElement, Text, Update, func, select, update
from sqlalchemy import cast as sql_cast
from sqlalchemy.orm import InstrumentedAttribute

from polar.kit.address import SUBDIVISIONS, Address
from polar.kit.db.models import RecordModel
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.models import Checkout, CreditNote, Customer, Order
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
    unprefixed = re.sub(rf"^\s*{country}\s*-", "", state, flags=re.IGNORECASE)
    code = LOOKUPS[country].get(normalize(unprefixed))
    if code is None:
        return None
    resolved = f"{country}-{code}"
    return resolved if resolved in SUBDIVISIONS[country] else None


class Target(StrEnum):
    customer = "customer"
    order = "order"
    credit_note = "credit_note"
    checkout = "checkout"


@dataclass(frozen=True)
class AddressSource:
    model: type[RecordModel]
    address: InstrumentedAttribute[Address | None]
    remove_unresolved: bool = False


SOURCES: dict[Target, AddressSource] = {
    Target.customer: AddressSource(
        Customer, Customer.billing_address, remove_unresolved=True
    ),
    Target.order: AddressSource(Order, Order.billing_address),
    Target.credit_note: AddressSource(CreditNote, CreditNote.billing_address),
    Target.checkout: AddressSource(Checkout, Checkout.customer_billing_address),
}


@dataclass(frozen=True)
class Correction:
    target: Target
    record_id: UUID
    country: str
    old_state: str
    new_state: str | None


@dataclass
class Plan:
    corrections: list[Correction]
    unchanged: int
    unresolved: Counter[tuple[Target, str, str]]


async def plan_corrections(session: AsyncSession, targets: Sequence[Target]) -> Plan:
    plan = Plan(corrections=[], unchanged=0, unresolved=Counter())
    for target in targets:
        source = SOURCES[target]
        country = source.address["country"].astext
        state = source.address["state"].astext
        result = await session.execute(
            select(source.model.id, country, state).where(
                country.in_(COUNTRIES),
                func.coalesce(state, "") != "",
                source.model.deleted_at.is_(None),
            )
        )
        for record_id, record_country, old_state in result:
            new_state = resolve_state(record_country, old_state)
            if new_state == old_state:
                plan.unchanged += 1
            elif new_state is None and not source.remove_unresolved:
                plan.unresolved[(target, record_country, old_state)] += 1
            else:
                plan.corrections.append(
                    Correction(target, record_id, record_country, old_state, new_state)
                )
    return plan


def correction_statement(
    target: Target,
    record_ids: Sequence[UUID],
    country: str,
    old_state: str,
    new_state: str | None,
) -> Update:
    source = SOURCES[target]
    corrected: ColumnElement[Any]
    if new_state is None:
        corrected = source.address.op("-")(sql_cast("state", Text))
    else:
        corrected = source.address.op("||")(func.jsonb_build_object("state", new_state))
    return (
        update(source.model)
        .values({source.address: corrected, "modified_at": source.model.modified_at})
        .where(
            source.model.id.in_(record_ids),
            source.model.deleted_at.is_(None),
            source.address["country"].astext == country,
            source.address["state"].astext == old_state,
        )
    )


async def apply_corrections(
    session: AsyncSession,
    corrections: Sequence[Correction],
    *,
    batch_size: int = 1000,
    sleep_seconds: float = 0,
) -> Counter[Target]:
    grouped: dict[tuple[Target, str, str, str | None], list[UUID]] = defaultdict(list)
    for correction in corrections:
        grouped[
            (
                correction.target,
                correction.country,
                correction.old_state,
                correction.new_state,
            )
        ].append(correction.record_id)

    updated: Counter[Target] = Counter()
    for (target, country, old_state, new_state), record_ids in grouped.items():
        for start in range(0, len(record_ids), batch_size):
            result = await session.execute(
                correction_statement(
                    target,
                    record_ids[start : start + batch_size],
                    country,
                    old_state,
                    new_state,
                )
            )
            await session.commit()
            updated[target] += cast(Any, result).rowcount
            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)
    return updated


def write_corrections(corrections: Sequence[Correction], output: Path) -> None:
    with output.open("w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["target", "id", "country", "old_state", "new_state"])
        for correction in corrections:
            writer.writerow(
                [
                    correction.target,
                    correction.record_id,
                    correction.country,
                    correction.old_state,
                    correction.new_state or "",
                ]
            )


def print_summary(plan: Plan) -> None:
    removed = Counter(
        (correction.target, correction.country, correction.old_state)
        for correction in plan.corrections
        if correction.new_state is None
    )
    typer.echo(f"Already a code: {plan.unchanged}")
    typer.echo(f"Set to a code: {len(plan.corrections) - removed.total()}")
    for label, states in (
        ("State removed", removed),
        ("Unresolved, left untouched", plan.unresolved),
    ):
        typer.echo(f"{label}: {states.total()}")
        for (target, country, old_state), count in sorted(states.items()):
            typer.echo(f"  {target} {country} {old_state!r}: {count}")


@cli.command()
@typer_async
async def backfill_billing_address_state(
    execute: bool = typer.Option(False, help="Apply the changes; dry-run otherwise"),
    target: list[Target] = typer.Option(
        list(Target), help="Models to process; all of them by default"
    ),
    output: Path = typer.Option(
        Path("billing_address_state_corrections.csv"),
        help="CSV of the planned changes, including the original values",
    ),
    batch_size: int = typer.Option(1000, help="Number of rows to update per batch"),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    engine = read_engine(command_timeout=600)
    try:
        async with create_async_sessionmaker(engine)() as session:
            plan = await plan_corrections(session, target)
    finally:
        await engine.dispose()

    write_corrections(plan.corrections, output)
    print_summary(plan)
    typer.echo(f"Planned changes written to {output}")

    if not execute:
        typer.echo("Dry run: nothing was updated. Pass --execute to apply.")
        return

    engine = create_async_engine("script")
    try:
        async with create_async_sessionmaker(engine)() as session:
            updated = await apply_corrections(
                session,
                plan.corrections,
                batch_size=batch_size,
                sleep_seconds=sleep_seconds,
            )
    finally:
        await engine.dispose()
    for updated_target, count in updated.items():
        typer.echo(f"Updated {count} {updated_target} rows")


if __name__ == "__main__":
    cli()
