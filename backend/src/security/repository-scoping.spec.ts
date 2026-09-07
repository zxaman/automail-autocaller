import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every persistence query must be constrained to a workspace.
 *
 * This is a static check on the repository sources. It exists because the
 * dynamic integration tests skip when no MongoDB is reachable, and a
 * cross-tenant read is exactly the bug that must never ship untested.
 */
const REPOSITORY_ROOT = join(__dirname, '..', 'modules');

/**
 * Repositories that legitimately query outside a workspace, with the reason.
 * Anything not listed here must be workspace-scoped.
 */
const UNSCOPED_BY_DESIGN: Record<string, string> = {
  'auth/session.repository.ts': 'Sessions are keyed by token hash; they establish the workspace.',
  'users/user.repository.ts': 'Users are looked up by Google identity before a workspace exists.',
  'workspaces/workspace.repository.ts': 'Workspaces are the scope, so they cannot be scoped by one.',
};

function repositoryFiles(): string[] {
  return globSync('*/*.repository.ts', { cwd: REPOSITORY_ROOT }).sort();
}

describe('repository workspace scoping', () => {
  const files = repositoryFiles();

  it('finds the repositories to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    if (UNSCOPED_BY_DESIGN[file]) {
      it(`documents why ${file} is not workspace-scoped`, () => {
        expect(UNSCOPED_BY_DESIGN[file]).toBeTruthy();
      });
      continue;
    }

    it(`scopes every query in ${file} to a workspace`, () => {
      const source = readFileSync(join(REPOSITORY_ROOT, file), 'utf8');

      // findById/findByIdAndUpdate take an id alone and cannot express a
      // tenant filter, so they are banned in workspace-owned repositories in
      // favour of the findOne* forms that accept a full filter.
      expect(source).not.toMatch(/\.findByIdAndUpdate\(/);
      expect(source).not.toMatch(/\.findByIdAndDelete\(/);

      const queryCount = (source.match(/Model\.(find|findOne|updateMany|updateOne|deleteOne|deleteMany|countDocuments)/g) ?? []).length;
      const scopedCount = (source.match(/workspaceId/g) ?? []).length;

      // Every query needs at least one workspaceId reference to constrain it.
      expect(scopedCount).toBeGreaterThanOrEqual(queryCount);
    });
  }
});
