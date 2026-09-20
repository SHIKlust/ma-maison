import * as migration_20260915_131508 from './20260915_131508';
import * as migration_20260915_142517 from './20260915_142517';

export const migrations = [
  {
    up: migration_20260915_131508.up,
    down: migration_20260915_131508.down,
    name: '20260915_131508',
  },
  {
    up: migration_20260915_142517.up,
    down: migration_20260915_142517.down,
    name: '20260915_142517'
  },
];
