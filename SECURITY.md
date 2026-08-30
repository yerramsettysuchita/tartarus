# Security Policy

Tartarus is a security tool, so we hold our own project to the standard we ask of others.

## Reporting a vulnerability

If you find a security issue in Tartarus itself, please open a private report or
email the maintainer rather than filing a public issue. We will acknowledge it
and work on a fix before any public disclosure.

## Intentionally vulnerable code

The directory `examples/Tartarus-Patient-Zero` is a **deliberately vulnerable**
demo target. It exists only so the agent can scan, exploit, and patch it in a
sandbox. It must never be deployed. Our CI static analysis excludes it on
purpose, so alerts there are expected and are not defects in the product.

## Secrets

No credentials live in this repository. All keys are read from a local `.env`
file that is git-ignored, and inside the running agent they stay in the harness.
Exploit code runs only in an ephemeral, isolated Daytona sandbox that never sees
those credentials and is destroyed after every run.

## Supply chain

Every pull request runs type checking, the test suite, a build, CodeQL static
analysis, and a Trivy vulnerability scan, so regressions and known-vulnerable
dependencies are caught before merge.
