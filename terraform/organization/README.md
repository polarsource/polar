# AWS Organizations

This Terraform root manages Polar's AWS Organizations structure.

## Layout

```text
AWS Organization
├── Management account: polar
└── Workloads
    ├── Production
    │   └── production
    ├── Sandbox
    │   └── sandbox
    └── Test
        └── test
```

The management account owns the AWS Organization control plane. It should stay limited to
organization administration, billing, account lifecycle, delegated administrator registration,
and other tasks that must run from the management account.

Application workloads live under the `Workloads` OU:

- `Production` contains the public production environment.
- `Sandbox` contains the sandbox production-class environment.
- `Test` contains the staging/test environment.

## Guardrails

- Attach guardrails that apply to every application account to `Workloads`.
- Attach production-class guardrails to both `Production` and `Sandbox`.
- Attach test/staging-specific guardrails to `Test`.
