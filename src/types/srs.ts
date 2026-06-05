export type SrsArtifactKind = 'srs-generation';

export interface StoredSrsPayload {
  content: Record<string, unknown>;
  diagrams?: Record<string, unknown>;
  validation?: unknown;
}

export interface StoredSrsRecord {
  id: string;
  kind: SrsArtifactKind;
  createdAt: string;
  projectName: string;
  payload: StoredSrsPayload;
}
