---
description: Capture technical debt with full context for AgentPay development
---

You are helping manage technical debt and future work items for the AgentPay project.

## Your Task

Add a structured todo item to `TO-DOS.md` in the project root with enhanced AgentPay-specific metadata.

## Required Information

Extract or ask for:
1. **Action & Component**: What needs to be done and where
2. **Priority**: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
3. **Phase**: Which implementation phase (Phase 0-6, or post-MVP)
4. **Component**: messaging | intent | orchestration | conversational | trust | context | infrastructure
5. **Effort**: XS (<1hr), S (1-4hrs), M (4-8hrs), L (1-2 days), XL (>2 days)
6. **Problem Statement**: What's wrong or what's needed
7. **File Location**: Path and line numbers where relevant
8. **Context**: Technical details, error messages, discovered during what work
9. **Solution Hint**: Potential approach (optional but encouraged)
10. **Related**: Links to other todos, GitHub issues, or milestones (optional)

## Priority Guidelines

- **P0 (Critical)**: Blocks current work, production bug, security issue
- **P1 (High)**: Needed soon, affects multiple features, technical debt causing pain
- **P2 (Medium)**: Should do, quality improvement, moderate tech debt
- **P3 (Low)**: Nice to have, minor optimization, future consideration

## Component Guide

- **messaging**: WhatsApp, Slack, Telegram adapters, message routing
- **intent**: Intent classification, entity extraction, LLM integration
- **orchestration**: Payment rail selection, routing, cost calculation
- **conversational**: Payment flows, state machines, confirmation handling
- **trust**: Compliance, KYC, fraud detection, explainability
- **context**: Reconciliation, accounting sync, relationship graphs
- **infrastructure**: Database, monitoring, deployment, performance

## Workflow

1. **Check for duplicates**: Search `TO-DOS.md` for similar items
   - If found, ask user: Skip, Replace, or Add as separate item

2. **Extract context from conversation** (if not explicitly provided):
   - What problem was discovered?
   - Which files and line numbers are involved?
   - What was the user working on when this was found?
   - Are there error messages or specific technical details?
   - What's the root cause?

3. **Format the todo entry**:

```markdown
## [YYYY-MM-DD HH:MM] | [Priority] | [Phase] | [Component] | [Effort]

### [Action] [Specific Component/Feature]
- **Problem**: [Clear description of what's wrong or needed]
- **Location**: [file/path:line-numbers]
- **Context**: [Technical details, how discovered, related work]
- **Solution Hint**: [Potential approach or reference]
- **Related**: [Links to other todos, issues, docs]
```

4. **Save to TO-DOS.md**:
   - Append to the file (newest at bottom)
   - Preserve existing content

5. **Confirm and resume**:
   - Show the added todo
   - Ask: "Resume your previous task, or work on something else?"

## Example Output

```markdown
## 2024-01-15 14:32 | P1 | Phase 2 | orchestration | M

### Implement fallback handling for payment rail failures
- **Problem**: When PIX is down, payment orchestration fails instead of falling back to Stripe
- **Location**: server/polar/payment_orchestration/service.py:156-180
- **Context**: Discovered during PIX integration testing. Currently raises NoAvailableRailException even when Stripe is available. Need circuit breaker pattern.
- **Solution Hint**: Implement rail health monitoring (track error rates), add fallback logic in select_optimal_rail(), consider using tenacity for retry logic
- **Related**: See .claude/skills/payment-orchestration.md section on "Fallback Handling"
```

## Special Cases

**If user provides todo without context**:
- Analyze last 10-15 messages for context
- Extract file paths, error messages, technical details
- Fill in as much as possible
- Ask clarifying questions if needed

**If priority/phase/component unclear**:
- Make educated guess based on context
- Ask user to confirm: "I'm marking this as P1/Phase 2/orchestration. Correct?"

**If duplicate found**:
```
"I found a similar todo from [date]:
[show existing todo]

Options:
1. Skip (don't add)
2. Replace (update existing)
3. Add as separate item

Which would you prefer?"
```

## After Adding Todo

Show confirmation:
```
✅ Added to TO-DOS.md:
[Priority] [Component] [Effort]: [Task summary]

You now have [N] todos in backlog.
```

Then ask:
"Resume your previous task, or would you like to work on this todo now?"

## Important Notes

- **Don't interrupt flow**: Be quick and efficient
- **Capture rich context**: The more detail, the better future-you will thank you
- **Link to skills**: Reference relevant .claude/skills/ documents
- **Link to plan**: Reference AGENTPAY_IMPLEMENTATION_PLAN.md milestones
- **Be specific**: Vague todos are useless todos

## Integration with Implementation Plan

When adding todos, consider which milestone they relate to:
- Check AGENTPAY_IMPLEMENTATION_PLAN.md for current phase
- Tag with appropriate phase
- This helps with sprint planning and prioritization

Remember: The goal is to capture technical debt WITHOUT derailing current work. Be fast, be thorough, then get back to what the user was doing.
