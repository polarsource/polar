"""
Bulk Appeal Review — find unanswered appeal threads in Plain, run AI review,
send draft emails, and persist APPROVE/DENY decisions to the DB.

Usage:
    cd server

    # Dry-run mode, process 1 thread (default — safe, no changes):
    uv run python -m scripts.bulk_appeal_review

    # Process 5 threads in dry-run mode:
    uv run python -m scripts.bulk_appeal_review --limit 5

    # Process all threads in dry-run mode:
    uv run python -m scripts.bulk_appeal_review --limit 0

    # Actually send replies and persist decisions for 1 thread:
    uv run python -m scripts.bulk_appeal_review --execute

    # Process all threads:
    uv run python -m scripts.bulk_appeal_review --execute --limit 0
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

# Write JWKS file before importing polar.config (which validates the JWKS path
# on import). Render cron jobs don't support secret_files, so JWKS content is
# passed via POLAR_JWKS_CONTENT env var instead.
_jwks_content = os.environ.get("POLAR_JWKS_CONTENT")
if _jwks_content:
    _jwks_path = os.environ.get("POLAR_JWKS", "/tmp/jwks.json")
    with open(_jwks_path, "w") as _f:
        _f.write(_jwks_content)

import httpx  # noqa: E402
import structlog  # noqa: E402
from plain_client import (  # noqa: E402
    CreateNoteInput,
    DoneStatusDetail,
    MarkThreadAsDoneInput,
    Plain,
    ReplyToThreadInput,
    SnoozeStatusDetail,
    SnoozeThreadInput,
    SortDirection,
    ThreadsFilter,
    ThreadsSort,
    ThreadsSortField,
    ThreadStatus,
)

from polar.config import settings  # noqa: E402
from polar.kit.db.postgres import create_async_sessionmaker  # noqa: E402
from polar.organization.repository import OrganizationRepository  # noqa: E402
from polar.organization.service import (  # noqa: E402
    organization as organization_service,
)
from polar.postgres import create_async_engine  # noqa: E402

from .appeal_review import AppealAction, run_appeal_review_with_deps  # noqa: E402
from .helper import configure_script_console_logging  # noqa: E402

log = structlog.get_logger(__name__)

APPEAL_LABEL_TYPE_ID = "lt_01K3QWYTDV7RSS7MM2RC584X41"
SLUG_PATTERN = re.compile(r"Organization Appeal - (\S+)")

TIMELINE_QUERY = """
query ThreadTimeline($threadId: ID!) {
  thread(threadId: $threadId) {
    timelineEntries(first: 50) {
      edges {
        node {
          actor {
            __typename
          }
          entry {
            __typename
          }
        }
      }
    }
  }
}
"""


MIN_THREAD_AGE = timedelta(hours=4)


async def get_appeal_threads(plain: Plain) -> list[dict[str, str]]:
    """Paginate all Plain threads with the appeal label.

    Only returns threads older than MIN_THREAD_AGE to give the organization
    time to respond before an automatic review is created.
    """
    threads: list[dict[str, str]] = []
    cursor: str | None = None
    cutoff = datetime.now(UTC) - MIN_THREAD_AGE

    while True:
        kwargs: dict[str, Any] = dict(
            filters=ThreadsFilter(
                label_type_ids=[APPEAL_LABEL_TYPE_ID],
                statuses=[ThreadStatus.TODO],
            ),
            sort_by=ThreadsSort(
                field=ThreadsSortField.CREATED_AT, direction=SortDirection.ASC
            ),
            first=50,
        )
        if cursor is not None:
            kwargs["after"] = cursor

        result = await plain.threads(**kwargs)

        for edge in result.edges:
            thread = edge.node
            match = SLUG_PATTERN.search(thread.title or "")
            if not match:
                log.debug(
                    "Skipping thread (title does not match appeal pattern)",
                    thread_id=thread.id,
                    title=thread.title,
                )
                continue
            if not thread.id:
                continue

            # Skip threads that are too recent
            created_at = datetime.fromisoformat(thread.created_at.iso_8601)
            if created_at > cutoff:
                log.debug(
                    "Skipping thread (younger than 4h)",
                    thread_id=thread.id,
                    slug=match.group(1),
                    created_at=thread.created_at.iso_8601,
                )
                continue

            threads.append(
                {
                    "thread_id": thread.id,
                    "slug": match.group(1),
                    "customer_id": thread.customer.id,
                }
            )

        if not result.page_info.has_next_page:
            break
        cursor = result.page_info.end_cursor

    return threads


async def is_thread_answered(plain_token: str, thread_id: str) -> bool:
    """Check if a thread already has a staff reply (userActor) or outbound email."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://core-api.uk.plain.com/graphql/v1",
            headers={
                "Authorization": f"Bearer {plain_token}",
                "Content-Type": "application/json",
            },
            json={"query": TIMELINE_QUERY, "variables": {"threadId": thread_id}},
            timeout=15.0,
        )

    if response.status_code != 200:
        log.warning(
            "Failed to fetch timeline", thread_id=thread_id, status=response.status_code
        )
        return True  # Treat errors as "answered" to skip safely

    data = response.json()
    thread_data = data.get("data", {}).get("thread")
    if not thread_data:
        return True

    entries = thread_data.get("timelineEntries", {}).get("edges", [])
    for edge in entries:
        node = edge.get("node", {})
        actor = node.get("actor", {})
        entry = node.get("entry", {})
        # Staff or bot replied via chat or email
        if actor.get("__typename") in ("UserActor", "MachineUserActor") and entry.get(
            "__typename"
        ) in (
            "ChatEntry",
            "EmailEntry",
        ):
            return True

    return False


async def handle_org(
    plain: Plain,
    thread_id: str,
    customer_id: str,
    slug: str,
    session_maker: Any,
    dry_run: bool,
) -> bool:
    """Check if org is deleted; if so, deny appeal, leave a note, and close thread.

    Returns True if the org was deleted and handled, False otherwise.
    """
    async with session_maker() as session:
        org_repo = OrganizationRepository.from_session(session)
        stmt = org_repo.get_base_statement(include_deleted=True).where(
            OrganizationRepository.model.slug == slug
        )
        org = await org_repo.get_one_or_none(stmt)
        if org is None or org.deleted_at is None:
            # Org doesn't exist or is not deleted — skip
            return False

        log.info(
            "Organization is deleted, closing appeal",
            slug=slug,
            deleted_at=str(org.deleted_at),
        )

        if dry_run:
            log.info(
                "DRY RUN: Would deny appeal, leave note, and close thread for deleted org",
                slug=slug,
                thread_id=thread_id,
            )
            return True

        # Deny appeal in DB
        try:
            await organization_service.deny_appeal(session, org)
            await session.commit()
            log.info("Denied appeal for deleted org in DB", slug=slug)
        except ValueError as e:
            log.warning(
                "Could not deny appeal in DB (may already be denied)",
                slug=slug,
                error=str(e),
            )

        # Leave an internal note on the thread
        note_text = (
            f"Organization '{slug}' has been deleted. "
            "Appeal automatically denied — no customer reply sent."
        )
        note_result = await plain.create_note(
            CreateNoteInput(
                customer_id=customer_id,
                thread_id=thread_id,
                text=note_text,
            )
        )
        if note_result.error is not None:
            log.error(
                "Failed to create note",
                thread_id=thread_id,
                error=str(note_result.error),
            )
        else:
            log.info("Left internal note on thread", thread_id=thread_id)

        # Mark thread as done
        done_result = await plain.mark_thread_as_done(
            MarkThreadAsDoneInput(
                thread_id=thread_id,
                status_detail=DoneStatusDetail.DONE_AUTOMATICALLY_SET,
            )
        )
        if done_result.error is not None:
            log.error(
                "Failed to mark thread as done",
                thread_id=thread_id,
                error=str(done_result.error),
            )
        else:
            log.info("Marked thread as done", thread_id=thread_id)

        return True


async def process_appeals(
    dry_run: bool = True,
    limit: int = 1,
    model: str = "openai:gpt-5.2-2025-12-11",
    skip_website: bool = False,
) -> None:
    engine = create_async_engine("script")
    session_maker = create_async_sessionmaker(engine)
    plain_token = settings.PLAIN_TOKEN
    if not plain_token:
        raise RuntimeError("PLAIN_TOKEN is not configured")

    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {plain_token}"},
    ) as http_client:
        async with Plain(
            "https://core-api.uk.plain.com/graphql/v1", http_client=http_client
        ) as plain:
            # 1. Fetch appeal threads
            log.info("Fetching appeal threads from Plain...")
            all_threads = await get_appeal_threads(plain)
            log.info("Found appeal threads", count=len(all_threads))

            # 2. Filter to unanswered
            unanswered: list[dict[str, str]] = []
            for thread_data in all_threads:
                answered = await is_thread_answered(
                    plain_token, thread_data["thread_id"]
                )
                if not answered:
                    unanswered.append(thread_data)
                else:
                    log.debug(
                        "Skipping answered thread",
                        thread_id=thread_data["thread_id"],
                        slug=thread_data["slug"],
                    )

            log.info("Unanswered appeal threads", count=len(unanswered))

            # 3. Apply limit
            to_process = unanswered[:limit] if limit > 0 else unanswered
            if len(unanswered) > len(to_process):
                log.info(
                    "Limiting threads",
                    total=len(unanswered),
                    processing=len(to_process),
                )

            # 4. Process each thread
            counts: Counter[str] = Counter()
            errors = 0
            deleted_count = 0

            for thread_data in to_process:
                thread_id = thread_data["thread_id"]
                slug = thread_data["slug"]
                customer_id = thread_data["customer_id"]

                try:
                    # Handle deleted orgs: deny, leave note, close thread
                    was_deleted = await handle_org(
                        plain,
                        thread_id,
                        customer_id,
                        slug,
                        session_maker,
                        dry_run,
                    )
                    if was_deleted:
                        deleted_count += 1
                        continue

                    log.info("Running appeal review", slug=slug, thread_id=thread_id)
                    result = await run_appeal_review_with_deps(
                        slug,
                        session_maker=session_maker,
                        plain_client=plain,
                        plain_token=plain_token,
                        model=model,
                        skip_website=skip_website,
                    )
                    counts[result.action] += 1

                    if dry_run:
                        log.info(
                            "DRY RUN: Would send reply and persist decision",
                            slug=slug,
                            action=result.action,
                            draft_email_preview=result.draft_email[:200],
                        )
                        continue

                    # Send reply to thread
                    reply_result = await plain.reply_to_thread(
                        ReplyToThreadInput(
                            thread_id=thread_id,
                            text_content=result.draft_email,
                            markdown_content=result.draft_email,
                        )
                    )
                    if reply_result.error is not None:
                        log.error(
                            "Failed to reply",
                            thread_id=thread_id,
                            slug=slug,
                            error=str(reply_result.error),
                        )
                    else:
                        log.info("Sent reply", thread_id=thread_id, slug=slug)

                    # Persist DB decision
                    async with session_maker() as session:
                        org_repo = OrganizationRepository.from_session(session)
                        org = await org_repo.get_by_slug(slug)
                        if org is None:
                            log.error("Organization not found for DB update", slug=slug)
                        else:
                            if result.action == AppealAction.APPROVE:
                                await organization_service.approve_appeal(session, org)
                                log.info("Approved appeal in DB", slug=slug)
                            elif result.action == AppealAction.DENY:
                                await organization_service.deny_appeal(session, org)
                                log.info("Denied appeal in DB", slug=slug)
                            else:
                                log.info("Follow-up — no DB change", slug=slug)
                            await session.commit()

                    # Snooze thread
                    snooze_result = await plain.snooze_thread(
                        SnoozeThreadInput(
                            thread_id=thread_id,
                            status_detail=SnoozeStatusDetail.WAITING_FOR_CUSTOMER,
                        )
                    )
                    if snooze_result.error is not None:
                        log.error(
                            "Failed to snooze",
                            thread_id=thread_id,
                            error=str(snooze_result.error),
                        )
                    else:
                        log.info("Snoozed thread", thread_id=thread_id)

                except Exception as e:
                    errors += 1
                    log.error(
                        "Failed to process thread",
                        slug=slug,
                        thread_id=thread_id,
                        error_type=type(e).__name__,
                        error_message=str(e),
                        exc_info=True,
                    )

            # 5. Summary
            log.info(
                "Summary",
                total_appeal_threads=len(all_threads),
                unanswered=len(unanswered),
                processed=len(to_process),
                approve=counts.get(AppealAction.APPROVE, 0),
                deny=counts.get(AppealAction.DENY, 0),
                follow_up=counts.get(AppealAction.FOLLOW_UP, 0),
                orgs=deleted_count,
                errors=errors,
                dry_run=dry_run,
            )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bulk appeal review — find unanswered appeals, run AI review, send replies (defaults to dry-run)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually send replies and persist decisions (by default, runs in dry-run mode)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Maximum number of threads to process (default: 1, use 0 for unlimited)",
    )
    parser.add_argument(
        "--model",
        default="openai:gpt-5.2-2025-12-11",
        help="AI model to use for review (default: openai:gpt-5.2-2025-12-11)",
    )
    parser.add_argument(
        "--skip-website",
        action="store_true",
        help="Skip website browsing during review",
    )
    args = parser.parse_args()

    dry_run = not args.execute

    configure_script_console_logging()

    if dry_run:
        log.info("Running in DRY-RUN mode (no changes will be made)")
        log.info("Use --execute to actually send replies and persist decisions")
    else:
        log.warning(
            "Running in EXECUTE mode — replies will be sent and decisions persisted!"
        )

    log.info(
        "Processing settings",
        limit=args.limit if args.limit > 0 else "unlimited",
        model=args.model,
        skip_website=args.skip_website,
        dry_run=dry_run,
    )

    try:
        asyncio.run(
            process_appeals(
                dry_run=dry_run,
                limit=args.limit,
                model=args.model,
                skip_website=args.skip_website,
            )
        )
    except KeyboardInterrupt:
        log.info("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        log.error(
            "Script failed",
            error_type=type(e).__name__,
            error_message=str(e),
            exc_info=True,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
