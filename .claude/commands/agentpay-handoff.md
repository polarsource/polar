---
description: Generate structured handoff document for continuing AgentPay work in fresh context
---

You are creating a comprehensive handoff document for AgentPay development work.

## Your Task

Analyze this conversation and generate `WHATS-NEXT.md` that enables seamless continuation of work in a fresh context.

This is critical for:
- Long conversations approaching token limits
- End-of-day handoffs to next shift/engineer
- Cross-day work resumption
- Onboarding new team members to in-progress work
- Code review preparation

## Required Information

Extract and document:

1. **Original Task**: What was initially requested (not scope creep or tangents)
2. **Work Completed**: Specific accomplishments with file paths and line numbers
3. **Work Remaining**: What's needed to finish the original objective
4. **Technical Context**: Decisions, approaches, blockers, gotchas
5. **AgentPay-Specific Context**:
   - Which phase/milestone from implementation plan
   - Which skills were referenced
   - Success criteria status
   - Integration points touched
   - Dependencies discovered

## Analysis Process

### Step 1: Identify Original Task

Look back through the conversation to find the initial request. Ignore:
- Side tasks that emerged
- Questions asked along the way
- Discussion tangents
- Debugging sessions (unless that WAS the original task)

Extract: The core objective the user started with.

### Step 2: Catalog Completed Work

Be specific:
- ✅ "Implemented PIX adapter" → ❌ Too vague
- ✅ "Implemented PIX adapter in server/polar/payment_orchestration/rails/pix/adapter.py:1-156, including QR code generation and cost calculation" → ✅ Specific

Include:
- File paths with line numbers
- Function/class names
- Tests written
- Configurations added
- Database migrations (if any)

### Step 3: List Remaining Work

What's left to complete the ORIGINAL task (not new ideas):
- Unfinished features
- Missing tests
- Incomplete documentation
- Integration work
- Deployment steps

Be clear if task is complete: "Original task is complete. No remaining work."

### Step 4: Capture Critical Context

**Technical Decisions**:
- "Chose PagSeguro over MercadoPago due to lower fees for transactions <R$1000"
- "Using SHA-256 HMAC for webhook signatures, not MD5"
- "QR codes must be 512x512 for mobile scanning"

**Blockers/Gotchas**:
- "PIX API rate limit is 100 req/min, need to implement backoff"
- "Webhook timestamps must be within 300 seconds or validation fails"
- "Sandbox environment doesn't support all production features"

**Approaches Chosen**:
- "Implemented adapter pattern per .claude/skills/payment-orchestration.md"
- "Using Redis for caching QR codes (15min TTL)"
- "Webhook handler runs as background job via Dramatiq"

**Dependencies**:
- "Requires orchestration framework (completed in previous session)"
- "Blocked on PIX_API_KEY from ops team"
- "Need database migration before integration tests will pass"

### Step 5: Add AgentPay Context

**Phase/Milestone Progress**:
```
Phase 2, Milestone 2.2: PIX Integration
Progress: 75% → 85% (this session)
Remaining for milestone: Integration tests, production config
```

**Skills Referenced**:
- `.claude/skills/payment-orchestration.md` (adapter pattern, fallback handling)
- `.claude/skills/api-integration.md` (PIX section)

**Success Criteria Status**:
From AGENTPAY_IMPLEMENTATION_PLAN.md:
- ✅ Payment creation < 1s (measured: 0.4s)
- ✅ QR code generation working
- ⏳ Webhook reliability 99.9% (needs more testing)

**Integration Points**:
- Modified: `server/polar/payment_orchestration/service.py` to register PIX rail
- Integrated with: Existing orchestration framework
- Next integration: Will be used by conversational payment flows (Phase 3)

**New Learnings**:
- PIX QR codes should be 512x512 for mobile scanning
- Webhook retry logic needed for intermittent failures
- Consider updating `.claude/skills/api-integration.md` with these findings

## Output Format

Generate `WHATS-NEXT.md` with the following structure:

```markdown
# AgentPay Work Handoff

**Generated**: [YYYY-MM-DD HH:MM]
**Session Duration**: [hours/minutes]
**Phase**: [Phase N, Milestone N.N]
**Component**: [messaging | intent | orchestration | conversational | trust | context]

---

## Original Task

[Clear statement of what was initially requested]

[Context: why this task matters, which milestone it relates to]

---

## Work Completed

### Implementation

**Files Created**:
- `[path/to/file.py:lines]` - [Purpose]
- `[path/to/file.py:lines]` - [Purpose]

**Files Modified**:
- `[path/to/file.py:lines]` - [What changed]
- `[path/to/file.py:lines]` - [What changed]

**Key Functions/Classes**:
- `ClassName.method_name()` in `[file:line]` - [Purpose]
- `function_name()` in `[file:line]` - [Purpose]

**Tests Written**:
- `[test_file.py]` - [Coverage description]
- [N] tests, [N] passing, [N] failing (if any)
- Coverage: [percentage]

**Database Changes**:
- Migrations: [describe if applicable]
- Tables modified: [list]

**Configuration**:
- Environment variables added: [list]
- Settings modified: [list]

### Integration

**Integrated With**:
- [Existing module/service]: [How it integrates]

**APIs Configured**:
- [External service]: [Setup status]

---

## Work Remaining

### To Complete Original Task

**Must Do**:
1. [Critical remaining task]
   - Location: [file:line if applicable]
   - Estimated effort: [XS|S|M|L|XL]

2. [Another critical task]

**Should Do**:
- [Important but not blocking]

**Nice to Have**:
- [Optional improvements]

**Blockers**:
- ❌ [Description of blocker]
  - Blocked by: [team/person/external factor]
  - Workaround: [if any]

### Task Completion Status

- [ ] Implementation complete
- [ ] Tests passing (all)
- [ ] Documentation updated
- [ ] Code review ready
- [ ] Integration tested
- [ ] Success criteria met

**Estimated Time to Completion**: [hours/days]

---

## Technical Context

### Decisions Made

**Architecture**:
- [Key architectural decision and rationale]

**Technology Choices**:
- [Technology chosen]: [Why]

**Patterns Used**:
- [Pattern]: [Reference to skill document]

### Approaches Chosen

**Implementation Strategy**:
- [Describe the approach taken]
- [Why this approach vs alternatives]

**Testing Strategy**:
- [Types of tests written]
- [Coverage targets and current status]

### Gotchas Discovered

⚠️ **Important**:
- [Critical gotcha]: [How to handle]

⚠️ **Watch Out**:
- [Thing to be careful about]

### Performance Considerations

- [Metric]: [Current value] (target: [target value])
- [Optimization applied]: [Result]

---

## AgentPay-Specific Context

### Milestone Progress

**Phase [N], Milestone [N.N]**: [Milestone Name]
- **Before this session**: [%] complete
- **After this session**: [%] complete
- **Remaining for milestone**: [tasks]

**Overall Phase [N] Progress**: [%] → [%]

### Skills Referenced

Reviewed/applied patterns from:
- `.claude/skills/[skill-name].md` - [Which sections/patterns]
- `.claude/prompts/development-guidelines.md` - [Which standards]

### Success Criteria Status

From `AGENTPAY_IMPLEMENTATION_PLAN.md`:

| Criterion | Target | Current | Status |
|-----------|--------|---------|--------|
| [Metric] | [Value] | [Value] | ✅/⏳/❌ |

### Integration Points

**Touched/Modified**:
- [Module/service]: [How it was modified]

**Ready for Integration**:
- [What's ready]: [What can use this now]

**Pending Integration**:
- [What needs integration]: [When/how]

### Dependencies

**Requires**:
- [Dependency]: [Status: ✅ met / ⏳ in progress / ❌ blocked]

**Enables**:
- [What this work enables]: [When available]

### New Learnings

**Technical Insights**:
- [Insight gained during implementation]

**Process Improvements**:
- [Better way to do something]

**Documentation Updates Needed**:
- [ ] Update `.claude/skills/[skill].md` with [learning]
- [ ] Update implementation plan with [adjustment]

---

## Environment Setup

**Required Environment Variables**:
```bash
[VAR_NAME]=[example value or "see ops team"]
```

**Configuration Files**:
- `[file path]`: [What needs to be configured]

**External Services**:
- [Service]: [Setup status, credentials location]

**Database State**:
- Migrations pending: [list or "none"]
- Seed data needed: [yes/no, which data]

---

## Next Session Checklist

To resume this work:

1. **Read This Document** 📖
   - [ ] Understand original task
   - [ ] Review completed work
   - [ ] Note blockers and gotchas

2. **Verify Environment** ⚙️
   - [ ] Environment variables set
   - [ ] Dependencies installed
   - [ ] Services running (DB, Redis, etc.)

3. **Pull Latest Code** 🔄
   - [ ] Git pull (if team environment)
   - [ ] Review recent commits

4. **Review Context** 📚
   - [ ] Re-read referenced skills
   - [ ] Check implementation plan milestone

5. **Continue Work** 🚀
   - [ ] Start with highest priority remaining task
   - [ ] Reference technical decisions made
   - [ ] Watch out for documented gotchas

---

## Quick Resume Prompt

**For next session**, use this prompt:

```
Continue AgentPay [task name] work based on WHATS-NEXT.md.

Focus on: [highest priority remaining task]

Key context:
- [Most critical decision/gotcha to remember]
- [File/function to start with]
```

---

## Additional Notes

[Any other context that doesn't fit above categories but is important]

---

## Related Files

- **Implementation Plan**: `AGENTPAY_IMPLEMENTATION_PLAN.md` (Phase [N], Milestone [N.N])
- **Skills**: `.claude/skills/[relevant-skill].md`
- **Todos**: `TO-DOS.md` (check for related items)
- **Prompts**: `.prompts/[relevant-prompt].md` (if applicable)

---

**End of Handoff Document**

✅ This document should contain everything needed to continue the work seamlessly.

If resuming in a new conversation:
1. Read this document thoroughly
2. Use the "Quick Resume Prompt" above
3. Reference the skills and plan as needed
4. Continue where we left off

Good luck! 🚀
```

## Generation Guidelines

**Be Specific**:
- Bad: "Worked on payment system"
- Good: "Implemented PIX adapter in server/polar/payment_orchestration/rails/pix/adapter.py:1-156"

**Be Honest About Status**:
- Don't overstate completion
- Clearly mark blockers
- Note partial implementations

**Capture WHY, not just WHAT**:
- "Chose X because Y" is more valuable than just "Using X"
- Explain trade-offs considered
- Document rationale for future reference

**Focus on Actionable**:
- Next session should know exactly what to do
- Blockers should have clear resolution paths
- Gotchas should have handling instructions

## Special Cases

### If Task is Complete
```markdown
## Work Remaining

**Original task is complete.** ✅

All success criteria met:
- ✅ [Criterion 1]
- ✅ [Criterion 2]

**Possible Next Steps**:
1. Move to next milestone: [Milestone name]
2. Address related todos in TO-DOS.md
3. Improve/optimize completed work
```

### If Blocked Completely
```markdown
## Work Remaining

**Work is currently blocked.** ❌

**Blocker**: [Clear description]
**Blocked by**: [Team/person/external factor]
**Impact**: Cannot proceed until resolved
**Workaround**: [If any]

**Estimated Resolution**: [timeline if known]

**While Blocked, Could Work On**:
- [Alternative task from same milestone]
- [Different milestone task]
```

### If Significant Scope Change
```markdown
## Original Task

[Original request]

**Note**: Scope evolved during implementation. [Explanation]

**Adjusted Objective**: [New objective]
**Reason**: [Why scope changed]
**Approved**: [By whom/when, or note if needs approval]
```

## After Generation

1. **Save to `WHATS-NEXT.md`** in project root

2. **Show summary**:
```
✅ Generated WHATS-NEXT.md

**Session Summary**:
- Original Task: [brief description]
- Completion: [%]
- Files created/modified: [N]
- Tests: [N] written, [N] passing
- Milestone progress: [X%] → [Y%]

**Key Takeaways**:
- ✅ [Major accomplishment]
- ⚠️ [Critical gotcha to remember]
- 🚧 [Main blocker if any]

**Next Session Should**:
1. [Highest priority task]
2. [Second priority]

Document ready for handoff! 📄
```

3. **Offer to commit**:
```
Save WHATS-NEXT.md to git?

This helps track progress and enables team handoffs.

[Yes - commit] [No - keep local]
```

## Integration with AgentPay Workflow

**End of Long Session**:
```
Conversation getting long? Time for handoff.

/agentpay-handoff

→ Creates WHATS-NEXT.md
→ Start fresh conversation
→ Paste: "Continue based on WHATS-NEXT.md"
```

**End of Work Day**:
```
/agentpay-handoff

→ Perfect handoff for next day or next engineer
→ Zero context loss
→ Clear continuation path
```

**Before Code Review**:
```
/agentpay-handoff

→ Provides reviewers with full context
→ Explains decisions and trade-offs
→ Shows what's done and what's not
```

## Remember

- **Completeness > Brevity**: Better too much info than too little
- **Specific > General**: File paths and line numbers matter
- **Honest > Optimistic**: Admit unknowns and blockers
- **Actionable > Descriptive**: Next session should know what to DO

Your handoff document should be so good that work can continue seamlessly without any conversation history.
