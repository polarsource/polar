"""Multi-step organization review agent (v2).

Sits alongside ``polar.organization_review`` (the single-shot v1 analyzer)
and is intended to take over once it reaches calibration parity.

Built around four primitives:

* **Lanes** — parallel investigation units (see ``lanes/base.py``). Each
  lane is a focused, narrow-purpose data gatherer that emits
  ``RaisedSignal`` records.
* **Readers** — sandboxed adapters between untrusted external content
  (merchant HTML, Plain replies, appeal text) and Decide. Readers emit
  structured cues; raw merchant text never reaches Decide directly
  (see ``readers/base.py``).
* **Signals** — controlled-vocabulary findings produced by lanes. Every
  emitted ``RaisedSignal.kind`` is registered in
  ``taxonomy.SIGNAL_KIND_REGISTRY`` with metadata (severity, merchant
  disclosure safety, auto-action eligibility).
* **Runs** — persistent FSM rows. One ``OrganizationReviewAgentRun`` per
  triggered review; resumable after worker restarts.

Higher-level orchestration (graph nodes, lane registry, service, tasks,
backoffice UI) layers on top as subsequent slices are implemented.
"""
