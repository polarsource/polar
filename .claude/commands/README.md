# AgentPay Claude Code Commands

This directory contains custom slash commands for AgentPay development, built on the TÂCHES prompting patterns with AgentPay-specific enhancements.

## Available Commands

### `/add-to-agentpay-todos`

Enhanced todo management with rich context and AgentPay metadata.

**Usage**:
```
/add-to-agentpay-todos "Refactor KYC service to support async verification"
```

**Features**:
- Priority levels (P0-P3)
- Phase/milestone tagging
- Component categorization
- Effort estimation
- Full technical context (file paths, line numbers, errors)
- Duplicate detection
- Auto-extraction from conversation

**Output**: Saves to `TO-DOS.md` in project root

**Example Entry**:
```markdown
## 2024-01-15 14:32 | P1 | Phase 2 | orchestration | M

### Implement fallback handling for payment rail failures
- **Problem**: When PIX is down, orchestration fails instead of falling back to Stripe
- **Location**: server/polar/payment_orchestration/service.py:156-180
- **Context**: Discovered during PIX integration testing. Need circuit breaker pattern.
- **Solution Hint**: Track rail health, add fallback logic in select_optimal_rail()
- **Related**: .claude/skills/payment-orchestration.md (Fallback Handling)
```

---

### `/agentpay-prompt`

Meta-prompting for AgentPay with automatic context integration.

**Usage**:
```
/agentpay-prompt "Implement PIX payment rail adapter"
```

**Features**:
- Auto-loads project context
- References relevant skills
- Applies coding standards
- Links to implementation plan milestones
- Generates structured XML prompts
- Supports single/parallel/sequential execution strategies

**Output**: Saves to `.prompts/phaseN-NNN-description.md`

**Workflow**:
1. Clarifies requirements
2. Identifies relevant skills and standards
3. Checks implementation plan for success criteria
4. Generates optimized prompt(s)
5. Recommends execution strategy

---

### `/run-agentpay-prompt`

Execute prompts with sub-agents and track milestone progress.

**Usage**:
```
# Single prompt
/run-agentpay-prompt 011
/run-agentpay-prompt pix-integration
/run-agentpay-prompt latest

# Multiple prompts
/run-agentpay-prompt 11 12 13 --sequential
/run-agentpay-prompt 20 21 22 --parallel
```

**Features**:
- Single/parallel/sequential execution
- Milestone progress tracking
- Success criteria validation
- Automatic archiving of completed prompts
- Git commit suggestions
- Integration with implementation plan

**Output**:
- Executes prompts via Task tool
- Updates `.prompts/MILESTONE_PROGRESS.md`
- Archives to `.prompts/archive/YYYY-MM/`
- Shows structured summary with metrics

---

### `/agentpay-handoff`

Generate comprehensive handoff document for work continuity.

**Usage**:
```
/agentpay-handoff
```

**Features**:
- Analyzes conversation for original task
- Documents completed work (files, tests, decisions)
- Lists remaining work and blockers
- Captures technical context and gotchas
- Tracks milestone progress
- Includes AgentPay-specific context (skills, success criteria)
- Provides quick resume prompt

**Output**: Saves to `WHATS-NEXT.md` in project root

**Use When**:
- Long conversation approaching token limits
- End of work day/shift handoff
- Switching between projects
- Preparing for code review
- Onboarding team member to in-progress work

---

## Quick Start

### 1. First Time Setup

```bash
# Install commands (already in repo)
# Commands are project-specific in .claude/commands/

# Create required directories
mkdir -p .prompts
touch TO-DOS.md

# Install TÂCHES base commands (optional, for baseline features)
mkdir -p ~/.claude/commands
cd ~/.claude/commands
git clone https://github.com/glittercowboy/taches-cc-prompts.git
cp taches-cc-prompts/*/*.md .
```

### 2. Typical Development Workflow

**Starting a new feature**:
```
/agentpay-prompt "Implement WhatsApp message adapter"

→ Creates optimized prompt
→ References skills and standards
→ Links to implementation plan

/run-agentpay-prompt latest

→ Executes with sub-agent
→ Tracks milestone progress
→ Archives on completion
```

**Discovering technical debt**:
```
/add-to-agentpay-todos "Optimize intent classification cache eviction"

→ Captures with full context
→ Returns to current work
→ Todo saved for later
```

**End of session**:
```
/agentpay-handoff

→ Generates WHATS-NEXT.md
→ Documents everything for next session
→ Start fresh conversation tomorrow
```

**Resume next session**:
```
"Continue AgentPay work based on WHATS-NEXT.md"

→ Claude reads handoff
→ Continues seamlessly
→ Zero context loss
```

---

## Integration with AgentPay Workflow

### With Implementation Plan

Commands are tightly integrated with `AGENTPAY_IMPLEMENTATION_PLAN.md`:

- `/agentpay-prompt` checks plan for success criteria
- `/run-agentpay-prompt` tracks milestone completion %
- `/add-to-agentpay-todos` tags by phase/milestone
- `/agentpay-handoff` shows phase progress

### With Skills System

Commands automatically reference `.claude/skills/`:

- `/agentpay-prompt` includes relevant skills in prompts
- `/add-to-agentpay-todos` can link to skill sections
- `/agentpay-handoff` notes which skills were used

### With Development Guidelines

All commands enforce `.claude/prompts/development-guidelines.md`:

- Service/repository pattern
- Async/await requirements
- No direct session.commit()
- Testing standards
- Type hints

---

## Directory Structure

After using these commands, your project will have:

```
/home/user/flowpay/
├── .claude/
│   ├── commands/
│   │   ├── README.md (this file)
│   │   ├── add-to-agentpay-todos.md
│   │   ├── agentpay-prompt.md
│   │   ├── run-agentpay-prompt.md
│   │   └── agentpay-handoff.md
│   ├── skills/ (domain expertise)
│   └── prompts/ (project context)
│
├── .prompts/ (generated prompts)
│   ├── phase1-001-rule-based-classifier.md
│   ├── phase2-011-pix-integration.md
│   ├── MILESTONE_PROGRESS.md (auto-updated)
│   └── archive/
│       └── 2024-01/
│           └── (completed prompts)
│
├── TO-DOS.md (technical debt backlog)
├── WHATS-NEXT.md (work continuity)
└── AGENTPAY_IMPLEMENTATION_PLAN.md (roadmap)
```

---

## Command Comparison: AgentPay vs TÂCHES

| Feature | TÂCHES Base | AgentPay Enhanced |
|---------|-------------|-------------------|
| Todo capture | ✅ Basic | ✅ Priority, Phase, Component, Effort |
| Meta-prompting | ✅ Generic | ✅ Auto-loads AgentPay context |
| Prompt execution | ✅ Run prompts | ✅ + Milestone tracking, validation |
| Context handoff | ✅ Basic | ✅ + Phase progress, skills, metrics |
| Project integration | ❌ Generic | ✅ Deep AgentPay integration |
| Success criteria | ❌ Manual | ✅ From implementation plan |

**Bottom Line**: AgentPay commands build on TÂCHES patterns but add deep project integration.

---

## Best Practices

### When to Use Meta-Prompting

**Use `/agentpay-prompt` for**:
- Complex features (>4 hours)
- Multi-step implementations
- Features with many edge cases
- Work requiring extended thinking

**Don't use for**:
- Simple bug fixes
- Trivial changes
- Exploratory work
- Quick experiments

### When to Capture Todos

**Use `/add-to-agentpay-todos` for**:
- Technical debt discovered mid-implementation
- Future optimizations
- Bugs that aren't blocking
- Features for later phases

**Don't capture**:
- Immediate next steps (just do them)
- Current task subtasks (part of current work)
- Vague ideas (refine first)

### When to Create Handoffs

**Use `/agentpay-handoff` when**:
- Conversation >20,000 tokens
- End of work session
- Handing off to team member
- Switching projects
- Preparing for review

**Don't create**:
- After every small task
- For trivial changes
- Mid-implementation (unless switching context)

---

## Tips & Tricks

### Efficient Prompt Naming

```bash
# Good naming
phase2-011-pix-integration.md           # Clear phase, numbered, descriptive
phase3-020-whatsapp-invoice-flow.md     # Component and feature

# Bad naming
prompt-1.md                              # No context
fix-bug.md                               # Too vague
the-pix-thing-we-talked-about.md        # Unprofessional
```

### Organizing Todos by Sprint

```bash
# Filter TO-DOS.md by priority and phase
grep "P0.*Phase 2" TO-DOS.md   # Critical items for Phase 2
grep "Phase 3.*orchestration" TO-DOS.md  # Phase 3 orchestration todos
```

### Reusing Prompts

Archive successful prompts for similar future work:

```bash
# Copy and modify for similar feature
cp .prompts/archive/2024-01/phase2-011-pix-integration.md \
   .prompts/phase2-015-payto-integration.md

# Update for new payment rail
# Similar structure, different specifics
```

---

## Troubleshooting

### Command Not Found

```bash
# Verify command exists
ls .claude/commands/

# Commands must be in repo .claude/commands/ (project-specific)
# OR in ~/.claude/commands/ (global)
```

### Prompt Execution Fails

```
❌ Task execution failed

**Common Causes**:
- Missing environment variables
- Dependencies not installed
- Database not running
- Incorrect file paths in prompt

**Debug**:
1. Check prompt requirements section
2. Verify environment setup
3. Review error message
4. Fix issue and retry
```

### Todos Not Saving

```
**Check**:
- TO-DOS.md exists in project root
- File is writable
- Not a git permissions issue

**Fix**:
touch TO-DOS.md
chmod 644 TO-DOS.md
```

---

## Advanced Usage

### Parallel Prompt Execution

For independent tasks:

```
# Create prompts for independent messaging platforms
/agentpay-prompt "Implement WhatsApp adapter"
/agentpay-prompt "Implement Slack adapter"
/agentpay-prompt "Implement Telegram adapter"

# Execute all in parallel (3x faster)
/run-agentpay-prompt 20 21 22 --parallel

→ All run simultaneously
→ Results combined
→ Massive time savings
```

### Sequential with Dependencies

For dependent tasks:

```
# Create sequential prompts
/agentpay-prompt "Implement orchestration framework"
/agentpay-prompt "Implement PIX adapter (requires framework)"
/agentpay-prompt "Implement multi-rail selection (requires adapters)"

# Execute sequentially (respects dependencies)
/run-agentpay-prompt 10 11 12 --sequential

→ Each waits for previous
→ Stops on failure
→ Safe for dependencies
```

### Custom Prompt Templates

Create reusable prompt templates in `.prompts/templates/`:

```markdown
<!-- .prompts/templates/payment-rail-adapter.md -->

<objective>
Implement [RAIL_NAME] payment rail adapter for AgentPay...
</objective>

[Template with placeholders]
```

Copy and fill in for new rails.

---

## Examples

See `.claude/TACHES_ANALYSIS.md` for:
- Detailed analysis of TÂCHES value for AgentPay
- Sample prompts for Phase 1 and Phase 2
- Cost-benefit analysis
- Implementation checklist

---

## Support

**Questions?**
- Review `.claude/README.md` for skills system overview
- Check `AGENTPAY_IMPLEMENTATION_PLAN.md` for roadmap
- See `.claude/TACHES_ANALYSIS.md` for detailed guide

**Issues?**
- Verify command files are present
- Check file permissions
- Ensure project structure exists (.prompts/, TO-DOS.md)

**Want to Improve?**
- Commands are markdown files - edit directly
- Add custom sections relevant to your workflow
- Share improvements with team

---

## Credits

**Base System**: [TÂCHES](https://github.com/glittercowboy/taches-cc-prompts) by glittercowboy
**AgentPay Enhancements**: Custom for AgentPay development workflow

**License**: Same as AgentPay project

---

**Ready to build AgentPay more efficiently?** Start with `/agentpay-prompt` for your next feature! 🚀
