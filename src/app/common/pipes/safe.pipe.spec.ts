import {describe, expect, it, vi} from 'vitest';
import {DomSanitizer} from '@angular/platform-browser';
import {SafePipe} from './safe.pipe';

describe('SafePipe', () => {
  it('hands a blob url to the sanitizer bypass', () => {
    const bypass = vi.fn().mockReturnValue('trusted-blob');
    const pipe = new SafePipe({bypassSecurityTrustResourceUrl: bypass} as unknown as DomSanitizer);
    const blobUrl = 'blob:https://doubtfire.deakin.edu.au/8f14e45f-ceea-4d9e-9915-99b1c4e2f2d1';

    expect(pipe.transform(blobUrl)).toBe('trusted-blob');
    expect(bypass).toHaveBeenCalledWith(blobUrl);
  });

  it('hands a regular url to the sanitizer bypass', () => {
    const bypass = vi.fn().mockReturnValue('trusted');
    const pipe = new SafePipe({bypassSecurityTrustResourceUrl: bypass} as unknown as DomSanitizer);

    expect(pipe.transform('https://example.test/doc.pdf')).toBe('trusted');
    expect(bypass).toHaveBeenCalledWith('https://example.test/doc.pdf');
  });
});
