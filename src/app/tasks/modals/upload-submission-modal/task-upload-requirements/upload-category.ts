import {UploadRequirement} from 'src/app/api/models/task-definition';
import {ACCEPTED_TYPES} from 'src/app/common/file-uploader/file-upload-types';

const CATEGORY_LABELS: Record<keyof typeof ACCEPTED_TYPES, string> = {
  document: 'Document',
  csv: 'Spreadsheet',
  code: 'Code',
  image: 'Image',
  zip: 'Archive',
};

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
  // Match the uploader's archive alias and read the same extension policy.
  const type = requirement.type === 'archive' ? 'zip' : requirement.type;
  const knownType = Object.hasOwn(ACCEPTED_TYPES, type);
  const category = knownType ? ACCEPTED_TYPES[type as keyof typeof ACCEPTED_TYPES] : undefined;
  const extensions = (category?.extensions ?? []).map((extension) => extension.toUpperCase());
  return {
    key: requirement.key,
    name: requirement.name,
    categoryLabel: knownType
      ? CATEGORY_LABELS[type as keyof typeof ACCEPTED_TYPES]
      : type || 'File',
    extensions,
    previewExtensions: extensions.slice(0, EXTENSION_PREVIEW_LIMIT),
    hasMoreExtensions: extensions.length > EXTENSION_PREVIEW_LIMIT,
  };
}
