"""Send finished CI runs and their jobs to PostHog as ci_run_completed and ci_job_completed."""

import argparse
import json
import re
import subprocess
import urllib.request
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

from deploy_timings import POSTHOG_PROJECT_API_KEY, REPO

WORKFLOWS = (
    "test_server.yaml",
    "test_client.yaml",
    "test_sdk.yaml",
    "openapi-generate-check.yml",
)
SLOT_HOURS = 6
REAL_WORK_SECONDS = 60
BATCH_SIZE = 500
SHARD_NAME = re.compile(r"(?P<job>.+) \((?P<shard>\d+/\d+)\)")


def seconds_between(start: str, end: str) -> int:
    elapsed = datetime.fromisoformat(end) - datetime.fromisoformat(start)
    return max(0, round(elapsed.total_seconds()))


def last_full_slot(now: datetime) -> tuple[datetime, datetime]:
    until = now.replace(
        hour=now.hour - now.hour % SLOT_HOURS, minute=0, second=0, microsecond=0
    )
    return until - timedelta(hours=SLOT_HOURS), until


def gh_items(path: str, jq: str) -> list[dict]:
    output = subprocess.run(
        ["gh", "api", "--paginate", path, "--jq", jq],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [json.loads(line) for line in output.splitlines()]


def finished_runs(workflow: str, since: datetime, until: datetime) -> Iterator[dict]:
    day = since.date() - timedelta(days=1)
    while day <= until.date():
        runs = gh_items(
            f"repos/{REPO}/actions/workflows/{workflow}/runs"
            f"?created={day.isoformat()}&status=completed&per_page=100",
            ".workflow_runs[]",
        )
        for run in runs:
            if since <= datetime.fromisoformat(run["updated_at"]) < until:
                yield run
        day += timedelta(days=1)


def started_jobs(run: dict) -> list[dict]:
    jobs = gh_items(
        f"repos/{REPO}/actions/runs/{run['id']}/jobs?per_page=100", ".jobs[]"
    )
    return [job for job in jobs if job["started_at"] and job["completed_at"]]


def did_real_work(jobs: list[dict]) -> bool:
    return any(
        seconds_between(job["started_at"], job["completed_at"]) >= REAL_WORK_SECONDS
        for job in jobs
    )


def posthog_event(name: str, key: str, timestamp: str, properties: dict) -> dict:
    return {
        "event": name,
        "distinct_id": "github-actions",
        "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, key)),
        "timestamp": timestamp,
        "properties": {"$process_person_profile": False, **properties},
    }


def run_event(run: dict, did_work: bool) -> dict:
    return posthog_event(
        "ci_run_completed",
        f"{run['html_url']}/attempts/{run['run_attempt']}",
        run["updated_at"],
        {
            "workflow": run["name"],
            "trigger": run["event"],
            "conclusion": run["conclusion"],
            "did_work": did_work,
            "wall_seconds": seconds_between(run["run_started_at"], run["updated_at"]),
            "run_attempt": run["run_attempt"],
            "triggering_actor_type": run["triggering_actor"]["type"],
            "head_sha": run["head_sha"],
            "run_id": run["id"],
            "run_url": run["html_url"],
        },
    )


def job_event(run: dict, job: dict) -> dict:
    shard_name = SHARD_NAME.fullmatch(job["name"])
    steps = [step for step in job["steps"] if step["started_at"] and step["completed_at"]]
    longest_step = max(
        steps,
        key=lambda step: seconds_between(step["started_at"], step["completed_at"]),
        default=None,
    )
    return posthog_event(
        "ci_job_completed",
        job["html_url"],
        job["completed_at"],
        {
            "workflow": run["name"],
            "trigger": run["event"],
            "job": shard_name["job"] if shard_name else job["name"],
            "shard": shard_name["shard"] if shard_name else None,
            "conclusion": job["conclusion"],
            "runner": job["labels"][0] if job["labels"] else None,
            "queue_seconds": seconds_between(job["created_at"], job["started_at"]),
            "duration_seconds": seconds_between(job["started_at"], job["completed_at"]),
            "longest_step": longest_step["name"] if longest_step else None,
            "longest_step_seconds": (
                seconds_between(longest_step["started_at"], longest_step["completed_at"])
                if longest_step
                else None
            ),
            "head_sha": run["head_sha"],
            "run_id": run["id"],
            "job_url": job["html_url"],
        },
    )


def events_for_run(run: dict) -> list[dict]:
    if seconds_between(run["run_started_at"], run["updated_at"]) < REAL_WORK_SECONDS:
        return [run_event(run, did_work=False)]
    jobs = started_jobs(run)
    if not did_real_work(jobs):
        return [run_event(run, did_work=False)]
    return [run_event(run, did_work=True), *(job_event(run, job) for job in jobs)]


def send(events: list[dict]) -> None:
    for start in range(0, len(events), BATCH_SIZE):
        request = urllib.request.Request(
            "https://us.i.posthog.com/batch/",
            data=json.dumps(
                {
                    "api_key": POSTHOG_PROJECT_API_KEY,
                    "batch": events[start : start + BATCH_SIZE],
                }
            ).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(request, timeout=30).close()


def utc_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--since", type=utc_datetime)
    parser.add_argument("--until", type=utc_datetime)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    slot_since, slot_until = last_full_slot(datetime.now(UTC))
    since = args.since or slot_since
    until = args.until or slot_until

    events = [
        event
        for workflow in WORKFLOWS
        for run in finished_runs(workflow, since, until)
        for event in events_for_run(run)
    ]
    if args.dry_run:
        for event in events:
            print(json.dumps(event))
        return

    send(events)
    print(f"Sent {len(events)} events to PostHog for {since} to {until}")


if __name__ == "__main__":
    main()
