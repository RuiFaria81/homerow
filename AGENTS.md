# Agent Runbook

We use TDD
We use Conventional Commits

## Deploy + Verify (webmail category changes)

When code changes are made, run this exact flow:

1. Deploy:
   - `./scripts/install.sh`
2. Run Playwright regression tests against production:
   - `cd webmail`
   - `E2E_BASE_URL='https://webmail.inout.email' E2E_EMAIL='admin@inout.email' E2E_PASSWORD='<password>' npm run e2e`

Expected result:
- All tests in pass.

## Testing Requirement For New Features

When an agent implements a new feature or changes behavior, it must add or update automated tests in the same task.

Requirements:
- Create at least one test that would fail without the new feature/behavior and pass with it.
- Prefer Playwright coverage for UI flows and integration behavior.
- If a test cannot be added (for example, missing harness or impossible setup), explicitly document why in the final response and describe the manual verification performed.
