import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../../core/config/api-endpoints.config';
import { ApiClientService } from '../../../core/services/api-client.service';
import type {
  ComposeEmailPayload,
  ComposeResult,
  EmailAttachment,
  EmailListResult,
  EmailPreview,
  EmailRecord,
  EmailSignature,
  EmailTemplate,
} from '../models/email.model';

const ATTACHMENTS = '/email-attachments';

/** Transport-level access to the AutoMail API. */
@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly api = inject(ApiClientService);

  // Templates
  public listTemplates(): Observable<{ items: EmailTemplate[] }> {
    return this.api.get<{ items: EmailTemplate[] }>(API_ENDPOINTS.emailTemplates);
  }

  public createTemplate(payload: {
    name: string;
    subject: string;
    bodyHtml: string;
  }): Observable<EmailTemplate> {
    return this.api.post<EmailTemplate, typeof payload>(API_ENDPOINTS.emailTemplates, payload);
  }

  public deleteTemplate(templateId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(
      `${API_ENDPOINTS.emailTemplates}/${templateId}`,
    );
  }

  // Signatures
  public listSignatures(): Observable<{ items: EmailSignature[] }> {
    return this.api.get<{ items: EmailSignature[] }>(API_ENDPOINTS.emailSignatures);
  }

  public createSignature(payload: {
    name: string;
    bodyHtml: string;
    isDefault: boolean;
  }): Observable<EmailSignature> {
    return this.api.post<EmailSignature, typeof payload>(API_ENDPOINTS.emailSignatures, payload);
  }

  // Attachments
  public listAttachments(): Observable<{ items: EmailAttachment[] }> {
    return this.api.get<{ items: EmailAttachment[] }>(ATTACHMENTS);
  }

  public uploadAttachment(file: File): Observable<EmailAttachment> {
    const form = new FormData();
    form.append('file', file);

    return this.api.post<EmailAttachment, FormData>(ATTACHMENTS, form);
  }

  public deleteAttachment(attachmentId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`${ATTACHMENTS}/${attachmentId}`);
  }

  // Composing
  public preview(payload: {
    contactId: string;
    subject: string;
    bodyHtml: string;
    signatureId?: string;
  }): Observable<EmailPreview> {
    return this.api.post<EmailPreview, typeof payload>(
      `${API_ENDPOINTS.emails}/preview`,
      payload,
    );
  }

  public send(payload: ComposeEmailPayload): Observable<ComposeResult> {
    return this.api.post<ComposeResult, ComposeEmailPayload>(
      `${API_ENDPOINTS.emails}/send`,
      payload,
    );
  }

  // History
  public list(query: {
    page?: number;
    pageSize?: number;
    status?: string;
  } = {}): Observable<EmailListResult> {
    const params = new URLSearchParams();
    if (query.page) {
      params.set('page', String(query.page));
    }
    if (query.pageSize) {
      params.set('pageSize', String(query.pageSize));
    }
    if (query.status) {
      params.set('status', query.status);
    }

    const suffix = params.toString();
    return this.api.get<EmailListResult>(
      suffix ? `${API_ENDPOINTS.emails}?${suffix}` : API_ENDPOINTS.emails,
    );
  }

  public retry(emailId: string): Observable<EmailRecord> {
    return this.api.post<EmailRecord>(`${API_ENDPOINTS.emails}/${emailId}/retry`);
  }
}
