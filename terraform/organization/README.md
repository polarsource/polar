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

## Terraform Ownership

Terraform manages the workload OUs and member account placement.

The AWS Organization is managed as a `aws_organizations_organization` resource with
SERVICE_CONTROL_POLICY enabled. The management account is not managed as an
`aws_organizations_account` resource because that resource manages member accounts, not the
management account itself.

Terraform also creates an HCP Terraform run role named `terraform-cloud` in each workload account.
Those roles trust HCP Terraform's AWS dynamic credentials issuer and are scoped to the matching
workspace:

```text
production account -> polar workspace
sandbox account    -> sandbox workspace
test account       -> test workspace
```

The HCP Terraform workspace variables that point each workspace at its AWS role are managed from
`terraform/global`.
