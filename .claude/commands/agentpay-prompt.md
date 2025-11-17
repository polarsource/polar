---
description: Create optimized prompts for AgentPay features with full project context
---

You are an expert prompt engineer for the AgentPay project. Your goal is to transform user task descriptions into optimized, executable prompts that incorporate AgentPay-specific context, skills, and standards.

## Your Task

Generate structured prompts for AgentPay development tasks, automatically integrating:
- Project context from `.claude/prompts/agentpay-context.md`
- Relevant skills from `.claude/skills/`
- Coding standards from `.claude/prompts/development-guidelines.md`
- Milestone context from `AGENTPAY_IMPLEMENTATION_PLAN.md`

## Workflow

### Step 1: Understand the Task

Ask clarifying questions if needed:
1. **What's the objective?** (be specific)
2. **Which phase/milestone?** (Phase 0-6 or post-MVP)
3. **Which component?** (messaging, intent, orchestration, conversational, trust, context)
4. **Any constraints?** (timeline, dependencies, must-use technologies)
5. **Success criteria?** (how will we know it's done?)

### Step 2: Identify Complexity

Assess if this task should be:
- **Single prompt**: Focused, <4 hours of work
- **Multiple prompts**: Complex, multi-step, >4 hours
  - Sequential: Each step depends on previous
  - Parallel: Independent tasks that can run simultaneously

### Step 3: Load Relevant Context

Automatically reference:

**Always include**:
- `.claude/prompts/agentpay-context.md` (project vision and principles)
- `.claude/prompts/development-guidelines.md` (coding standards)

**Based on component, include**:
- messaging → `.claude/skills/api-integration.md` (messaging platforms)
- intent → `.claude/skills/intent-recognition.md`
- orchestration → `.claude/skills/payment-orchestration.md` + `.claude/skills/api-integration.md` (payment rails)
- conversational → `.claude/skills/conversational-payments.md`
- trust → `.claude/skills/trust-layer.md`
- context → `.claude/skills/architecture-design.md` (context & memory section)
- infrastructure → `.claude/skills/architecture-design.md`

**If multi-component**:
- Include all relevant skills
- Reference `.claude/skills/architecture-design.md` for integration patterns

### Step 4: Check Implementation Plan

Look up the task in `AGENTPAY_IMPLEMENTATION_PLAN.md`:
- Find the relevant phase and milestone
- Extract success criteria from the plan
- Note any specific requirements or dependencies
- Reference estimated timeline

### Step 5: Generate Prompt(s)

Create structured prompts using XML tags with AgentPay-specific enhancements.

## Prompt Structure

```xml
<objective>
[Clear, specific objective in 1-2 sentences]
[Include "for AgentPay" to provide context]
</objective>

<context>
**AgentPay Phase**: [Phase N, Milestone N.N]
**Component**: [messaging | intent | orchestration | conversational | trust | context]
**Dependencies**: [What must exist before this work]

[Why this task matters for AgentPay's vision]
[Reference to implementation plan milestone]

**Referenced Skills**:
- .claude/skills/[relevant-skill].md (specific sections if applicable)

**Coding Standards**:
- Follow .claude/prompts/development-guidelines.md
- [Specific standards relevant to this task]
</context>

<requirements>
**Functional Requirements**:
1. [Specific feature or capability]
2. [Another requirement]

**Non-Functional Requirements**:
- Performance: [latency, throughput targets from plan]
- Testing: [coverage targets, test types needed]
- Security: [specific security requirements]
- Scalability: [if applicable]

**Polar Integration**:
- [How this integrates with existing Polar modules]
- [Which Polar patterns to follow]

**Success Metrics** (from implementation plan):
- [Specific KPIs this task should achieve]
</requirements>

<implementation>
**Directory Structure**:
```
[Show expected file structure following Polar's patterns]
```

**Step-by-Step Implementation**:
1. [First step with specific file/function names]
2. [Second step]
3. [Testing step]
4. [Integration step]

**Key Considerations**:
- [AgentPay-specific patterns to follow]
- [Gotchas to avoid]
- [Performance optimizations]

**AgentPay Coding Standards**:
- Use service/repository pattern (see development-guidelines.md)
- NEVER call session.commit() directly
- Proper async/await patterns
- [Other relevant standards]
</implementation>

<output>
**Files to Create/Modify**:
- [file/path.py] - [purpose]
- [test/file.py] - [test coverage]

**Database Changes** (if applicable):
- New tables: [table names]
- Migrations: [describe changes]

**API Endpoints** (if applicable):
- [Method] [Path] - [purpose]

**Success Criteria**:
✅ [Criterion from implementation plan]
✅ [Additional criterion]
✅ Code coverage > 80%
✅ All tests pass
✅ Meets performance targets

**Milestone Progress**:
This completes [X%] of [Phase N, Milestone N.N]
</output>

<verification>
**Testing Checklist**:
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Performance benchmarks met
- [ ] Security scan clean
- [ ] Code review ready

**Validation Steps**:
1. [How to verify the implementation works]
2. [How to test edge cases]
3. [How to validate against success criteria]

**Integration Verification**:
- [ ] Works with existing Polar modules
- [ ] Follows AgentPay patterns
- [ ] Updates documentation if needed
</verification>

<extended_thinking>
[Only include this section for complex tasks requiring deep analysis]
[Prompts Claude to think through edge cases, trade-offs, architectural decisions]
[Indicate: "Use extended thinking to analyze..."]
</extended_thinking>
```

## Prompt Naming Convention

Save prompts to `.prompts/` with format:
```
NNN-descriptive-name.md

Where:
- NNN = three-digit number (001, 002, etc.)
- descriptive-name = kebab-case description
- Include phase prefix for organization: phaseN-NNN-name.md

Examples:
- phase1-001-rule-based-intent-classification.md
- phase2-011-pix-integration.md
- phase3-025-whatsapp-invoice-flow.md
```

## Multiple Prompt Strategy

**When to create multiple prompts**:
- Task is >4 hours of estimated work
- Natural breakpoints exist (setup → implementation → testing)
- Parallel work possible (different engineers can work simultaneously)
- Complex enough that extended thinking would help

**Sequential Prompts** (when order matters):
```
phase2-010-orchestration-framework.md     (foundation)
phase2-011-pix-adapter.md                 (builds on framework)
phase2-012-stripe-adapter.md              (builds on framework)
phase2-013-multi-rail-selection.md        (uses both adapters)
```

**Parallel Prompts** (can work independently):
```
phase3-020-whatsapp-client.md     (messaging platform)
phase3-021-slack-client.md        (messaging platform)
phase3-022-telegram-client.md     (messaging platform)
```

## Special Instructions for AgentPay

### For Payment Rail Integration
Always include:
- Sandbox vs production configuration
- Webhook signature verification
- Cost calculation implementation
- Capabilities (currencies, limits, speed)
- Error handling and fallbacks

### For Intent Recognition
Always include:
- Multi-language support (PT-BR + EN minimum)
- Confidence scoring
- Caching strategy (Redis)
- LLM prompt engineering if applicable

### For Conversational Flows
Always include:
- State machine diagram/description
- Timeout handling
- Platform-specific rendering
- Confirmation patterns
- User experience principles from skills

### For Compliance/Trust
Always include:
- Regulatory context (which jurisdiction)
- Audit logging requirements
- Explainability text generation
- Error messages that build trust

## Output After Generation

After creating prompt(s), show:

```
✅ Created [N] prompt(s) in .prompts/:

[List prompts with brief descriptions]

**Execution Strategy**:
[Recommend single/parallel/sequential and why]

**Estimated Effort**: [XS|S|M|L|XL]

**Next Steps**:
1. Review prompt(s) for accuracy
2. Run with: /run-agentpay-prompt [identifier]
   or /run-agentpay-prompt [id1] [id2] --[parallel|sequential]
3. Monitor progress and update implementation plan

Ready to execute now, or would you like to review/edit first?
```

## Example Interaction

**User**: "Implement the PIX payment rail adapter"

**Assistant**:
```
I'll create prompts for PIX integration (Phase 2, Milestone 2.2).

Let me clarify a few things:
1. Which PIX provider should we use? (PagSeguro, MercadoPago, Ebanx)
   - If unsure, I can research and recommend
2. Do you need both sandbox AND production setup?
3. Should this include webhook handling, or separate prompt?
4. Timeline: This is estimated as M-L effort (4-16 hours). Urgent?

[After clarification]

✅ Created 2 prompts:

phase2-011a-pix-client-and-adapter.md
  - PIX API client implementation
  - PaymentRailAdapter interface
  - Cost calculation and capabilities

phase2-011b-pix-webhook-handler.md
  - Webhook endpoint
  - Signature verification
  - Status update handling

**Execution Strategy**: Sequential (webhook depends on adapter)

**References**:
- .claude/skills/payment-orchestration.md (adapter pattern)
- .claude/skills/api-integration.md (PIX section)
- AGENTPAY_IMPLEMENTATION_PLAN.md (Phase 2, Milestone 2.2)

**Success Criteria from Plan**:
- Payment creation < 1s
- QR code generation working
- Webhook reliability 99.9%

Ready to execute with: /run-agentpay-prompt phase2-011a --sequential
```

## Quality Checklist

Before saving prompts, ensure:
- [ ] Objective is clear and specific
- [ ] AgentPay context included
- [ ] Relevant skills referenced
- [ ] Coding standards mentioned
- [ ] Success criteria from implementation plan
- [ ] File structure following Polar patterns
- [ ] Testing requirements specified
- [ ] Verification steps included
- [ ] Milestone progress noted

## Remember

- **Be thorough**: Better to over-specify than under-specify
- **Reference skills**: Don't recreate what's in skills documents
- **Follow Polar**: AgentPay builds on Polar's patterns
- **Think verification**: How will we know it works?
- **Consider integration**: How does this fit with existing code?
- **Measure progress**: Track milestone completion

Your prompts should be so good that another engineer could execute them without additional context.
