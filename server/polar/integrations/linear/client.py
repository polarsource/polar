from typing import cast

import httpx

from polar.config import settings
from polar.exceptions import PolarError

from .schemas import Issue, IssueCreateFromTemplateInput, IssueCreatePayload

API_URL = "https://api.linear.app/graphql"

CREATE_ISSUE_FROM_TEMPLATE = """
mutation CreateIssueFromTemplate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue {
      id
      identifier
      title
      description
      url
    }
  }
}
"""


class LinearClientError(PolarError): ...


class LinearClient:
    async def create_issue_from_template(
        self, input: IssueCreateFromTemplateInput
    ) -> Issue | None:
        """Create an issue with template overrides; return None when unconfigured."""
        api_key = settings.LINEAR_API_KEY
        async with httpx.AsyncClient(
            headers={"Authorization": api_key} if api_key else {},
            timeout=httpx.Timeout(10.0, connect=5.0),
            transport=(
                httpx.MockTransport(lambda _: httpx.Response(200))
                if not api_key
                else None
            ),
        ) as client:
            response = await client.post(
                API_URL,
                json={
                    "query": CREATE_ISSUE_FROM_TEMPLATE,
                    "variables": {"input": input},
                },
            )
            response.raise_for_status()

        if not api_key:
            return None

        body = response.json()
        if errors := body.get("errors"):
            message = "; ".join(error["message"] for error in errors)
            raise LinearClientError(f"Linear issue creation failed: {message}")

        payload = cast(IssueCreatePayload, body["data"]["issueCreate"])
        if not payload["success"] or payload["issue"] is None:
            raise LinearClientError("Linear issue creation failed")
        return payload["issue"]


linear = LinearClient()
