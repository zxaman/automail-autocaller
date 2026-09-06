import type { Contact } from '../models/contact.model';

export interface ContactFormDialogData {
  readonly mode: 'create' | 'edit';
  readonly contact: Contact | null;
  /** Existing workspace tags offered as autocomplete suggestions. */
  readonly knownTags: readonly string[];
}

/** The saved contact, or undefined when the dialog was dismissed. */
export type ContactFormDialogResult = Contact | undefined;
