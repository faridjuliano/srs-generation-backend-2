import { randomUUID } from 'crypto';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import type { StoreSrsInput, StoreSrsResult, StoredSrsRecord } from '../types/srs';

function getSrsStorageDir(): string {
  return process.env.SRS_OUTPUT_DIR?.trim() || join(process.cwd(), 'src', 'database');
}

export async function storeGeneratedSrs(input: StoreSrsInput): Promise<StoreSrsResult> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const storageDir = getSrsStorageDir();
  const record: StoredSrsRecord = {
    id,
    kind: input.kind || 'srs-generation',
    createdAt,
    projectName: input.projectName,
    payload: input.payload,
  };

  const filePath = join(storageDir, `${id}.json`);
  
  try {
    await mkdir(storageDir, { recursive: true });
    console.log(`[Store] Created directory: ${storageDir}`);
  } catch (error) {
    console.error(`[Store] Failed to create directory: ${storageDir}`, error);
    throw error;
  }
  
  try {
    const jsonString = JSON.stringify(record, null, 2);
    console.log(`[Store] JSON size: ${jsonString.length} bytes`);
    console.log(`[Store] Writing to: ${filePath}`);
    
    await writeFile(filePath, jsonString, 'utf8');
    console.log(`[Store] Successfully wrote file: ${filePath}`);
  } catch (error) {
    console.error(`[Store] Failed to write file: ${filePath}`, error);
    throw error;
  }

  return { id, filePath, record };
}

export async function retrieveStoredSrs(id: string): Promise<StoredSrsRecord | null> {
  try {
    const storageDir = getSrsStorageDir();
    const filePath = join(storageDir, `${id}.json`);
    const data = await readFile(filePath, 'utf8');
    return JSON.parse(data) as StoredSrsRecord;
  } catch (error) {
    return null;
  }
}
