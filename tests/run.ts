import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const testDataDir = mkdtempSync(path.join(tmpdir(), 'mangax-tests-'));
process.env.MANGAX_DATA_DIR = testDataDir;

try {
  await import('./source_registry.test');
  await import('./database_migration.test');
  await import('./mangadex_adapter.test');
  await import('./demonic_scans_adapter.test');
  await import('./asura_scans_adapter.test');
  await import('./suite.test');
  await import('./reader_features.test');
} finally {
  rmSync(testDataDir, { recursive: true, force: true });
}
