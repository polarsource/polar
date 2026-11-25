"""Turns what a Lemon Squeezy store gives its buyers, license keys and files,
into Polar benefits on the imported products.

The benefits are read from the source when the merchant sets them up, not
staged on the ledger. Each one carries its source key as ``external_id``, so a
retry finds the benefit it already created instead of making a second one.
"""

import asyncio
import hashlib
import mimetypes
import tempfile
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import IO, cast
from uuid import UUID

import httpx2
import structlog

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.service import BenefitGrantAlreadyExists
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.repository import BenefitRepository
from polar.benefit.service import benefit as benefit_service
from polar.benefit.strategies import BenefitGrantProperties
from polar.benefit.strategies.custom.schemas import (
    BenefitCustomCreate,
    BenefitCustomCreateProperties,
)
from polar.benefit.strategies.downloadables.schemas import (
    BenefitDownloadablesCreate,
    BenefitDownloadablesCreateProperties,
)
from polar.benefit.strategies.license_keys.properties import (
    BenefitGrantLicenseKeysProperties,
    BenefitLicenseKeysProperties,
)
from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeyActivationCreateProperties,
    BenefitLicenseKeyExpirationProperties,
    BenefitLicenseKeysCreate,
    BenefitLicenseKeysCreateProperties,
)
from polar.customer.repository import CustomerRepository
from polar.customer.service import customer as customer_service
from polar.file.repository import FileRepository
from polar.file.s3 import S3_SERVICES
from polar.kit.db.postgres import AsyncReadSession, AsyncSession
from polar.kit.utils import generate_uuid
from polar.license_key.repository import LicenseKeyRepository
from polar.member.service import member_service
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    File,
    LicenseKeyActivation,
    Organization,
)
from polar.models.benefit import BenefitType
from polar.models.file import FileServiceTypes
from polar.models.merchant_migration_record import MerchantMigrationRecordType
from polar.product.service import product as product_service
from polar.redis import Redis
from polar.worker import enqueue_job

from .adapters.lemon_squeezy import LemonSqueezyAdapter
from .canonical import (
    CanonicalBenefit,
    CanonicalBenefitFile,
    CanonicalLicenseKey,
    CanonicalPurchase,
)
from .repository import MerchantMigrationRecordRepository

log = structlog.get_logger()

EXTERNAL_ID_PREFIX = "lemon_squeezy:"
# Order pages granted per run. Each run reads all of the store's license keys
# once, so fewer, bigger runs read them fewer times: 5,000 orders fit well
# within the job's time limit.
PURCHASE_PAGES_PER_RUN = 50
DOWNLOAD_CHUNK_SIZE = 1024 * 1024


def benefit_external_id(benefit: CanonicalBenefit) -> str:
    return f"{EXTERNAL_ID_PREFIX}{benefit.source_id}"


@dataclass
class BenefitProposal:
    source: CanonicalBenefit
    # Polar products imported from the source's variants.
    product_ids: list[UUID]
    created: Benefit | None


async def list_proposals(
    session: AsyncReadSession, organization_id: UUID, adapter: LemonSqueezyAdapter
) -> list[BenefitProposal]:
    sources = await adapter.list_benefits()
    created = {
        benefit.external_id: benefit
        for benefit in await BenefitRepository.from_session(
            session
        ).get_all_by_external_ids(
            organization_id, [benefit_external_id(source) for source in sources]
        )
    }
    variant_ids = {
        variant_id for source in sources for variant_id in source.product_source_ids
    }
    product_ids = (
        await MerchantMigrationRecordRepository.from_session(
            session
        ).get_imported_target_ids(
            organization_id=organization_id,
            type=MerchantMigrationRecordType.product,
            source_ids=variant_ids,
        )
        if variant_ids
        else {}
    )
    return [
        BenefitProposal(
            source=source,
            product_ids=[
                product_ids[variant_id]
                for variant_id in source.product_source_ids
                if variant_id in product_ids
            ],
            created=created.get(benefit_external_id(source)),
        )
        for source in sources
    ]


class MigrationBenefits:
    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        organization: Organization,
        adapter: LemonSqueezyAdapter,
    ) -> None:
        self.session = session
        self.redis = redis
        self.organization = organization
        self.adapter = adapter
        self.auth_subject = AuthSubject(
            organization,
            {Scope.products_write, Scope.benefits_write, Scope.customers_write},
            None,
        )
        self._proposals: list[BenefitProposal] | None = None

    async def proposals(self) -> list[BenefitProposal]:
        """Read once per run. Creating a benefit refreshes it."""
        if self._proposals is None:
            self._proposals = await list_proposals(
                self.session, self.organization.id, self.adapter
            )
        return self._proposals

    async def create_next(self, selected: Collection[str]) -> bool:
        """Create one selected benefit not created yet, with its files, and add
        it to its products. Selected benefits that already exist are added to
        any product still missing them, like one imported later. False once
        every selected benefit exists."""
        for proposal in await self.proposals():
            if proposal.source.source_id not in selected:
                continue
            benefit = proposal.created or await self._create(proposal.source)
            for product_id in proposal.product_ids:
                await self._attach(product_id, benefit)
            if proposal.created is None:
                self._proposals = None
                return True
        return False

    async def grant_purchases(
        self, selected: Collection[str], first_page: int
    ) -> int | None:
        """Give one-time buyers the benefits of what they bought, keeping their
        license key, ``PURCHASE_PAGES_PER_RUN`` order pages from ``first_page``
        on. Returns the page to go on from, None once done. A rerun is safe:
        an existing grant is skipped."""
        benefits_by_variant: dict[str, list[Benefit]] = {}
        for proposal in await self.proposals():
            if proposal.created is None or proposal.source.source_id not in selected:
                continue
            for variant_id in proposal.source.product_source_ids:
                benefits_by_variant.setdefault(variant_id, []).append(proposal.created)
        for page in range(first_page, first_page + PURCHASE_PAGES_PER_RUN):
            purchases, has_more = await self.adapter.list_purchases(page)
            for purchase in purchases:
                benefits = benefits_by_variant.get(purchase.product_source_id)
                if benefits:
                    await self._grant_purchase(purchase, benefits)
            if not has_more:
                return None
        return page + 1

    async def _create(self, source: CanonicalBenefit) -> Benefit:
        create: (
            BenefitLicenseKeysCreate | BenefitDownloadablesCreate | BenefitCustomCreate
        )
        if source.type == BenefitType.custom:
            create = BenefitCustomCreate(
                type=BenefitType.custom,
                description=source.description,
                external_id=benefit_external_id(source),
                properties=BenefitCustomCreateProperties(
                    note="\n".join(
                        f"- [{link.title}]({link.url})" for link in source.links
                    )
                ),
            )
        elif source.type == BenefitType.license_keys:
            assert source.license_keys is not None
            settings = source.license_keys
            create = BenefitLicenseKeysCreate(
                type=BenefitType.license_keys,
                description=source.description,
                external_id=benefit_external_id(source),
                properties=BenefitLicenseKeysCreateProperties(
                    activations=BenefitLicenseKeyActivationCreateProperties(
                        limit=settings.activation_limit,
                        enable_customer_admin=True,
                    )
                    if settings.activation_limit is not None
                    else None,
                    expires=BenefitLicenseKeyExpirationProperties(
                        ttl=settings.expires_ttl,
                        timeframe=settings.expires_timeframe,
                    )
                    if settings.expires_ttl is not None
                    and settings.expires_timeframe is not None
                    else None,
                ),
            )
        else:
            files = [await self._copy_file(file) for file in source.files]
            create = BenefitDownloadablesCreate(
                type=BenefitType.downloadables,
                description=source.description,
                external_id=benefit_external_id(source),
                properties=BenefitDownloadablesCreateProperties(
                    files=[file.id for file in files]
                ),
            )
        return await benefit_service.user_create(
            self.session, self.redis, create, self.auth_subject
        )

    async def _attach(self, product_id: UUID, benefit: Benefit) -> None:
        product = await product_service.get(self.session, self.auth_subject, product_id)
        if product is None:
            return
        benefit_ids = [existing.id for existing in product.benefits]
        if benefit.id in benefit_ids:
            return
        await product_service.update_benefits(
            self.session, product, [*benefit_ids, benefit.id], self.auth_subject
        )

    async def _copy_file(self, source: CanonicalBenefitFile) -> File:
        """Stream the file through a temporary file, so a large download never
        sits in memory."""
        s3 = S3_SERVICES[FileServiceTypes.downloadable]
        file_id = generate_uuid()
        path = (
            f"{FileServiceTypes.downloadable.value}/{self.organization.id}/"
            f"{file_id}/{source.name}"
        )
        mime_type = mimetypes.guess_type(source.name)[0] or "application/octet-stream"
        url = await self.adapter.file_download_url(source.source_id)
        with tempfile.TemporaryFile() as buffer:
            size, sha256 = await _download(url, buffer)
            buffer.seek(0)
            await asyncio.to_thread(
                s3.client.upload_fileobj,
                buffer,
                s3.bucket,
                path,
                ExtraArgs={"ContentType": mime_type},
            )
        head = await asyncio.to_thread(s3.get_head_or_raise, path)
        return await FileRepository.from_session(self.session).create(
            File(
                id=file_id,
                organization=self.organization,
                name=source.name,
                path=path,
                mime_type=mime_type,
                size=size,
                service=FileServiceTypes.downloadable,
                checksum_sha256_hex=sha256.hexdigest(),
                checksum_sha256_base64=None,
                checksum_etag=head.get("ETag"),
                last_modified_at=head.get("LastModified"),
                storage_version=head.get("VersionId"),
                is_uploaded=True,
                is_enabled=True,
            ),
            flush=True,
        )

    async def _grant_purchase(
        self, purchase: CanonicalPurchase, benefits: Sequence[Benefit]
    ) -> None:
        customer = await self._buyer(purchase)
        member = await member_service.create_owner_member(
            self.session, customer, self.organization
        )
        if member is None:
            return
        for benefit in benefits:
            if (
                benefit.type == BenefitType.license_keys
                and purchase.license_key_disabled
            ):
                continue
            properties: BenefitGrantProperties = (
                await kept_key_properties(
                    self.session, self.organization.id, purchase.license_key
                )
                if benefit.type == BenefitType.license_keys
                else {}
            )
            try:
                grant = await benefit_grant_service.grant_manually(
                    self.session,
                    self.organization,
                    customer,
                    benefit,
                    member,
                    properties=properties,
                )
                queue_kept_key_state(grant, benefit, purchase.license_key)
            except BenefitGrantAlreadyExists:
                # One manual grant per buyer and benefit: a rerun, or a second
                # purchase of the same product, which doesn't get its own key.
                log.info(
                    "merchant_migration.purchase_already_granted",
                    organization_id=self.organization.id,
                    benefit_id=benefit.id,
                    order_source_id=purchase.source_id,
                )

    async def _buyer(self, purchase: CanonicalPurchase) -> Customer:
        existing = await CustomerRepository.from_session(
            self.session
        ).get_by_email_and_organization(purchase.email, self.organization.id)
        if existing is not None:
            return existing
        return await customer_service.create_for_organization(
            self.session,
            self.organization,
            email=purchase.email,
            name=purchase.name,
        )


async def kept_key_properties(
    session: AsyncReadSession,
    organization_id: UUID,
    license_key: CanonicalLicenseKey | None,
) -> BenefitGrantLicenseKeysProperties:
    """Grant properties that make the license key grant reuse the source key.
    Empty when there's none or the organization already has it: keys are
    unique per organization, so the grant then makes a new one."""
    if license_key is None:
        return {}
    # A deleted key still holds its value.
    taken = await LicenseKeyRepository.from_session(
        session
    ).get_by_organization_and_key(
        organization_id, license_key.key, include_deleted=True
    )
    return {} if taken is not None else {"user_provided_key": license_key.key}


def queue_kept_key_state(
    grant: BenefitGrant, benefit: Benefit, license_key: CanonicalLicenseKey | None
) -> None:
    """Bring the source key's activations and, for a one-time purchase, its
    expiry, once the grant has made the key. Read now: the source may be gone
    by the time the grant runs. A subscription's key follows the subscription,
    so it keeps no expiry."""
    if (
        license_key is None
        or grant.properties.get("user_provided_key") != license_key.key
    ):
        return
    # The grant dates the key from the benefit's term; the source date wins,
    # "never" included.
    keep_expiry = grant.subscription_id is None and (
        license_key.expires_at is not None
        or cast(BenefitLicenseKeysProperties, benefit.properties).get("expires")
        is not None
    )
    if not license_key.activations and not keep_expiry:
        return
    enqueue_job(
        "merchant_migration.keep_license_key_activations",
        benefit_grant_id=grant.id,
        activations=[
            {"id": activation.id, "label": activation.label}
            for activation in license_key.activations
        ],
        keep_expiry=keep_expiry,
        expires_at=(
            license_key.expires_at.isoformat()
            if keep_expiry and license_key.expires_at
            else None
        ),
    )


async def keep_key_state(
    session: AsyncSession,
    benefit_grant_id: UUID,
    activations: list[dict[str, str]],
    expires_at: datetime | None = None,
    *,
    keep_expiry: bool = False,
) -> bool:
    """Give the key the grant kept the activations it has on the source, under
    the same ids, so activated devices keep validating, and the source's expiry,
    so the key doesn't start a new term. False while the grant hasn't made the
    key yet."""
    grant = await BenefitGrantRepository.from_session(session).get_by_id(
        benefit_grant_id
    )
    if grant is None or grant.is_revoked:
        return True
    license_key_id = grant.properties.get("license_key_id")
    if license_key_id is None:
        return grant.error is not None
    repository = LicenseKeyRepository.from_session(session)
    license_key = await repository.get_by_id(UUID(str(license_key_id)))
    # The grant made a new key: the source's activations aren't its own.
    if license_key is None or license_key.key != grant.properties.get(
        "user_provided_key"
    ):
        return True
    if keep_expiry:
        license_key.expires_at = expires_at
        session.add(license_key)
    ids = [UUID(activation["id"]) for activation in activations]
    taken = await repository.get_activation_ids(ids)
    for activation_id, activation in zip(ids, activations, strict=True):
        if activation_id in taken:
            continue
        session.add(
            LicenseKeyActivation(
                id=activation_id,
                license_key=license_key,
                label=activation["label"],
                conditions={},
                meta={},
            )
        )
    await session.flush()
    return True


class FileCopyFailed(Exception):
    def __init__(self, status_code: int) -> None:
        super().__init__(f"Downloading a file failed with status {status_code}.")


async def _download(url: str, buffer: IO[bytes]) -> tuple[int, "hashlib._Hash"]:
    sha256 = hashlib.sha256()
    size = 0
    # The download link redirects to the file's storage.
    async with httpx2.AsyncClient(
        timeout=httpx2.Timeout(60.0), follow_redirects=True
    ) as client:
        async with client.stream("GET", url) as response:
            # The signed link must not reach logs, so the error leaves it out.
            if response.is_error:
                raise FileCopyFailed(response.status_code)
            async for chunk in response.aiter_bytes(DOWNLOAD_CHUNK_SIZE):
                buffer.write(chunk)
                sha256.update(chunk)
                size += len(chunk)
    return size, sha256
