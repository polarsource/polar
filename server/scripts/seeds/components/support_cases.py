"""Support cases seed component (a dispute case for the backoffice).

Opens a dispute case around the dispute created by the Disputes component, with a
short merchant/platform message thread, so the backoffice Support Cases views
have data.
"""

from __future__ import annotations

from polar.dispute.dispute_case import dispute_case as dispute_case_service
from polar.models.support_case import SupportCaseAudience, SupportCaseMessageAuthorKind
from polar.support_case.service import support_case as support_case_service

from scripts.seeds.base import SeedContext, Variant


class SupportCasesComponent:
    key = "support_cases"
    label = "Support cases"
    default_on = False
    requires = ["disputes"]
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        created_disputes = ctx.created.get("disputes", [])
        if not created_disputes:
            return "support cases: no dispute to open a case for"

        dispute_case = await dispute_case_service.open_case(
            ctx.session, created_disputes[0], organization=ctx.organization
        )
        await support_case_service.post_message(
            ctx.session,
            dispute_case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            body="This was a legitimate purchase — receipt and delivery attached.",
            audience=[SupportCaseAudience.merchant],
        )
        await support_case_service.post_message(
            ctx.session,
            dispute_case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            body="Thanks — strong evidence. We've submitted it to the bank for you.",
            audience=[SupportCaseAudience.merchant],
        )
        await dispute_case_service.mark_under_review(ctx.session, dispute_case)

        return "1 dispute case (under review)"


component = SupportCasesComponent()
