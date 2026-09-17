from typing import Literal

TAXONOMY = "polar.agent/v1"
DEFAULT_GROUP_BY = "call_id"
CONFIDENCE_THRESHOLD = 0.6
SPAN_EVENT_CAP = 20
PENDING = "pending"
UNLABELED = "unlabeled"

ActivitySlug = Literal[
    "plan", "retrieve", "implement", "act", "review", "retry", "other"
]

ACTIVITY_CRITERIA: dict[ActivitySlug, str] = {
    "plan": "Deciding what to do next. No world-changing tool and no user-facing artifact.",
    "retrieve": "Searching or reading context (files, web, memory, RAG).",
    "implement": "Writing or editing the artifact the user asked for.",
    "act": "A tool that changes something outside the model (ticket, deploy, email, DB).",
    "review": "Checking or critiquing work already done.",
    "retry": "Repeating a failed or looping step. The user would not see this as progress.",
    "other": "None of the above, or the span is not agent work.",
}

ACTIVITY_INSTRUCTIONS = (
    "Primary activity of this agent span. Use tools, tool_errors, "
    "finish_reasons, fallback_from, and the event sequence. `step` is only "
    "the zero-based provider-call index, not a label. Tools are names only: "
    "read/search/list/grep → retrieve; write/edit/patch/apply → implement; "
    "ticket/deploy/email/db/browser → act; critique-only → review. A span "
    "may mix tools; pick the activity that owns the spend. Prefer retry when "
    "a later event repeats failed tools or follows an error or fallback. "
    "If tools are empty and nothing else signals an activity, prefer other."
)

WASTE_INSTRUCTIONS = (
    "Did most of this span's spend go to retries, loops, failed tools, or "
    "other steps the user would not count as progress?"
)
