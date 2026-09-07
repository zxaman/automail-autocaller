export type ContactSource = 'manual' | 'import' | 'api';

/** Contact as returned by the API. */
export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly company: string | null;
  readonly designation: string | null;
  readonly location: string | null;
  readonly tags: readonly string[];
  readonly notes: string | null;
  readonly source: ContactSource;
  readonly importBatchId: string | null;
  readonly lastContactedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Payload accepted by create and update. */
export interface ContactPayload {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly company: string | null;
  readonly designation: string | null;
  readonly location: string | null;
  readonly tags: readonly string[];
  readonly notes: string | null;
}
