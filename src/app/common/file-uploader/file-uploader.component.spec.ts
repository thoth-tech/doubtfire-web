import {beforeEach, describe, expect, it, vi} from 'vitest';
import {FileUploaderComponent} from './file-uploader.component';

// SJ-11: the upload type check must match a real file extension, not any
// filename that merely ends with the accepted letters (e.g. figure.eps
// must not pass a `ps` zone).
describe('FileUploaderComponent validateFiles', () => {
  let component: FileUploaderComponent;

  beforeEach(() => {
    component = new FileUploaderComponent({} as never, {} as never);
    (component as never as {refreshShownUploadZones: unknown}).refreshShownUploadZones = vi.fn();
    (component as never as {updateReadyState: unknown}).updateReadyState = vi.fn();
    (component as never as {readyToUpload: unknown}).readyToUpload = vi.fn(() => true);
  });

  const zoneFor = (filename: string) => ({
    model: [{name: filename}] as unknown,
    accepts: ['pdf', 'ps'],
    display: {error: null as unknown},
  });

  it('rejects a file whose name only ends with the accepted letters', () => {
    const zone = zoneFor('figure.eps');
    (component as never as {shownUploadZones: unknown}).shownUploadZones = [zone];

    component.validateFiles();

    expect(zone.model).toBeNull();
    expect(zone.display.error).toBe(true);
  });

  it('accepts a file with a real accepted extension', () => {
    const zone = zoneFor('report.pdf');
    (component as never as {shownUploadZones: unknown}).shownUploadZones = [zone];

    component.validateFiles();

    expect(zone.model).not.toBeNull();
  });
});
