"""Send a "Build and Deploy" run's merge-to-production time to PostHog as deploy_completed."""

import json
import subprocess
import sys
import urllib.request
import uuid
from datetime import datetime

REPO = "polarsource/polar"
PRODUCTION = "Deploy to Production"
COMPONENTS = {
    "backend": "/ Backend: Deploy to production",
    "frontend": "/ Frontend: Promote to Production",
}
POSTHOG_PROJECT_API_KEY = "phc_H2ajVAY4cy0uQpcgN5fzpv8JC3yP8VZOjx2EXiFBbgz"


def gh(path: str) -> dict:
    output = subprocess.run(
        ["gh", "api", path], capture_output=True, text=True, check=True
    ).stdout
    return json.loads(output)


def main(run_id: str) -> None:
    run = gh(f"repos/{REPO}/actions/runs/{run_id}")
    jobs = gh(f"repos/{REPO}/actions/runs/{run_id}/jobs?filter=latest&per_page=100")[
        "jobs"
    ]
    deployed = {
        component: job
        for job in jobs
        for component, suffix in COMPONENTS.items()
        if job["name"].startswith(PRODUCTION)
        and job["name"].endswith(suffix)
        and job["conclusion"] == "success"
    }
    if not deployed:
        print(f"Run {run_id} deployed nothing to production")
        return

    live = max(datetime.fromisoformat(job["completed_at"]) for job in deployed.values())
    started = min(datetime.fromisoformat(job["started_at"]) for job in jobs)
    merge_to_production = live - datetime.fromisoformat(run["created_at"])
    properties = {
        "$process_person_profile": False,
        "components": "+".join(sorted(deployed)),
        "merge_to_production_minutes": round(
            merge_to_production.total_seconds() / 60, 2
        ),
        "pipeline_minutes": round((live - started).total_seconds() / 60, 2),
        "run_id": run["id"],
        "run_url": run["html_url"],
        "head_sha": run["head_sha"],
    }
    event = {
        "event": "deploy_completed",
        "distinct_id": "github-actions",
        "uuid": str(uuid.uuid5(uuid.NAMESPACE_URL, run["html_url"])),
        "timestamp": live.isoformat(),
        "properties": properties,
    }
    request = urllib.request.Request(
        "https://us.i.posthog.com/batch/",
        data=json.dumps(
            {"api_key": POSTHOG_PROJECT_API_KEY, "batch": [event]}
        ).encode(),
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(request, timeout=30).close()
    print(f"Sent run {run_id} to PostHog: {properties}")


if __name__ == "__main__":
    main(sys.argv[1])
