# Organization Review Eval

Eval and prompt optimization tools for the organization review agent.

## Quick Start

```bash
cd server

# 1. Extract cases from production (200 by default)
uv run python -m scripts.eval_organization_reviews extract \
  --db-uri "postgresql+asyncpg://user:pass@host/db"

# 2. Run eval with current prompt
uv run python -m scripts.eval_organization_reviews run

# 3. Optimize prompt with GEPA
uv run python -m scripts.eval_organization_reviews optimize --max-evals 50
```

All commands default to `cases.json` for input/output.

## Commands

### `extract`

Pulls human-reviewed cases from `organization_review_feedback` + `organization_agent_reviews`, ordered newest first. Builds a balanced dataset:

- **50%** false approvals (agent APPROVE, human DENY) — the dangerous case
- **25%** matches (agent and human agree)
- **25%** false denials (agent DENY, human APPROVE)

```bash
uv run python -m scripts.eval_organization_reviews extract \
  --db-uri "postgresql+asyncpg://..." \
  --total 100 \
  -o cases.json
```

### `run`

Re-runs the analyzer on each extracted case and compares the verdict to the human decision. Reports accuracy, false approvals/denials, and total cost.

```bash
uv run python -m scripts.eval_organization_reviews run -d cases.json --model gpt-4o
```

### `optimize`

Runs [GEPA](https://github.com/gepa-ai/gepa) evolutionary prompt optimization. Splits the dataset into train/val, evolves the system prompt to reduce false approvals, and saves the best prompt to a file.

Human reviewer reasoning is fed as reflective feedback so GEPA understands *why* the agent gets cases wrong.

```bash
uv run python -m scripts.eval_organization_reviews optimize \
  -d cases.json \
  --max-evals 50 \
  -o optimization_results
```

`--max-evals` controls GEPA's evaluation budget — the total number of individual (candidate prompt, training example) scoring calls. GEPA uses these across its evolutionary loop (select → evaluate → reflect → mutate → accept) to explore and refine prompt candidates.

### How `--total` and `--max-evals` interact

The extracted dataset is split 80/20 into train/val. GEPA samples mini-batches from the training set to evaluate each candidate prompt, so:

- **More cases** = richer signal for GEPA, but each candidate evaluation uses more of the budget
- **More max-evals** = more candidate prompts explored, but costs more in API calls
- They need to be **balanced** — a large dataset with a tiny budget means GEPA barely explores any candidates

| `--total` | `--max-evals` | Use case | Estimated cost |
|-----------|---------------|----------|----------------|
| 20 | 10–30 | Smoke test / verify pipeline | ~$1–3 |
| 50 | 50–150 | Quick optimization | ~$5–15 |
| 200 | 300+ | Full optimization | ~$30–50 |

## Module Structure

```
eval/
├── dataset.py      # EvalInput, EvalMetadata, extract_dataset()
├── evaluators.py   # VerdictMatch, NotFalseNegative, NotFalsePositive
├── task.py         # create_review_task() — wraps ReviewAnalyzer for eval
└── optimize.py     # ReviewAdapter (GEPAAdapter) + run_optimization()
```

## Why These Cases Matter

- **False approval** (agent APPROVE, human DENY): The AI let a bad org through. Without human review, a risky merchant would be on the platform. This is the most dangerous error.
- **False denial** (agent DENY, human APPROVE): The AI blocked a legitimate org. Safe because denied orgs always get human review, but annoying.
- **Match**: Agent and human agree. Sanity check that optimization doesn't break correct decisions.
