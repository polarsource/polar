"""
Billing E2E Tests.

These tests verify the complete billing flow from checkout to renewal,
including:
- Subscription creation from checkout
- Event ingestion and meter updates
- Subscription renewal and cycling
- Correct charge calculations with credits

The tests use stateful fakes for external dependencies (Stripe, Tax)
to enable fast, deterministic, and comprehensive testing of billing logic.
"""
