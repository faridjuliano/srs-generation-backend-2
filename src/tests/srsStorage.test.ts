import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { storeGeneratedSrs } from '../services/srsStorage';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
test('stores generated SRS records as uuid-named JSON files', async () => {
  const previousOutputDir = process.env.SRS_OUTPUT_DIR;
  const previousCwd = process.cwd();
  const tempRoot = await mkdtemp(join(tmpdir(), 'srs-storage-'));
  await mkdir(join(tempRoot, 'src'), { recursive: true });
  const resolvedTempRoot = await realpath(tempRoot);
  process.chdir(tempRoot);
  try {
    const result = await storeGeneratedSrs({
      projectName: 'Inventory Management System',
      payload: {
        content: {
          projectName: 'Inventory Management System',
        },
        diagrams: {
          sequenceDiagram: 'sequenceDiagram\nA->>B: hello',
        },
        validation: {
          isValid: true,
        },
      },
    });
    assert.match(result.id, UUID_REGEX);
    assert.equal(basename(result.filePath), `${result.id}.json`);
    assert.equal(result.filePath, join(resolvedTempRoot, 'src', 'database', `${result.id}.json`));
    const raw = await readFile(result.filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    assert.equal(parsed.id, result.id);
    assert.equal(parsed.kind, 'srs-generation');
    assert.equal(parsed.projectName, 'Inventory Management System');
    assert.equal(typeof parsed.createdAt, 'string');
    assert.deepEqual((parsed.payload as Record<string, unknown>).diagrams, {
      sequenceDiagram: 'sequenceDiagram\nA->>B: hello',
    });
  } finally {
    if (previousOutputDir === undefined) {
      delete process.env.SRS_OUTPUT_DIR;
    } else {
      process.env.SRS_OUTPUT_DIR = previousOutputDir;
    }
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
});
