export type DocumentStatusFilter = 'in_progress' | 'provided' | 'confirmed';

export const PAGE_SIZE_OPTIONS = ['10', '15', '20', '30'] as const;
export const PAGE_SIZE_STORAGE_KEY = 'document-page-size';
