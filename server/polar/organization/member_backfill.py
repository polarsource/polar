from typing import Any
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    ScalarSelect,
    String,
    Update,
    bindparam,
    select,
    update,
)

from polar.models import Benefit, BenefitGrant, Downloadable, LicenseKey


def _license_key_grant_member() -> ScalarSelect[Any]:
    return (
        select(BenefitGrant.member_id)
        .where(
            BenefitGrant.properties["license_key_id"].as_string()
            == LicenseKey.id.cast(String),
            BenefitGrant.member_id.is_not(None),
            BenefitGrant.deleted_at.is_(None),
        )
        .order_by(BenefitGrant.granted_at.desc().nulls_last())
        .limit(1)
        .correlate(LicenseKey)
        .scalar_subquery()
    )


def _downloadable_grant_member() -> ScalarSelect[Any]:
    return (
        select(BenefitGrant.member_id)
        .where(
            BenefitGrant.customer_id == Downloadable.customer_id,
            BenefitGrant.benefit_id == Downloadable.benefit_id,
            BenefitGrant.member_id.is_not(None),
            BenefitGrant.deleted_at.is_(None),
        )
        .order_by(BenefitGrant.granted_at.desc().nulls_last())
        .limit(1)
        .correlate(Downloadable)
        .scalar_subquery()
    )


def license_key_member_backfill_statement(
    organization_id: UUID | None = None,
    *,
    batched: bool = False,
) -> Update:
    conditions: list[ColumnElement[bool]] = [
        LicenseKey.member_id.is_(None),
        LicenseKey.deleted_at.is_(None),
        _license_key_grant_member().is_not(None),
    ]
    if organization_id is not None:
        conditions.append(LicenseKey.organization_id == organization_id)

    target = select(LicenseKey.id).where(*conditions).order_by(LicenseKey.id)
    if batched:
        target = target.limit(bindparam("limit"))

    return (
        update(LicenseKey)
        .where(LicenseKey.id.in_(target.scalar_subquery()))
        .values(member_id=_license_key_grant_member())
    )


def downloadable_member_backfill_statement(
    organization_id: UUID | None = None,
    *,
    batched: bool = False,
) -> Update:
    conditions: list[ColumnElement[bool]] = [
        Downloadable.member_id.is_(None),
        Downloadable.deleted_at.is_(None),
        _downloadable_grant_member().is_not(None),
    ]
    if organization_id is not None:
        conditions.append(
            Downloadable.benefit_id.in_(
                select(Benefit.id).where(Benefit.organization_id == organization_id)
            )
        )

    target = select(Downloadable.id).where(*conditions).order_by(Downloadable.id)
    if batched:
        target = target.limit(bindparam("limit"))

    return (
        update(Downloadable)
        .where(Downloadable.id.in_(target.scalar_subquery()))
        .values(member_id=_downloadable_grant_member())
    )
