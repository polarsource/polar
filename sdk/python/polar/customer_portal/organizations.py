from __future__ import annotations

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.outputs import (
    CustomerOrganizationData,
)


class OrganizationsSync(SyncServiceBase):
    def get(
        self,
        slug: str,
    ) -> CustomerOrganizationData:
        """
        Get a customer portal's organization by slug.

        Args:
            slug: The organization slug.

        Raises:
            ResourceNotFound: Organization not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/organizations/{slug}",
            path_params={
                "slug": slug,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, CustomerOrganizationData, method_errors)


class OrganizationsAsync(AsyncServiceBase):
    async def get(
        self,
        slug: str,
    ) -> CustomerOrganizationData:
        """
        Get a customer portal's organization by slug.

        Args:
            slug: The organization slug.

        Raises:
            ResourceNotFound: Organization not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/organizations/{slug}",
            path_params={
                "slug": slug,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, CustomerOrganizationData, method_errors)
