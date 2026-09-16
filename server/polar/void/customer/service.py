from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError

from polar.auth.models import is_user
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.customer.schemas.customer import CustomerIndividualCreate, CustomerUpdate
from polar.customer.service import customer as polar_customer_service
from polar.exceptions import PolarError, PolarRequestValidationError, ResourceNotFound
from polar.models import Customer
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.auth import VoidAuth
from polar.void.identity.repository import IdentityRepository
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import DeletedIdentityConflict
from polar.void.identity.service import identity as identity_service

from .repository import CustomerRepository
from .schemas import Customer as CustomerSchema
from .schemas import CustomerCreate


class CustomerBindingConflict(PolarError):
    def __init__(
        self, message: str = "The customer or identity is already in use."
    ) -> None:
        super().__init__(message, 409)


class CustomerService:
    async def list(
        self, session: AsyncReadSession, auth: VoidAuth
    ) -> Sequence[CustomerSchema]:
        await assert_organization_permission(
            session,
            auth.auth_subject,
            auth.organization_id,
            OrganizationPermission.customers_read,
        )
        customers = await CustomerRepository.from_session(session).list(
            auth.organization_id
        )
        return [self._serialize(customer) for customer in customers]

    async def get(
        self,
        session: AsyncReadSession,
        auth: VoidAuth,
        external_id: str,
    ) -> CustomerSchema:
        customer = await CustomerRepository.from_session(
            session
        ).get_active_by_external_id(auth.organization_id, external_id)
        if customer is None:
            raise ResourceNotFound("No bound customer with this external ID.")
        native = await polar_customer_service.get(
            session, auth.auth_subject, customer.id
        )
        if native is None:
            raise ResourceNotFound("No bound customer with this external ID.")
        return self._serialize(customer)

    async def create(
        self,
        session: AsyncSession,
        auth: VoidAuth,
        create_schema: CustomerCreate,
    ) -> CustomerSchema:
        await assert_organization_permission(
            session,
            auth.auth_subject,
            auth.organization_id,
            OrganizationPermission.customers_manage,
        )
        await IdentityRepository.from_session(session).lock_organization(
            auth.organization_id
        )
        try:
            async with session.begin_nested():
                return await self._create(session, auth, create_schema)
        except DeletedIdentityConflict as exc:
            raise CustomerBindingConflict(exc.message) from exc
        except PolarRequestValidationError as exc:
            raise CustomerBindingConflict(
                "A Polar customer already uses this email or external ID. "
                "Bind it explicitly using its customer_id and external ID."
            ) from exc
        except IntegrityError as exc:
            if any(
                constraint in str(exc)
                for constraint in (
                    "customers_organization_id_external_id_key",
                    "ix_customers_organization_id_email_not_null",
                    "customers_root_identity_id_key",
                )
            ):
                raise CustomerBindingConflict() from exc
            raise

    async def _create(
        self,
        session: AsyncSession,
        auth: VoidAuth,
        create_schema: CustomerCreate,
    ) -> CustomerSchema:
        organization = auth.organization
        repository = CustomerRepository.from_session(session)
        root, _ = await identity_service.ensure(
            session,
            organization,
            IdentityCreate(
                external_id=create_schema.external_id,
                metadata={
                    "kind": "customer",
                    **({"name": create_schema.name} if create_schema.name else {}),
                },
            ),
        )
        if not root.is_root:
            raise CustomerBindingConflict("A customer can only own a root identity.")
        if await repository.get_by_identity_id(organization.id, root.id) is not None:
            raise CustomerBindingConflict("This root identity already has an owner.")

        native = await polar_customer_service.get_external(
            session, auth.auth_subject, create_schema.external_id
        )
        if native is not None and native.organization_id != organization.id:
            native = None
        if create_schema.customer_id is not None:
            explicit = await polar_customer_service.get(
                session, auth.auth_subject, create_schema.customer_id
            )
            if explicit is None:
                raise ResourceNotFound("No Polar customer with this ID.")
            if explicit.organization_id != organization.id:
                raise ResourceNotFound("No Polar customer with this ID.")
            if native is not None and native.id != explicit.id:
                raise CustomerBindingConflict(
                    "The external ID identifies another customer."
                )
            if explicit.external_id not in (None, create_schema.external_id):
                raise CustomerBindingConflict(
                    "The customer has a different external ID."
                )
            native = explicit

        if native is not None:
            native = await repository.lock_customer(organization.id, native.id)
            if native is None:
                raise ResourceNotFound("No Polar customer with this ID.")
            if native.external_id not in (None, create_schema.external_id):
                raise CustomerBindingConflict(
                    "The customer has a different external ID."
                )
            if native.root_identity_id is not None:
                raise CustomerBindingConflict(
                    "This customer already has a root identity."
                )
            if native.external_id is None:
                native = await polar_customer_service.update(
                    session,
                    native,
                    CustomerUpdate(external_id=create_schema.external_id),
                )
        else:
            native = await polar_customer_service.create(
                session,
                CustomerIndividualCreate.model_validate(
                    {
                        "external_id": create_schema.external_id,
                        "email": create_schema.email,
                        "name": create_schema.name,
                        "organization_id": (
                            organization.id if is_user(auth.auth_subject) else None
                        ),
                    }
                ),
                auth.auth_subject,
            )

        native.root_identity = root
        await repository.update(native, flush=True)
        return self._serialize(native)

    def _serialize(self, native: Customer) -> CustomerSchema:
        assert native.root_identity is not None
        return CustomerSchema.model_validate(
            {
                "id": native.id,
                "external_id": native.root_identity.external_id,
                "email": native.email,
                "name": native.name,
                "created_at": native.created_at,
            }
        )


customer = CustomerService()
