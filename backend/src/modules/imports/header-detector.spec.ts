import { describe, expect, it } from 'vitest';

import { HeaderDetector } from './header-detector';

const detector = new HeaderDetector();

describe('HeaderDetector', () => {
  it('finds a header row in the usual first position', () => {
    const result = detector.detect([
      ['Name', 'Phone No.', 'Email ID'],
      ['Asha Menon', '9812345678', 'asha@example.com'],
      ['Ravi Kumar', '9812345679', 'ravi@example.com'],
    ]);

    expect(result.hasHeaderRow).toBe(true);
    expect(result.headerRowIndex).toBe(0);
    expect(result.dataStartRowIndex).toBe(1);
    expect(result.headers.map((header) => header.rawLabel)).toEqual([
      'Name',
      'Phone No.',
      'Email ID',
    ]);
  });

  it('skips title and blank rows above the real header', () => {
    const result = detector.detect([
      ['Candidate Export - Q3', '', ''],
      ['', '', ''],
      ['Candidate Name', 'Mobile', 'Email Address'],
      ['Asha Menon', '9812345678', 'asha@example.com'],
    ]);

    expect(result.headerRowIndex).toBe(2);
    expect(result.dataStartRowIndex).toBe(3);
  });

  it('treats a file that starts with data as headerless', () => {
    const result = detector.detect([
      ['Asha Menon', '9812345678', 'asha@example.com'],
      ['Ravi Kumar', '9812345679', 'ravi@example.com'],
      ['Meera Nair', '9812345670', 'meera@example.com'],
    ]);

    expect(result.hasHeaderRow).toBe(false);
    expect(result.headerRowIndex).toBe(-1);
    expect(result.dataStartRowIndex).toBe(0);
    expect(result.headers[0]?.rawLabel).toBe('Column 1');
  });

  it('collects sample values per column for later value analysis', () => {
    const result = detector.detect([
      ['Name', 'Mobile'],
      ['Asha', '9812345678'],
      ['Ravi', '9812345679'],
    ]);

    expect(result.headers[1]?.sampleValues).toEqual(['9812345678', '9812345679']);
  });

  it('names blank header cells positionally rather than leaving them empty', () => {
    const result = detector.detect([
      ['Name', '', 'Email'],
      ['Asha', 'extra', 'asha@example.com'],
    ]);

    expect(result.headers[1]?.rawLabel).toBe('Column 2');
  });

  it('returns an empty result for an empty sheet', () => {
    const result = detector.detect([]);
    expect(result.headers).toEqual([]);
    expect(result.hasHeaderRow).toBe(false);
  });
});
