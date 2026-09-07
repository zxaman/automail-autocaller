import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ImportAnalysis } from '../models/import.model';
import { ImportWizardPageService } from './import-wizard-page.service';

const analysis: ImportAnalysis = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  fileName: 'candidates.xlsx',
  fileSizeBytes: 4096,
  sheetName: 'Sheet1',
  availableSheets: [{ name: 'Sheet1', rowCount: 3 }],
  hasHeaderRow: true,
  headerRowIndex: 0,
  totalDataRows: 2,
  columns: [
    {
      columnIndex: 0,
      rawLabel: 'Candidate',
      suggestedField: 'name',
      confidence: 'high',
      score: 100,
      reason: 'The column name matches a known full name heading.',
      requiresConfirmation: false,
      sampleValues: ['Asha Menon'],
      alternatives: [],
    },
    {
      columnIndex: 1,
      rawLabel: 'Number',
      suggestedField: 'phone',
      confidence: 'medium',
      score: 60,
      reason: '"Number" is a generic column name; 100% of values look like a phone.',
      requiresConfirmation: true,
      sampleValues: ['9812345678'],
      alternatives: [],
    },
  ],
  previewRows: [['Asha Menon', '9812345678']],
  requiresConfirmation: true,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
};

function file(name = 'candidates.xlsx'): File {
  return new File(['col'], name, { type: 'text/csv' });
}

describe('ImportWizardPageService', () => {
  let service: ImportWizardPageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ImportWizardPageService],
    });

    service = TestBed.inject(ImportWizardPageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  function analyze(): void {
    service.analyzeFile(file());
    httpMock
      .expectOne((req) => req.url.endsWith('/imports/analyze'))
      .flush({ success: true, message: 'ok', data: analysis });
  }

  it('starts on the upload step', () => {
    expect(service.step()).toBe('upload');
    expect(service.analysis()).toBeNull();
  });

  it('uploads the file as multipart form data', () => {
    service.analyzeFile(file());

    const request = httpMock.expectOne((req) => req.url.endsWith('/imports/analyze'));
    expect(request.request.body).toBeInstanceOf(FormData);
    request.flush({ success: true, message: 'ok', data: analysis });

    expect(service.step()).toBe('map');
  });

  it('pre-confirms confident suggestions but leaves uncertain ones outstanding', () => {
    analyze();

    const rows = service.mapping();
    expect(rows[0]?.confirmed).toBe(true);
    expect(rows[1]?.confirmed).toBe(false);
    expect(service.unconfirmedCount()).toBe(1);
  });

  it('blocks commit until every uncertain column is confirmed', () => {
    analyze();
    expect(service.canCommit()).toBe(false);

    service.confirmSuggestion(1);
    expect(service.canCommit()).toBe(true);
  });

  it('accepts all suggestions at once', () => {
    analyze();
    service.confirmAllSuggestions();

    expect(service.unconfirmedCount()).toBe(0);
  });

  it('releases a field when another column claims it', () => {
    analyze();
    service.assignField(1, 'name');

    const rows = service.mapping();
    expect(rows[1]?.field).toBe('name');
    // Column 0 held 'name' and must give it up rather than duplicating it.
    expect(rows[0]?.field).toBeNull();
  });

  it('blocks commit when no name column is mapped', () => {
    analyze();
    service.confirmAllSuggestions();
    service.assignField(0, 'ignore');

    expect(service.hasName()).toBe(false);
    expect(service.canCommit()).toBe(false);
  });

  it('blocks commit when neither a phone nor an email is mapped', () => {
    analyze();
    service.confirmAllSuggestions();
    service.assignField(1, 'ignore');

    expect(service.hasChannel()).toBe(false);
    expect(service.canCommit()).toBe(false);
  });

  it('sends the session, mapping, strategy, and tags on commit', () => {
    analyze();
    service.confirmAllSuggestions();
    service.setDuplicateStrategy('update');
    service.setTags(['q3']);
    service.commit();

    const request = httpMock.expectOne((req) => req.url.endsWith('/imports/commit'));
    expect(request.request.body).toEqual({
      sessionId: analysis.sessionId,
      mapping: [
        { columnIndex: 0, field: 'name' },
        { columnIndex: 1, field: 'phone' },
      ],
      duplicateStrategy: 'update',
      tags: ['q3'],
    });

    request.flush({
      success: true,
      message: 'ok',
      data: {
        batchId: 'b1',
        fileName: 'candidates.xlsx',
        status: 'completed',
        totalRows: 2,
        successfulRows: 2,
        updatedRows: 0,
        duplicateRows: 0,
        failedRows: 0,
        errors: [],
      },
    });

    expect(service.step()).toBe('result');
    expect(service.result()?.successfulRows).toBe(2);
  });

  it('surfaces an analyze failure without leaving the upload step', () => {
    service.analyzeFile(file());
    httpMock
      .expectOne((req) => req.url.endsWith('/imports/analyze'))
      .flush(
        { success: false, message: 'Only .xlsx, .xls, and .csv files can be imported' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(service.step()).toBe('upload');
    expect(service.errorMessage()).toBeTruthy();
  });

  it('clears the analysis when the user goes back to choose another file', () => {
    analyze();
    service.backToUpload();

    expect(service.step()).toBe('upload');
    expect(service.analysis()).toBeNull();
    expect(service.mapping()).toEqual([]);
  });
});
