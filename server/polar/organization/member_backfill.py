from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    Subquery,
    Update,
    Uuid,
    and_,
    bindparam,
    cast,
    select,
    update,
)

from polar.models import Benefit, BenefitGrant, Downloadable, LicenseKey


def _license_key_grants() -> Subquery:
    key_id = BenefitGrant.properties["license_key_id"].as_string()
    return (
        select(
            key_id.label("license_key_id"), BenefitGrant.member_id.label("member_id")
        )
        .where(
            BenefitGrant.member_id.is_not(None),
            BenefitGrant.deleted_at.is_(None),
            BenefitGrant.properties["license_key_id"].is_not(None),
        )
        .distinct(key_id)
        .order_by(key_id, BenefitGrant.granted_at.desc().nulls_last())
        .subquery()
    )


def _downloadable_grants() -> Subquery:
    return (
        select(
            BenefitGrant.customer_id,
            BenefitGrant.benefit_id,
            BenefitGrant.member_id,
        )
        .where(
            BenefitGrant.member_id.is_not(None),
            BenefitGrant.deleted_at.is_(None),
        )
        .distinct(BenefitGrant.customer_id, BenefitGrant.benefit_id)
        .order_by(
            BenefitGrant.customer_id,
            BenefitGrant.benefit_id,
            BenefitGrant.granted_at.desc().nulls_last(),
        )
        .subquery()
    )


def license_key_member_backfill_statement(
    organization_id: UUID | None = None,
    *,
    batched: bool = False,
) -> Update:
    value_grants = _license_key_grants()
    filter_grants = _license_key_grants()

    conditions: list[ColumnElement[bool]] = [
        LicenseKey.member_id.is_(None),
        LicenseKey.deleted_at.is_(None),
    ]
    if organization_id is not None:
        conditions.append(LicenseKey.organization_id == organization_id)

    target = (
        select(LicenseKey.id)
        .select_from(
            filter_grants.join(
                LicenseKey,
                cast(filter_grants.c.license_key_id, Uuid) == LicenseKey.id,
            )
        )
        .where(*conditions)
    )
    if batched:
        target = target.limit(bindparam("limit"))

    return (
        update(LicenseKey)
        .values(member_id=value_grants.c.member_id)
        .where(
            cast(value_grants.c.license_key_id, Uuid) == LicenseKey.id,
            LicenseKey.id.in_(target.scalar_subquery()),
        )
    )


def downloadable_member_backfill_statement(
    organization_id: UUID | None = None,
    *,
    batched: bool = False,
) -> Update:
    value_grants = _downloadable_grants()
    filter_grants = _downloadable_grants()

    conditions: list[ColumnElement[bool]] = [
        Downloadable.member_id.is_(None),
        Downloadable.deleted_at.is_(None),
    ]
    if organization_id is not None:
        conditions.append(
            Downloadable.benefit_id.in_(
                select(Benefit.id).where(Benefit.organization_id == organization_id)
            )
        )

    target = (
        select(Downloadable.id)
        .select_from(
            filter_grants.join(
                Downloadable,
                and_(
                    Downloadable.customer_id == filter_grants.c.customer_id,
                    Downloadable.benefit_id == filter_grants.c.benefit_id,
                ),
            )
        )
        .where(*conditions)
    )
    if batched:
        target = target.limit(bindparam("limit"))

    return (
        update(Downloadable)
        .values(member_id=value_grants.c.member_id)
        .where(
            Downloadable.customer_id == value_grants.c.customer_id,
            Downloadable.benefit_id == value_grants.c.benefit_id,
            Downloadable.id.in_(target.scalar_subquery()),
        )
    )
