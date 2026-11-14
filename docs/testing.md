# Testing

## Test runner

The project uses the Node.js built-in test runner, with `tsx` providing TypeScript-aware module loading.

Run the complete automated test suite from the repository root:

```sh
npm test
```

Run an individual test group:

```sh
npm run test:passenger-domain
npm run test:passenger-requirements
npm run test:passenger-validation
npm run test:booking-readiness
npm run test:booking-session
npm run test:flight-search
```

The test scripts list their test files explicitly. Do not rely on automatic test-file discovery for this project.

## Why tsx?

Native Node.js TypeScript type stripping does not read `tsconfig.json`. In particular, it does not resolve TypeScript `paths` aliases and expects explicit extensions for relative TypeScript imports. That does not match the application's existing TypeScript module conventions.

`tsx` supplies TypeScript-aware execution and reads the project's TypeScript configuration, allowing tests to exercise the existing imports without changing application source imports solely for the test runner.

## Type checking

`tsx` transpiles TypeScript for execution; it does not perform type checking. Keep type checking as a separate required verification:

```sh
npx tsc --noEmit
```

Also run lint before submitting changes:

```sh
npx expo lint
```

## Adding tests

- Use Node's `node:test` and `node:assert/strict` APIs.
- Keep tests deterministic and avoid network calls.
- Add each new test file to the aggregate `test` script and provide or update a focused `test:<area>` script when useful.
- Run `npm test`, `npx tsc --noEmit`, and `npx expo lint` before considering the change verified.
