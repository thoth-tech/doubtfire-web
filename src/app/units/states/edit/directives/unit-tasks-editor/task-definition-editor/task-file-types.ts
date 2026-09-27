// Browsers do not agree on the type of a ZIP file. Windows reports
// application/x-zip-compressed, some systems report nothing at all, so the name
// is the fallback. Without it a good ZIP could be refused as the wrong type.
const ZIP_TYPES = ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'];

/** For the accept attribute of a ZIP upload: the types above plus the extension. */
export const ZIP_ACCEPT = [...ZIP_TYPES, '.zip'].join(',');
export const PDF_ACCEPT = 'application/pdf,.pdf';

function hasExtension(file: File, extension: string): boolean {
  return (file.name ?? '').toLowerCase().endsWith(extension);
}

export function isZipFile(file: File): boolean {
  return ZIP_TYPES.includes(file.type) || hasExtension(file, '.zip');
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || hasExtension(file, '.pdf');
}
