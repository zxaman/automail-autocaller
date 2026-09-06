import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../../core/config/api-endpoints.config';
import { ApiClientService } from '../../../core/services/api-client.service';
import type {
  ImportAnalysis,
  ImportBatch,
  ImportCommitRequest,
  ImportResult,
} from '../models/import.model';

/** Transport-level access to the import API. Holds no wizard state. */
@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly api = inject(ApiClientService);

  public analyze(file: File, sheetName?: string): Observable<ImportAnalysis> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.api.upload<ImportAnalysis>(
      `${API_ENDPOINTS.imports}/analyze`,
      formData,
      sheetName ? { sheetName } : undefined,
    );
  }

  public commit(request: ImportCommitRequest): Observable<ImportResult> {
    return this.api.post<ImportResult, ImportCommitRequest>(
      `${API_ENDPOINTS.imports}/commit`,
      request,
    );
  }

  public history(limit = 10): Observable<{ items: ImportBatch[] }> {
    return this.api.get<{ items: ImportBatch[] }>(API_ENDPOINTS.imports, { limit });
  }

  public getBatch(batchId: string): Observable<ImportBatch> {
    return this.api.get<ImportBatch>(`${API_ENDPOINTS.imports}/${batchId}`);
  }
}
