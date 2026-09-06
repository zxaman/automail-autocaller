import { ImportController } from './import.controller';
import { ImportRepository } from './import.repository';
import { ImportService } from './import.service';
import { ImportSessionStore } from './import-session.store';

/** Composition root for imports. */
export function createImportModule() {
  const importRepository = new ImportRepository();
  // One store per process: it holds the in-flight parsed uploads.
  const sessionStore = new ImportSessionStore();
  const importService = new ImportService(importRepository, sessionStore);

  return {
    importController: new ImportController(importService, importRepository),
    importService,
    importRepository,
    sessionStore,
  };
}

export type ImportModule = ReturnType<typeof createImportModule>;
