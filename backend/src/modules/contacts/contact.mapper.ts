import type { ContactDocument } from './contact.model';
import type { ContactDto } from './contact.types';

/** Explicit projection so internal fields never leak to the client. */
export function toContactDto(contact: ContactDocument): ContactDto {
  return {
    id: contact._id.toString(),
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    company: contact.company,
    designation: contact.designation,
    location: contact.location,
    tags: [...contact.tags],
    notes: contact.notes,
    source: contact.source,
    importBatchId: contact.importBatchId ? contact.importBatchId.toString() : null,
    lastContactedAt: contact.lastContactedAt ? contact.lastContactedAt.toISOString() : null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}
