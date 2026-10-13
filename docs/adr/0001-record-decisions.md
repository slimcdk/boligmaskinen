# 1. Record the architecture decisions

- **Status:** accepted
- **Date:** 2026-10-13
- **Where:** `docs/adr/`

## Context

Boligmaskinen went from a prototype to an app with a backend, data jobs and a pipeline in a
week. The reasons for its main choices were written in pull requests, in the plan and in the
heads of those who made them. Someone who picks the project up needs them in one place.

## Decision

Each decision that shapes the project gets an architecture decision record (ADR) in
`docs/adr/`: numbered, a page long, with its context, the decision, the alternatives and the
consequences. The index and how to write one are in [README.md](README.md). A changed decision
gets a new ADR that supersedes the old one, which is kept.

The common changes get step-by-step guides in `docs/guides/`. Open decisions stay in the plan.

## Consequences

- The plan's table of open decisions links each decision taken to its ADR.
- `CONTRIBUTING.md` points to the ADRs and the guides; so does `CLAUDE.md` for coding agents.
