import {UploadRequirement} from 'src/app/api/models/task-definition';

export interface UploadCategoryInfo {
  label: string;
  extensions: string[];
}

// Mirrors ACCEPTED_TYPES in src/app/common/file-uploader/file-uploader.coffee, which is the
// actual source of truth used to accept/reject files. The two lists must be kept in sync
// manually until that legacy uploader and this display component share one source.
export const UPLOAD_CATEGORY_INFO: Record<string, UploadCategoryInfo> = {
  document: {
    label: 'Document',
    extensions: ['pdf', 'ps'],
  },
  csv: {
    label: 'Spreadsheet',
    extensions: ['csv', 'xls', 'xlsx'],
  },
  code: {
    label: 'Code',
    extensions: [
      'pas',
      'cpp',
      'c',
      'cs',
      'csv',
      'h',
      'hpp',
      'java',
      'py',
      'js',
      'html',
      'coffee',
      'rb',
      'css',
      'scss',
      'yaml',
      'yml',
      'xml',
      'json',
      'ts',
      'r',
      'rmd',
      'rnw',
      'rhtml',
      'rpres',
      'tex',
      'vb',
      'sql',
      'txt',
      'md',
      'jack',
      'hack',
      'asm',
      'hdl',
      'tst',
      'out',
      'cmp',
      'vm',
      'sh',
      'bat',
      'dat',
      'ipynb',
      'pml',
    ],
  },
  image: {
    label: 'Image',
    extensions: ['png', 'bmp', 'tiff', 'tif', 'jpeg', 'jpg', 'gif'],
  },
  zip: {
    label: 'Archive',
    extensions: ['zip', 'tar.gz', 'tar'],
  },
};

// Categories with more extensions than this show a truncated preview plus an
// expandable "view all" control (currently only the 'code' category, at ~39
// extensions, exceeds this; the other categories all fit within it today).
export const EXTENSION_PREVIEW_LIMIT = 8;

export interface UploadRequirementSummary {
  key: string;
  name: string;
  categoryLabel: string;
  extensions: string[];
  previewExtensions: string[];
  hasMoreExtensions: boolean;
}

export function summariseUploadRequirement(
  requirement: UploadRequirement,
): UploadRequirementSummary {
  const info = UPLOAD_CATEGORY_INFO[requirement.type];
  const extensions = (info?.extensions ?? []).map((ext) => ext.toUpperCase());
  return {
    key: requirement.key,
    name: requirement.name,
    categoryLabel: info?.label ?? requirement.type ?? 'File',
    extensions,
    previewExtensions: extensions.slice(0, EXTENSION_PREVIEW_LIMIT),
    hasMoreExtensions: extensions.length > EXTENSION_PREVIEW_LIMIT,
  };
}
