# @boligmaskinen/engine

The scoring engine and the block language, shared by the frontend and the backend, so a block gives
the same points in the browser and on the server.

| File | What it is |
|---|---|
| `src/formula.ts` | The block language: tokenizer, parser and compiler, and the controls from `let` lines. See `docs/block-language.md`. |
| `src/blocks.ts` | Evaluating the blocks over cells: preferences, requirements, weights, missing data. |
| `src/library.ts` | The predefined blocks. |
| `src/migrations.ts` | The language version, and the migrations that bring saved code up to it. |
| `src/values.ts` | What a block can read: the data, and the travel times to the user's places. |
| `src/engine.ts` | Decoding the data layers, lower limits, blur. |
| `src/travel.ts` | Travel-time estimates. |
| `src/types.ts` | The shared types. |

## How it is used

- **The frontend** imports `@boligmaskinen/engine` through a path in `frontend/tsconfig.json`, and
  Angular's build compiles the sources with the app.
- **The backend** depends on it as `file:../packages/engine`. Node 24 runs the TypeScript sources
  directly, so there is no build step.

So the sources follow Node's rules for TypeScript, which `tsconfig.json` checks:

- Relative imports end in `.ts`.
- Types are imported with `import type`.
- Only syntax that can be erased: no enums, namespaces or constructor parameter properties.

## Tests

```sh
npm install
npm test             # Vitest; among the tests, the predefined blocks score exactly like the original engine
npm run typecheck
```
