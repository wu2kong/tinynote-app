import type { GitChangeType } from './types.ts';

/**
 * isomorphic-git statusMatrix row: [filepath, HEAD, WORKDIR, STAGE]
 * HEAD: 0 absent, 1 present
 * WORKDIR: 0 absent, 1 identical to HEAD, 2 different from HEAD
 * STAGE is ignored — TinyNote lists working-tree changes vs the last local commit.
 */
export function mapMatrixStatus(
  headStatus: number,
  workdirStatus: number,
): GitChangeType | null {
  if (headStatus === workdirStatus) return null;
  if (headStatus === 0) return 'added';
  if (workdirStatus === 0) return 'deleted';
  return 'modified';
}
