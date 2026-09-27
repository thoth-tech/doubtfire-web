export interface AttachmentCategory {
  id: string;
  name: string;
  extensions: string[];
  preview: string;
}

export interface AttachmentPolicy {
  version: number;
  max_bytes_exclusive: number;
  max_selection_count: number;
  categories: AttachmentCategory[];
}

export function attachmentCategory(policy: AttachmentPolicy, file: File): AttachmentCategory {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return policy?.categories.find((category) => category.extensions.includes(extension));
}

export function attachmentError(error: {
  status?: number;
  error?: unknown;
  message?: string;
}): string {
  if (error?.status === 413) {
    return 'The upload is too large. Choose a smaller file and try again. Your draft is unchanged.';
  }
  const details = error?.error;
  if (typeof details === 'string' && !details.trim().startsWith('<')) {
    return details;
  }
  if (
    details &&
    typeof details === 'object' &&
    'error' in details &&
    typeof details.error === 'string'
  ) {
    return details.error;
  }
  return (
    error?.message || 'The attachment could not be uploaded. Your draft is unchanged; try again.'
  );
}
