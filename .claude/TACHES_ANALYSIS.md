# TÂCHES Prompting System Analysis for AgentPay

## Executive Summary

**Recommendation: HIGHLY VALUABLE - Adopt with AgentPay-specific customizations**

The TÂCHES prompting system provides three powerful patterns that would significantly enhance AgentPay development workflow:

1. ✅ **Meta-Prompting** - Engineer complex prompts for multi-step features
2. ✅ **Enhanced Todo Management** - Better context preservation than current TodoWrite
3. ✅ **Context Handoff** - Critical for 6-month project with multiple engineers

**Estimated Productivity Gain**: 20-30% reduction in context switching overhead and rework

---

## Deep Dive: What is TÂCHES?

TÂCHES is a collection of Claude Code slash commands that implement sophisticated prompting patterns:

- **Meta-Prompting**: Claude engineers its own prompts for complex tasks
- **Todo Management**: Capture technical debt with full context preservation
- **Context Handoff**: Generate structured handoff documents for session continuity

**Repository**: https://github.com/glittercowboy/taches-cc-prompts

---

## Component Analysis

### 1. Meta-Prompting System ⭐⭐⭐⭐⭐

**Commands**: `/create-prompt`, `/run-prompt`

#### How It Works

**Phase 1: Prompt Engineering** (`/create-prompt`)
- User describes desired outcome naturally
- Claude asks clarifying questions
- Claude generates structured, optimized prompts
- Prompts saved to `.prompts/NNN-descriptive-name.md`
- Uses XML tags: `<objective>`, `<context>`, `<requirements>`, `<output>`

**Phase 2: Execution** (`/run-prompt`)
- Spawns sub-agents with engineered prompts
- Supports single, parallel, or sequential execution
- Clean context windows for each task
- Automatic archiving on completion

#### Value for AgentPay

**🎯 Perfect For**:
- **Complex Features**: "Implement PIX payment rail with webhook handling"
- **Multi-Step Migrations**: Database schema changes across multiple tables
- **Refactoring**: "Refactor intent classification to use hybrid approach"
- **Integration Work**: "Add QuickBooks sync with bidirectional conflict resolution"

**Example Use Case**:
```
User: "Implement the payment orchestration rail selection algorithm"

/create-prompt
→ Claude asks about cost vs speed weighting, fallback strategies,
  compliance requirements
→ Generates 3 prompts:
  001-implement-cost-calculator.md
  002-implement-rail-scoring.md
  003-implement-selection-engine.md

/run-prompt --sequential
→ Executes in order with clean contexts
→ Each step can use extended thinking for complex logic
```

**Advantages Over Direct Implementation**:
- ✅ Better task decomposition
- ✅ More thorough consideration of edge cases
- ✅ Cleaner context windows (no conversation noise)
- ✅ Reusable prompts for similar future work
- ✅ Built-in verification steps

**Recommendation**: **ADOPT IMMEDIATELY**

This is perfect for AgentPay's complexity. The implementation plan has 100+ discrete tasks that would benefit from this approach.

---

### 2. Enhanced Todo Management ⭐⭐⭐⭐

**Commands**: `/add-to-todos`, `/check-todos`

#### How It Works

**Adding Todos** (`/add-to-todos`)
- Captures task with full technical context
- Requires: action verb, problem statement, file paths with line numbers, solution hints
- Prevents duplicates by searching existing todos
- Extracts context from conversation history if not provided explicitly
- Saves to `TO-DOS.md` in project root

**Example Todo Entry**:
```markdown
## 2024-01-15 14:32

### Fix payment webhook signature verification
- **Problem**: PIX webhooks failing signature validation intermittently
- **Location**: `server/polar/payment_orchestration/rails/pix/webhook_handler.py:45`
- **Context**: Error occurs when timestamp drift > 5 minutes
- **Solution Hint**: Use more lenient timestamp tolerance or NTP sync
```

**Checking Todos** (`/check-todos`)
- Reads and displays all pending todos
- Preserves full context for resumption
- Can filter by component or date

#### Value for AgentPay

**🎯 Perfect For**:
- **Mid-Implementation Discoveries**: "This fraud rule needs refactoring" (during payment work)
- **Bug Tracking**: Capture with exact file/line context
- **Technical Debt**: Note performance optimizations for later
- **Cross-Feature Dependencies**: "Need to update accounting sync when we add PayTo"

**Advantages Over Current TodoWrite**:
- ✅ **Richer Context**: File paths, line numbers, error messages
- ✅ **Duplicate Prevention**: Won't create redundant todos
- ✅ **Conversation Extraction**: Auto-extracts from recent discussion
- ✅ **Better Format**: Markdown file vs tool state
- ✅ **Persistent**: Survives conversation resets

**Comparison**:

| Feature | Current TodoWrite | TÂCHES add-to-todos |
|---------|-------------------|---------------------|
| Context preservation | Task name only | Full technical context |
| File references | No | Yes (with line numbers) |
| Duplicate detection | No | Yes |
| Persistence | Session-based | File-based |
| Searchability | Poor | Good (grep-able) |
| Team sharing | No | Yes (git tracked) |

**Recommendation**: **ADOPT AND EXTEND**

Replace current todo tracking with TÂCHES pattern, but customize for AgentPay:
- Add priority levels (P0-P3)
- Add milestone tags (Phase 1, Phase 2, etc.)
- Add component tags (orchestration, intent, trust, etc.)

---

### 3. Context Handoff ⭐⭐⭐⭐⭐

**Command**: `/whats-next`

#### How It Works

Analyzes conversation and generates `whats-next.md` with:

```xml
<original_task>
What was initially requested (not scope creep)
</original_task>

<work_completed>
- Specific accomplishments with file paths
- Features implemented
- Tests written
</work_completed>

<work_remaining>
- What's left to finish the original task
- Blockers or dependencies
</work_remaining>

<context>
- Key decisions made and why
- Approaches chosen
- Gotchas discovered
- Important line numbers or function names
</context>
```

#### Value for AgentPay

**🎯 Critical For**:
- **Long Token Conversations**: When approaching context limits
- **Shift Handoffs**: Engineer finishing day hands off to next engineer
- **Cross-Day Work**: Resume exactly where you left off
- **Code Reviews**: Provide reviewers with full context
- **Onboarding**: New team members can understand work-in-progress

**Example Scenario**:

Day 1: Implementing PIX integration, conversation gets long
```
/whats-next

→ Generates:
  - Original task: Implement PIX payment rail
  - Completed: QR code generation, basic adapter, 80% of tests
  - Remaining: Webhook handling, error cases, integration test
  - Context: Using PagSeguro API (not MercadoPago due to fee structure),
    webhook signature uses SHA-256 HMAC, timestamps must be within
    300 seconds
```

Day 2: New conversation, paste whats-next.md
```
"Continue PIX implementation based on whats-next.md"

→ Claude has full context, continues seamlessly
```

**Advantages**:
- ✅ Zero knowledge loss across sessions
- ✅ Structured format (easy to parse)
- ✅ Prevents scope creep documentation
- ✅ Git-trackable progress records

**Recommendation**: **ESSENTIAL FOR 6-MONTH PROJECT**

With 24 weeks and multiple engineers, context handoff is critical. This prevents:
- Rework due to lost context
- Inconsistent implementation decisions
- Forgotten edge cases
- Integration issues from miscommunication

---

## Implementation Recommendations

### Phase 1: Immediate Adoption (This Week)

1. **Install TÂCHES Commands**
   ```bash
   mkdir -p ~/.claude/commands
   cd ~/.claude/commands

   # Clone TÂCHES repo
   git clone https://github.com/glittercowboy/taches-cc-prompts.git

   # Copy commands
   cp taches-cc-prompts/meta-prompting/*.md .
   cp taches-cc-prompts/todo-management/*.md .
   cp taches-cc-prompts/context-handoff/*.md .
   ```

2. **Create AgentPay Project Structure**
   ```bash
   cd /home/user/flowpay
   mkdir -p .prompts
   touch TO-DOS.md
   ```

3. **Test Drive**
   - Try `/create-prompt` for next implementation task
   - Use `/add-to-todos` to capture any current technical debt
   - Create first `/whats-next` at end of current session

### Phase 2: AgentPay-Specific Customizations (Week 2)

Create enhanced versions in `.claude/commands/`:

#### 1. Enhanced `/add-to-agentpay-todos`

```markdown
# add-to-agentpay-todos.md

Enhanced todo management for AgentPay with:
- Priority levels (P0: Critical, P1: High, P2: Medium, P3: Low)
- Milestone tags (Phase 0-6 from implementation plan)
- Component tags (messaging, intent, orchestration, trust, context)
- Effort estimates (XS, S, M, L, XL)

Format:
```
## 2024-01-15 14:32 | P1 | Phase 2 | orchestration | M

### [Action] [Component]
- **Problem**: [Description]
- **Location**: [File:line]
- **Context**: [Technical details]
- **Solution Hint**: [Approach]
- **Related Issues**: [Links to other todos/issues]
```

Benefits:
- Filterable by priority/phase/component
- Easy to plan sprints (group by phase + priority)
- Effort estimation for scheduling
```

#### 2. Create `/agentpay-prompt`

```markdown
# agentpay-prompt.md

AgentPay-specific meta-prompting with:
- Pre-loaded context from .claude/prompts/agentpay-context.md
- Automatic reference to relevant skills
- Integration with implementation plan milestones
- Coding standards from development-guidelines.md

Workflow:
1. User describes task
2. Claude identifies relevant phase/milestone from implementation plan
3. Claude references appropriate skills (payment-orchestration, intent-recognition, etc.)
4. Claude applies AgentPay coding standards automatically
5. Generates prompt with success criteria from implementation plan
```

#### 3. Create `/agentpay-handoff`

```markdown
# agentpay-handoff.md

Enhanced context handoff for AgentPay with:
- Milestone progress tracking
- Links to relevant skills/documentation
- Updated success metrics
- API integration status
- Database migration status

Additional sections:
- **Milestone Progress**: % complete for current phase
- **Skills Referenced**: Which skills were used
- **New Learnings**: Updates needed to skills/docs
- **Metrics**: Updated KPIs (if applicable)
- **Integration Status**: Which external services are configured
```

### Phase 3: Integration with Implementation Plan (Ongoing)

**Create Prompts for Each Milestone**

For each milestone in the implementation plan, pre-create meta-prompts:

```
.prompts/
├── phase-1/
│   ├── 001-basic-intent-classification.md
│   ├── 002-llm-classifier.md
│   ├── 003-hybrid-classifier.md
│   └── ...
├── phase-2/
│   ├── 010-orchestration-framework.md
│   ├── 011-pix-integration.md
│   └── ...
└── ...
```

**Benefits**:
- Pre-planned approach for each milestone
- Consistent quality across features
- Easy to parallelize work (multiple engineers)
- Reusable for similar future features

---

## Specific Use Cases for AgentPay

### Use Case 1: Implementing Intent Recognition (Phase 1)

**Traditional Approach**:
```
"Implement the intent classification system with rule-based
and LLM classifiers. Follow the skills document."

→ Claude asks questions, implements in same context
→ Context gets long and noisy
→ May miss edge cases or testing requirements
```

**TÂCHES Approach**:
```
/create-prompt "Implement intent classification system
per .claude/skills/intent-recognition.md"

→ Claude asks clarifying questions
→ Generates 3 prompts:
  001-rule-based-classifier.md (with specific patterns)
  002-llm-classifier-with-claude.md (with prompt engineering)
  003-hybrid-routing-and-caching.md (with performance targets)

/run-prompt --sequential

→ Each runs in clean context
→ Extended thinking for complex logic
→ Full test coverage
→ Proper error handling
```

**Result**: Higher quality, better tested, cleaner implementation

### Use Case 2: Cross-Day Payment Orchestration Work

**Day 1** (4 hours of work):
```
Implement PIX adapter...
[Long conversation, implemented 70%]

/whats-next

whats-next.md:
- Original: Implement PIX payment rail adapter
- Completed: PagSeguro client, QR generation, basic adapter,
  70% test coverage
- Remaining: Webhook handling, error cases, webhook signature
  verification, integration with orchestration service
- Context: Using PagSeguro (cheaper than MercadoPago for
  <R$1000 transactions), webhook signature is SHA-256 HMAC
  with API key, QR codes expire after 15min
```

**Day 2** (new session):
```
"Continue PIX implementation based on whats-next.md"

→ Claude reads file, understands exactly where we are
→ Implements webhook handler with correct signature verification
→ Completes remaining tests
→ Integrates with orchestration service
→ No rework, no missed context
```

**Time Saved**: ~1 hour of context rebuilding and clarification

### Use Case 3: Discovering Technical Debt Mid-Implementation

**Scenario**: Implementing fraud detection, notice KYC service needs refactoring

**Traditional**:
```
"Also, the KYC service should be refactored..."
→ Context switches
→ Might forget fraud detection state
→ Or create new conversation, lose fraud context
```

**TÂCHES**:
```
/add-to-todos "Refactor KYC service to support async
document verification"

→ Captures with context:
  - Problem: Current KYC service is synchronous, blocks payment flow
  - Location: server/polar/trust/compliance/kyc_service.py:78
  - Context: Discovered while implementing fraud detection,
    Onfido API is async but we're blocking
  - Solution: Convert to async with webhook callbacks

→ Returns to fraud detection work immediately
→ Todo persisted with full context for later
```

**Benefit**: Stay focused, don't lose context, capture debt properly

### Use Case 4: Team Collaboration on Multi-Phase Feature

**Scenario**: Two engineers working on conversational payments

**Engineer A** (WhatsApp integration):
```
Implements WhatsApp adapter and message router...
[End of day]

/whats-next

→ whats-next-whatsapp.md created
```

**Engineer B** (Payment flows):
```
Reads whats-next-whatsapp.md

Understands:
- WhatsApp adapter is complete
- Message router handles incoming messages
- Confirmation requests work with buttons
- QR code sending is implemented

Implements payment flows with confidence, knows what's available
```

**Benefit**: Zero integration surprises, clear handoff

---

## Cost-Benefit Analysis

### Setup Cost
- **Time**: 2-4 hours
  - 30 min: Install TÂCHES commands
  - 1 hour: Test drive on sample tasks
  - 1-2 hours: Create AgentPay customizations
  - 30 min: Team training

- **Learning Curve**: Minimal
  - Commands are intuitive
  - Documentation is clear
  - ROI visible immediately

### Benefits (Quantified)

**For 6-Month Project with 3-5 Engineers**:

| Benefit | Estimated Savings | Calculation |
|---------|-------------------|-------------|
| Reduced context switching | 2 hrs/week/engineer | 4 engineers × 24 weeks × 2 hrs = 192 hrs |
| Fewer context rebuilds | 1 hr/day/engineer | 4 engineers × 120 days × 1 hr = 480 hrs |
| Better task decomposition | 15% less rework | ~200 hrs over project |
| Improved quality (fewer bugs) | 10% less debugging | ~150 hrs over project |
| Better handoffs | 30 min/handoff | 100 handoffs × 0.5 hrs = 50 hrs |
| **Total Time Saved** | **~1,070 hours** | **~27 engineering weeks** |

**ROI**:
- Setup cost: 12-16 hours (3-4 engineers × 4 hours)
- Time saved: 1,070 hours
- **Return: 66x investment**

### Intangible Benefits

- ✅ Higher code quality from better planning
- ✅ Better documentation (prompts are docs)
- ✅ Easier onboarding (clear task structure)
- ✅ Reduced frustration (less rework)
- ✅ Better knowledge retention (context preserved)

---

## Risks and Mitigations

### Risk 1: Over-Engineering Simple Tasks

**Risk**: Creating prompts for trivial tasks wastes time

**Mitigation**:
- Use meta-prompting only for complex/multi-step tasks (>2 hours)
- Simple tasks: direct implementation
- Rule of thumb: If it needs extended thinking, use meta-prompting

### Risk 2: Prompt File Sprawl

**Risk**: `.prompts/` directory becomes cluttered and unmanageable

**Mitigation**:
- Archive completed prompts to `.prompts/archive/`
- Organize by phase/milestone
- Regular cleanup (monthly)
- Git-track for history

### Risk 3: Team Adoption Inconsistency

**Risk**: Some engineers use it, others don't, causes confusion

**Mitigation**:
- Make it optional but encouraged
- Show early wins to build adoption
- Lead by example (senior engineers use it)
- Include in onboarding docs

### Risk 4: Context Handoff Becomes Bureaucratic

**Risk**: `/whats-next` becomes overhead instead of value

**Mitigation**:
- Only use when necessary (long sessions, shift changes)
- Keep it lightweight (5-10 min max)
- Automate as much as possible
- Focus on actionable content, not ceremony

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Install TÂCHES commands globally
- [ ] Create `.prompts/` and `TO-DOS.md` in flowpay
- [ ] Test `/create-prompt` with sample task
- [ ] Test `/add-to-todos` with current technical debt
- [ ] Create first `/whats-next` at session end

### Week 2: Customization
- [ ] Create `/add-to-agentpay-todos` with enhanced format
- [ ] Create `/agentpay-prompt` with context integration
- [ ] Create `/agentpay-handoff` with milestone tracking
- [ ] Document commands in `.claude/commands/README.md`
- [ ] Train team on commands

### Week 3: Integration
- [ ] Pre-create prompts for Phase 1 milestones
- [ ] Add TÂCHES workflow to development guidelines
- [ ] Update implementation plan with prompt references
- [ ] Create prompt template library

### Ongoing
- [ ] Use `/whats-next` at end of each long session
- [ ] Use `/add-to-todos` for technical debt discovered
- [ ] Use `/create-prompt` for complex features (>2 hrs)
- [ ] Archive completed prompts monthly
- [ ] Review and improve custom commands quarterly

---

## Conclusion

**Bottom Line**: The TÂCHES prompting system is **highly valuable** for AgentPay development.

**Key Recommendations**:

1. ✅ **Adopt Immediately**: Install and start using this week
2. ✅ **Customize for AgentPay**: Create enhanced versions with project-specific context
3. ✅ **Integrate with Plan**: Pre-create prompts for implementation milestones
4. ✅ **Make it Standard**: Include in development guidelines and onboarding

**Expected Impact**:
- **Productivity**: +20-30% through reduced context overhead
- **Quality**: +15-25% through better planning and decomposition
- **Team Velocity**: Faster ramp-up, better collaboration
- **Developer Happiness**: Less frustration, more focus

**Next Steps**:
1. Install TÂCHES commands (30 min)
2. Test with next implementation task
3. Create AgentPay customizations
4. Update development guidelines
5. Train team

---

## Appendix: Sample Prompts for AgentPay

### Sample 1: Phase 1 - Intent Classification

```markdown
<!-- .prompts/phase-1/001-basic-intent-classification.md -->

<objective>
Implement rule-based intent classification for AgentPay conversational payments,
supporting 7 transaction intent types with >85% accuracy for common patterns.
</objective>

<context>
This is Phase 1, Milestone 1.1 of the AgentPay implementation plan. Intent
classification is the foundation for conversational payments - it must be fast
(<100ms), accurate, and handle Portuguese and English.

Reference: .claude/skills/intent-recognition.md
</context>

<requirements>
1. Support 7 intent types:
   - payment_promise ("I'll pay tomorrow")
   - invoice_request ("Send me an invoice")
   - payment_confirmation ("Payment sent")
   - split_request ("Let's split this")
   - approval ("Approved")
   - payment_inquiry ("Did you receive it?")
   - price_negotiation ("How about $50?")

2. Multi-language support:
   - Portuguese (BR) - priority
   - English

3. Pattern matching:
   - Regex patterns for common phrases
   - Confidence scoring (0-1)
   - Return confidence with classification

4. Performance:
   - <100ms latency
   - Cache common patterns

5. Testing:
   - >80% accuracy on test dataset
   - Cover edge cases
   - Test both languages
</requirements>

<implementation>
1. Create `server/polar/intent_recognition/classifiers/rule_based.py`

2. Implement `RuleBasedClassifier` class:
   - `classify(message: str, language: str) -> IntentResult`
   - Pattern dictionary for each language
   - Confidence calculation based on match strength

3. Add patterns for informal language:
   PT-BR: "vou pagar", "manda a cobrança", "paguei", "racha comigo"
   EN: "i'll venmo", "send invoice", "paid", "split it"

4. Create comprehensive test suite:
   - `tests/test_intent_recognition/test_rule_based.py`
   - Test each intent type
   - Test both languages
   - Test edge cases (ambiguous, multiple intents)

5. Performance optimization:
   - Compile regex patterns at init
   - Cache results (Redis) for common messages
   - Benchmark and ensure <100ms

6. Document pattern additions in docstrings
</implementation>

<output>
Files to create/modify:
- server/polar/intent_recognition/classifiers/rule_based.py
- server/polar/intent_recognition/schemas.py (IntentResult model)
- tests/test_intent_recognition/test_rule_based.py
- tests/test_intent_recognition/fixtures/messages.py (test data)

Success criteria:
- All tests pass
- >85% accuracy on test dataset
- <100ms latency (p95)
- Supports PT-BR and EN
- Code coverage >80%
</output>

<verification>
1. Run tests: `uv run task test tests/test_intent_recognition/`
2. Run benchmarks: Measure latency with 1000 sample messages
3. Verify accuracy: Test with real-world conversation samples
4. Code review: Ensure patterns are maintainable
</verification>
```

### Sample 2: Phase 2 - PIX Integration

```markdown
<!-- .prompts/phase-2/011-pix-integration.md -->

<objective>
Implement PIX payment rail integration for AgentPay, enabling instant BRL payments
with QR code generation, real-time status tracking, and webhook handling.
</objective>

<context>
Phase 2, Milestone 2.2. PIX is the highest priority payment rail (70% of Brazilian
transactions). Must be production-ready with sandbox and production modes.

Reference:
- .claude/skills/payment-orchestration.md
- .claude/skills/api-integration.md (PIX section)
</context>

<requirements>
1. PIX Provider Integration:
   - Research and select provider (PagSeguro, MercadoPago, or Ebanx)
   - Implement API client for chosen provider
   - Support sandbox and production modes

2. Features:
   - QR code generation (base64 image + copy-paste code)
   - Payment status checking
   - Webhook handling for real-time updates
   - 15-minute expiration handling

3. Adapter Implementation:
   - Implement PaymentRailAdapter interface
   - Cost calculation (typically 0.4%)
   - Rail capabilities (BRL only, instant settlement)

4. Security:
   - Webhook signature verification
   - API key management (environment variables)
   - Request/response validation

5. Testing:
   - Integration tests with sandbox
   - Mock for CI/CD
   - Webhook simulation
</requirements>

<implementation>
1. Provider Selection:
   - Compare PagSeguro, MercadoPago, Ebanx on:
     - Fees, API quality, documentation, sandbox availability
   - Document decision and reasoning

2. Create directory structure:
   ```
   server/polar/payment_orchestration/rails/pix/
   ├── __init__.py
   ├── client.py              # API client
   ├── adapter.py             # PaymentRailAdapter impl
   ├── webhook_handler.py     # Webhook processing
   └── schemas.py             # Pydantic models
   ```

3. Implement PIXClient (client.py):
   - `create_qr_code()` - Generate QR code
   - `check_payment_status()` - Check status
   - `setup_webhook()` - Register webhook URL
   - Handle API errors gracefully

4. Implement PIXAdapter (adapter.py):
   - Implement all PaymentRailAdapter methods
   - Cost calculation: amount * 0.004
   - Capabilities: BRL only, instant, no refunds

5. Implement webhook handler (webhook_handler.py):
   - FastAPI endpoint: POST /api/v1/webhooks/pix
   - Verify signature (HMAC-SHA256)
   - Update payment status in database
   - Trigger background job for notifications

6. Write comprehensive tests:
   - Unit tests for client, adapter
   - Integration tests with sandbox
   - Mock client for CI/CD
   - Webhook signature tests

7. Documentation:
   - API key setup instructions
   - Sandbox vs production configuration
   - Webhook URL configuration
</implementation>

<output>
Files to create:
- server/polar/payment_orchestration/rails/pix/client.py
- server/polar/payment_orchestration/rails/pix/adapter.py
- server/polar/payment_orchestration/rails/pix/webhook_handler.py
- server/polar/payment_orchestration/rails/pix/schemas.py
- tests/test_payment_orchestration/test_pix_adapter.py
- tests/mocks/pix_mock.py
- docs/integrations/PIX_SETUP.md

Environment variables:
- PIX_API_KEY
- PIX_SANDBOX (true/false)
- PIX_WEBHOOK_URL

Success criteria:
- QR code generation works in sandbox
- Payment status detection <5s
- Webhook handling 100% reliable
- All tests pass
- Integration tested end-to-end
</output>

<verification>
1. Manual testing in sandbox:
   - Generate QR code
   - Pay with PIX simulator
   - Verify webhook received
   - Verify status updated

2. Automated tests:
   - `uv run task test tests/test_payment_orchestration/`

3. Performance:
   - QR generation <1s
   - Webhook processing <500ms

4. Security:
   - Webhook signature validation works
   - Invalid signatures rejected
</verification>
```

---

These samples show how meta-prompting creates clear, executable specifications
that ensure consistent quality across the AgentPay implementation.
