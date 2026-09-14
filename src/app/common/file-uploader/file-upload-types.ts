export const ACCEPTED_TYPES = {
  document: {
    extensions: ['pdf', 'ps'],
    // icon: 'picture_as_pdf',
    icon: 'article_outlined',
    name: 'PDF',
  },
  csv: {
    extensions: ['csv', 'xls', 'xlsx'],
    icon: 'insert_chart_outlined',
    name: 'CSV',
  },
  code: {
    // prettier-ignore
    extensions: [
      'pas', 'cpp', 'c', 'cs', 'csv', 'h', 'hpp', 'java', 'py', 'js', 'html', 'coffee', 'rb', 'css',
      'scss', 'yaml', 'yml', 'xml', 'json', 'ts', 'r', 'rmd', 'rnw', 'rhtml', 'rpres', 'tex',
      'vb', 'sql', 'txt', 'md', 'jack', 'hack', 'asm', 'hdl', 'tst', 'out', 'cmp', 'vm', 'sh', 'bat',
      'dat', 'ipynb', 'pml', 'vue'
    ],
    // icon: 'code',
    // icon: 'code',
    icon: 'integration_instructions_outlined',
    name: 'code',
  },
  image: {
    extensions: ['png', 'bmp', 'tiff', 'tif', 'jpeg', 'jpg', 'gif'],
    // icon: 'image',
    icon: 'image_outlined',
    name: 'image',
  },
  zip: {
    extensions: ['zip', 'tar.gz', 'tgz', 'tar'],
    icon: 'folder_zip',
    name: 'zip',
  },
} as const;
