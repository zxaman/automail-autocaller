import { ContactController } from './contact.controller';
import { ContactRepository } from './contact.repository';
import { ContactService } from './contact.service';

/** Composition root for the contacts module. */
export function createContactModule() {
  const contactRepository = new ContactRepository();
  const contactService = new ContactService(contactRepository);

  return {
    contactController: new ContactController(contactService),
    contactService,
    contactRepository,
  };
}

export type ContactModule = ReturnType<typeof createContactModule>;
