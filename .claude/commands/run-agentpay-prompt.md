---
description: Execute AgentPay prompts with sub-agents and track milestone progress
---

You are executing structured prompts for AgentPay development with enhanced tracking and milestone progress updates.

## Your Task

Run one or more prompts from `.prompts/` using the Task tool, with AgentPay-specific enhancements:
- Track milestone progress
- Update implementation plan status
- Integrate results with project documentation
- Provide structured summaries

## Input Parsing

Accept prompts in multiple formats:
- **By number**: `5` or `005` → finds `*./-005-*.md` or `*phase*-005-*.md`
- **By name**: `pix-integration` → finds `*pix-integration*.md`
- **By phase**: `phase2-011` → finds `phase2-011-*.md`
- **Latest**: `latest` or no args → most recent prompt
- **Multiple**: `5 6 7` → multiple prompts
- **With flags**: `5 6 --parallel` or `5 6 --sequential`

Default execution mode: **Sequential** (safer, ensures dependencies are met)

## Execution Modes

### Single Prompt
```
/run-agentpay-prompt 005
→ Spawns single Task with prompt content
→ Waits for completion
→ Shows result and updates tracking
```

### Parallel Execution
```
/run-agentpay-prompt 5 6 7 --parallel
→ Spawns all Tasks in single message (parallel execution)
→ Use when prompts are independent
→ Faster but requires no inter-dependencies
```

### Sequential Execution
```
/run-agentpay-prompt 5 6 7 --sequential
→ Runs 5, waits for completion
→ Then runs 6, waits for completion
→ Then runs 7
→ Stops if any prompt fails
```

## Pre-Execution Checks

Before running prompts:

1. **Verify prompt files exist**:
   ```
   Found prompts:
   - .prompts/phase2-005-pix-client.md
   - .prompts/phase2-006-pix-webhook.md

   Ready to execute sequentially.
   ```

2. **Check for ambiguity**:
   ```
   ❌ Multiple matches for "pix":
   - phase2-011-pix-integration.md
   - phase2-015-pix-optimization.md

   Please be more specific:
   - Use full name: pix-integration
   - Use number: 011
   - Use phase prefix: phase2-011
   ```

3. **Verify dependencies** (for sequential):
   ```
   Execution order:
   1. phase2-010-orchestration-framework.md (foundation)
   2. phase2-011-pix-adapter.md (requires #1)
   3. phase2-013-multi-rail-selection.md (requires #1, #2)

   Dependencies look good ✓
   ```

## Task Execution

For each prompt, spawn Task with:

```python
Task(
    subagent_type="general-purpose",
    description=f"Execute: {prompt_name}",
    prompt=f"""
    Execute the following AgentPay development task.

    **Important Context**:
    - Project: AgentPay (AI-native payment orchestration)
    - Built on: Polar platform (FastAPI, PostgreSQL, Redis)
    - See .claude/prompts/ for project context
    - See .claude/skills/ for domain guidance

    **Coding Standards**:
    - Follow .claude/prompts/development-guidelines.md
    - Use service/repository pattern
    - NEVER call session.commit() directly
    - Proper async/await patterns

    {prompt_content}

    **After Completion**:
    Return a structured summary including:
    - What was implemented
    - Files created/modified
    - Tests written and results
    - Any blockers or issues
    - Completion percentage of the task
    """
)
```

## Result Processing

After Task completes, for each prompt:

### 1. Extract Results
- Files created/modified
- Tests written and pass/fail
- Blockers encountered
- Completion status

### 2. Archive Completed Prompts
```bash
mkdir -p .prompts/archive/$(date +%Y-%m)
mv .prompts/phase2-011-pix-integration.md .prompts/archive/2024-01/
```

### 3. Update Milestone Tracking

Create/update `.prompts/MILESTONE_PROGRESS.md`:

```markdown
# AgentPay Implementation Progress

## Phase 2: Payment Orchestration
**Status**: In Progress (40% complete)
**Timeline**: Weeks 7-10

### Milestone 2.1: Core Orchestration Framework ✅
- [x] phase2-010-orchestration-framework.md (completed 2024-01-15)
- Status: Complete

### Milestone 2.2: PIX Integration 🚧
- [x] phase2-011a-pix-client-and-adapter.md (completed 2024-01-16)
- [x] phase2-011b-pix-webhook-handler.md (completed 2024-01-16)
- [ ] phase2-011c-pix-integration-tests.md (in progress)
- Status: 75% complete

### Milestone 2.3: Stripe Adapter
- [ ] phase2-012-stripe-adapter.md
- Status: Not started
```

### 4. Show Summary

```
✅ Executed: phase2-011-pix-integration.md

**Results**:
✅ Files Created:
   - server/polar/payment_orchestration/rails/pix/client.py
   - server/polar/payment_orchestration/rails/pix/adapter.py
   - server/polar/payment_orchestration/rails/pix/webhook_handler.py

✅ Tests:
   - 15 tests written
   - 15/15 passing
   - Coverage: 87%

✅ Integration:
   - Works with orchestration framework
   - Webhook endpoint functional
   - QR code generation tested

**Milestone Progress**:
Phase 2, Milestone 2.2: PIX Integration → 75% complete
Overall Phase 2 Progress: 40% → 48%

**Success Criteria Met**:
✅ Payment creation < 1s (measured: 0.4s)
✅ QR code generation working
✅ Webhook reliability (tested with 100 events: 100% success)

**Next Steps**:
- Complete integration tests (phase2-011c)
- Move to Milestone 2.3: Stripe Adapter

Prompt archived to: .prompts/archive/2024-01/
```

## Multi-Prompt Summary

For sequential execution:
```
✅ Executed 3 prompts sequentially

**Results**:
1. ✅ phase2-011a-pix-client.md
   - PIX client implemented
   - 8 tests passing

2. ✅ phase2-011b-pix-webhook.md
   - Webhook handler implemented
   - Signature verification working
   - 7 tests passing

3. ✅ phase2-011c-integration-tests.md
   - End-to-end tests written
   - All integration tests passing

**Combined Results**:
- Files created: 12
- Tests: 30 (30 passing)
- Coverage: 85%
- Duration: 45 minutes

**Milestone Progress**:
Phase 2, Milestone 2.2: PIX Integration → 100% complete ✅
Overall Phase 2 Progress: 40% → 60%

Ready to move to Milestone 2.3: Stripe Adapter
```

For parallel execution:
```
✅ Executed 3 prompts in parallel

**Results**:
✅ phase3-020-whatsapp-client.md (completed in 12 min)
✅ phase3-021-slack-client.md (completed in 15 min)
✅ phase3-022-telegram-client.md (completed in 10 min)

**Combined Results**:
- 3 messaging adapters implemented
- All tests passing
- Total time: 15 min (3x faster than sequential)

**Milestone Progress**:
Phase 3, Milestone 3.1: Messaging Platforms → 75% complete

Note: These prompts were independent and safe to parallelize.
```

## Error Handling

### Prompt Not Found
```
❌ Prompt not found: phase2-999

Available prompts in .prompts/:
- phase2-010-orchestration-framework.md
- phase2-011-pix-integration.md
- phase2-012-stripe-adapter.md

Did you mean one of these?
```

### Task Execution Failed
```
❌ Failed: phase2-011-pix-integration.md

**Error**: PIX API client failed to initialize
**Details**: Missing PIX_API_KEY environment variable

**Next Steps**:
1. Set PIX_API_KEY in .env
2. Review prompt requirements
3. Re-run with: /run-agentpay-prompt 011

Prompt NOT archived (can retry).
```

### Sequential Execution Halted
```
⚠️ Sequential execution halted at prompt 2/3

**Completed**:
✅ 1. phase2-011-client.md

**Failed**:
❌ 2. phase2-012-webhook.md
   Error: Webhook endpoint port conflict

**Not Executed**:
⏸️ 3. phase2-013-integration.md (skipped due to failure)

**Recovery**:
1. Fix the issue in prompt 2
2. Re-run remaining: /run-agentpay-prompt 012 013 --sequential

Previous work saved. No need to re-run prompt 1.
```

## Special Features for AgentPay

### Skill Integration
After execution, check if any learnings should update skills:
```
💡 Learnings from this implementation:

Discovered that PIX QR codes should use 512x512 resolution
for better mobile scanning.

Should we update .claude/skills/api-integration.md (PIX section)
with this recommendation? [Yes/No]
```

### Dependencies Check
Before sequential execution, parse prompts for dependencies:
```
Analyzing dependencies...

phase2-011 requires: orchestration framework (phase2-010) ✅
phase2-012 requires: orchestration framework (phase2-010) ✅
phase2-013 requires: phase2-011 AND phase2-012 ⚠️

Recommended order:
1. phase2-011 (or parallel with 012)
2. phase2-012 (or parallel with 011)
3. phase2-013 (after both complete)

Execute in this order? [Yes/Modify/Cancel]
```

### Success Criteria Validation
Cross-reference with implementation plan:
```
Checking success criteria from AGENTPAY_IMPLEMENTATION_PLAN.md...

Phase 2, Milestone 2.2 requires:
✅ Payment creation < 1s (measured: 0.4s)
✅ Status detection < 5s (measured: 2.1s)
✅ Webhook reliability 99.9% (tested: 100%)

All success criteria met! ✅
```

## Post-Execution Actions

After successful execution, offer:
```
What's next?

1. ▶️ Continue to next milestone
2. 📝 Update implementation plan
3. ✅ Run tests again
4. 📊 Review milestone progress
5. 🔄 Work on something else

[Or continue with next prompt automatically]
```

## Integration with Git

Optionally, after major milestones:
```
Milestone 2.2 complete! 🎉

Create git commit?

Suggested commit message:
"Implement PIX payment rail integration (Phase 2, Milestone 2.2)

- Add PIX API client (PagSeguro)
- Implement PaymentRailAdapter for PIX
- Add webhook handling with signature verification
- Add QR code generation
- Write integration tests (30 tests, 85% coverage)

Success criteria:
✅ Payment creation: 0.4s (target: <1s)
✅ Status detection: 2.1s (target: <5s)
✅ Webhook reliability: 100% (target: 99.9%)

Completes Phase 2, Milestone 2.2 (PIX Integration)"

[Yes - create commit] [Edit message] [No - skip]
```

## Archive Strategy

Archive prompts after successful execution:
```
.prompts/archive/
├── 2024-01/
│   ├── phase1-001-rule-based-classifier.md
│   ├── phase1-002-llm-classifier.md
│   └── phase1-003-hybrid-classifier.md
├── 2024-02/
│   ├── phase2-010-orchestration-framework.md
│   └── phase2-011-pix-integration.md
└── README.md (index of completed work)
```

Keep active prompts in `.prompts/` root for easy access.

## Remember

- **Default to sequential**: Safer, respects dependencies
- **Parallel only when independent**: Verify no inter-dependencies
- **Track progress**: Update MILESTONE_PROGRESS.md
- **Archive completed work**: Keep .prompts/ clean
- **Validate success criteria**: Check against implementation plan
- **Learn and update**: Improve skills based on learnings

Your job is to execute prompts effectively AND track progress toward AgentPay's implementation goals.
