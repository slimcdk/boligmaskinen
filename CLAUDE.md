# Working on Boligmaskinen

- **The UI follows Material Design 3.** For any UI work, use the `material-design-3-ui` skill in
  `.claude/skills/`, and run its self-audit before a UI change is done.
  - Angular Material's M3 theme is the implementation.
  - Colours, type, shape and elevation come from the `--mat-sys-*` tokens (`frontend/src/styles.scss`),
    never from literals.
  - Both light and dark mode must work.
- **Tests come with every change:** Vitest for logic and components, Playwright for what a user
  does (`frontend/e2e`, and `frontend/e2e-live` against the whole app). CI must be green before a merge.
- **The plan:**
  - `docs/plan.md` holds the milestones; GitHub has them as milestones and issues, and PRs close issues.
  - Ideas for blocks over home data are in `docs/block-ideas.md`.
- **The block language** is described in `docs/block-language.md`. A change that could alter existing
  code raises its version and comes with a migration (`packages/engine/src/migrations.ts`).
