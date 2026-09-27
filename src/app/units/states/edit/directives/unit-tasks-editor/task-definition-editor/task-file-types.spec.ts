import {describe, expect, it} from 'vitest';
import {ZIP_ACCEPT, isPdfFile, isZipFile} from './task-file-types';

function file(name: string, type: string): File {
  return new File(['x'], name, {type});
}

describe('task file types', () => {
  it('takes a ZIP whichever type the browser gives it', () => {
    expect(isZipFile(file('tests.zip', 'application/zip'))).toBe(true);
    expect(isZipFile(file('tests.zip', 'application/x-zip-compressed'))).toBe(true);
    expect(isZipFile(file('tests.zip', ''))).toBe(true);
    expect(isZipFile(file('TESTS.ZIP', 'application/octet-stream'))).toBe(true);
  });

  it('turns away files that are not ZIPs', () => {
    expect(isZipFile(file('notes.pdf', 'application/pdf'))).toBe(false);
    expect(isZipFile(file('zip.txt', 'text/plain'))).toBe(false);
  });

  it('takes a PDF by type or by name', () => {
    expect(isPdfFile(file('sheet.pdf', 'application/pdf'))).toBe(true);
    expect(isPdfFile(file('sheet.PDF', ''))).toBe(true);
    expect(isPdfFile(file('sheet.docx', 'application/msword'))).toBe(false);
  });

  it('lets the drop zone accept the Windows ZIP type', () => {
    expect(ZIP_ACCEPT).toContain('application/x-zip-compressed');
    expect(ZIP_ACCEPT).toContain('.zip');
  });
});
