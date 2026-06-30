from __future__ import annotations

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
    HTTPValidationError,
)
from polar.literals import (
    MemberRole,
    MemberSortProperty,
)
from polar.outputs import (
    ListResourceMember,
)


class MembersSync(SyncServiceBase):
    def list_members(
        self,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
        role: MemberRole | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: list[MemberSortProperty] | None = ["-created_at"],
    ) -> ListResourceMember:
        """
        List members with optional customer ID filter.

        **Scopes**: `members:read` `members:write`

        Args:
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            role: Filter by member role.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/members/",
            path_params={},
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "role": role,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceMember, method_errors)


class MembersAsync(AsyncServiceBase):
    async def list_members(
        self,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
        role: MemberRole | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: list[MemberSortProperty] | None = ["-created_at"],
    ) -> ListResourceMember:
        """
        List members with optional customer ID filter.

        **Scopes**: `members:read` `members:write`

        Args:
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            role: Filter by member role.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/members/",
            path_params={},
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "role": role,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceMember, method_errors)
