from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope
from polar.authz.service import get_accessible_org_ids
from polar.authz.types import AccessibleOrganizationID
from polar.exceptions import ResourceNotFound
from polar.models import Customer
from polar.models import Organization as OrganizationModel
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession, get_db_session

from .repository import CustomerRepository
from .schemas.customer import CustomerCreate, CustomerID, ExternalCustomerID

_READ_SCOPES = {Scope.customers_read, Scope.customers_write}
_WRITE_SCOPES = {Scope.customers_write}

_read_authenticator = Authenticator(
    allowed_subjects={User, Organization},
    required_scopes=_READ_SCOPES,
)
_write_authenticator = Authenticator(
    allowed_subjects={User, Organization},
    required_scopes=_WRITE_SCOPES,
)


# List endpoint — authenticate + resolve accessible org IDs.
async def _authorize_list(
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_read_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> set[AccessibleOrganizationID]:
    return await get_accessible_org_ids(session, auth_subject)


AuthorizeCustomerList = Annotated[
    set[AccessibleOrganizationID], Depends(_authorize_list)
]


# Create endpoint — authenticate + parse body + resolve target organization.
async def _authorize_create(
    customer_create: CustomerCreate,
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_write_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationModel:
    return await get_payload_organization(session, auth_subject, customer_create)


AuthorizeCustomerCreate = Annotated[OrganizationModel, Depends(_authorize_create)]


# Per-id and per-external-id endpoints — resolve customer with a single
# auth-aware repository query, then return it. The org-membership filter
# in get_readable_by_* is the only access check needed for customer
# (membership = permission). 404 if the customer doesn't exist OR isn't
# accessible — same response, no existence leakage.
async def _resolve_by_id(
    id: CustomerID,
    auth_subject: AuthSubject[User | Organization],
    session: AsyncSession,
) -> Customer:
    org_ids = await get_accessible_org_ids(session, auth_subject)
    repository = CustomerRepository.from_session(session)
    customer = await repository.get_readable_by_id(org_ids, id)
    if customer is None:
        raise ResourceNotFound()
    return customer


async def _resolve_by_external_id(
    external_id: ExternalCustomerID,
    auth_subject: AuthSubject[User | Organization],
    session: AsyncSession,
) -> Customer:
    org_ids = await get_accessible_org_ids(session, auth_subject)
    repository = CustomerRepository.from_session(session)
    customer = await repository.get_readable_by_external_id(org_ids, external_id)
    if customer is None:
        raise ResourceNotFound()
    return customer


async def _authorize_read_by_id(
    id: CustomerID,
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_read_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    return await _resolve_by_id(id, auth_subject, session)


async def _authorize_write_by_id(
    id: CustomerID,
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_write_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    return await _resolve_by_id(id, auth_subject, session)


async def _authorize_read_by_external_id(
    external_id: ExternalCustomerID,
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_read_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    return await _resolve_by_external_id(external_id, auth_subject, session)


async def _authorize_write_by_external_id(
    external_id: ExternalCustomerID,
    auth_subject: Annotated[
        AuthSubject[User | Organization], Depends(_write_authenticator)
    ],
    session: AsyncSession = Depends(get_db_session),
) -> Customer:
    return await _resolve_by_external_id(external_id, auth_subject, session)


AuthorizeCustomerRead = Annotated[Customer, Depends(_authorize_read_by_id)]
AuthorizeCustomerWrite = Annotated[Customer, Depends(_authorize_write_by_id)]
AuthorizeCustomerExternalRead = Annotated[
    Customer, Depends(_authorize_read_by_external_id)
]
AuthorizeCustomerExternalWrite = Annotated[
    Customer, Depends(_authorize_write_by_external_id)
]
