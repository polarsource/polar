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
from typing import IO
from uuid import UUID

import httpx2
import structlog

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
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
from polar.models import Benefit, Customer, File, Organization
from polar.models.benefit import BenefitType
from polar.models.file import FileServiceTypes
from polar.models.merchant_migration_record import MerchantMigrationRecordType
from polar.product.service import product as product_service
from polar.redis import Redis

from .adapters.lemon_squeezy import LemonSqueezyAdapter
from .canonical import CanonicalBenefit, CanonicalBenefitFile, CanonicalPurchase
from .repository import MerchantMigrationRecordRepository

log = structlog.get_logger()

EXTERNAL_ID_PREFIX = "lemon_squeezy:"
# Order pages granted per run, each read once with the store's keys.
PURCHASE_PAGES_PER_RUN = 10
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
        license key, a few order pages from ``first_page`` on. Returns the page to go
        on from, None once done. The store's keys are read once per run, so a
        run covers several pages. A rerun is safe: an existing grant is
        skipped."""
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
                await benefit_grant_service.grant_manually(
                    self.session,
                    self.organization,
                    customer,
                    benefit,
                    member,
                    properties=properties,
                )
            except BenefitGrantAlreadyExists:
                # One manual grant per buyer and benefit: a second purchase of
                # the same product doesn't get its own key.
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
    session: AsyncReadSession, organization_id: UUID, key: str | None
) -> BenefitGrantLicenseKeysProperties:
    """Grant properties that make the license key grant reuse ``key``. Empty
    when there's none or the organization already has it: keys are unique per
    organization, so the grant then makes a new one."""
    if key is None:
        return {}
    taken = await LicenseKeyRepository.from_session(
        session
    ).get_by_organization_and_key(organization_id, key)
    return {} if taken is not None else {"user_provided_key": key}


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
