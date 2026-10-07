/**
 * Versions of the block language, and the migrations that carry saved code from one version to
 * the next. See "Versions and migrations" in docs/block-language.md.
 *
 * - Additions (a new function, value or constant) keep the version.
 * - A change that could alter existing code raises LANGUAGE_VERSION and adds a migration to it.
 * - A migration rewrites code of one version into code of the next, on its tokens (renameValues
 *   in formula.ts), so the user's comments, layout and own names stay.
 * - It throws a MigrationError when it cannot do that without changing what the code means; the
 *   block then stays as it was and says why.
 */
import type { Block } from './blocks.ts';

/** The version of the block language this engine runs. */
export const LANGUAGE_VERSION = 1;

/** Turns code written for version `to - 1` into code for version `to`. */
export interface Migration {
  to: number;
  /** What changed, for the user, e.g. "ramp() is now called slope()". */
  description: string;
  migrate(code: string): string;
}

/** Why a migration left a block's code as it was. */
export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/** Every migration, oldest first. Version 1 is the first version, so there are none yet. */
export const MIGRATIONS: Migration[] = [];

export interface Upgrade {
  ok: boolean;
  /** The code at the version reached. */
  code: string;
  /** The version reached: the current one, or the last one before a migration gave up. */
  language: number;
  /** The descriptions of the migrations applied. */
  changes: string[];
  /** Why the code could not reach the current version. */
  problem?: string;
}

/** The language version of a block's code. Blocks saved before there were versions are version 1. */
export function languageOf(block: Pick<Block, 'language'>): number {
  return block.language ?? 1;
}

/** Brings code of an older version of the language up to the current one, a version at a time. */
export function upgradeCode(code: string, from: number, migrations: Migration[] = MIGRATIONS, current = LANGUAGE_VERSION): Upgrade {
  const changes: string[] = [];
  if (from > current) {
    return {
      ok: false, code, language: from, changes,
      problem: `This block is written for version ${from} of the block language, and this app knows up to version ${current}. Update the app, or rewrite the block.`,
    };
  }
  let version = from;
  for (const migration of migrations) {
    if (migration.to <= version) continue;
    if (migration.to !== version + 1) throw new Error(`There is no migration from version ${version} to ${version + 1} of the block language`);
    try {
      code = migration.migrate(code);
    } catch (error) {
      if (!(error instanceof MigrationError)) throw error;
      return {
        ok: false, code, language: version, changes,
        problem: `Version ${migration.to} of the block language changed this: ${migration.description} This block could not be changed automatically, because ${error.message} Change the code by hand.`,
      };
    }
    version = migration.to;
    changes.push(migration.description);
  }
  if (version !== current) throw new Error(`There is no migration from version ${version} to ${version + 1} of the block language`);
  return { ok: true, code, language: version, changes };
}

/** The block brought up to the current version, or as it was when that is not possible. */
export function upgradeBlock(block: Block, migrations: Migration[] = MIGRATIONS, current = LANGUAGE_VERSION): { block: Block; upgrade: Upgrade } {
  const upgrade = upgradeCode(block.code, languageOf(block), migrations, current);
  return { block: { ...block, code: upgrade.code, language: upgrade.language }, upgrade };
}
