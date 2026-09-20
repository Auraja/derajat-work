export interface Pagination<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export function normalizePagination<T>(value: unknown): Pagination<T> {
  if (Array.isArray(value)) {
    return { items: value as T[], total: value.length, page: 1, pageSize: value.length, pages: value.length ? 1 : 0 };
  }
  const data = (value ?? {}) as Record<string, unknown>;
  const items = Array.isArray(data.items) ? (data.items as T[]) : [];
  const total = Number(data.total ?? items.length);
  const page = Number(data.page ?? 1);
  const pageSize = Number(data.page_size ?? data.pageSize ?? items.length);
  const pages = Number(data.pages ?? (pageSize > 0 ? Math.ceil(total / pageSize) : 0));
  return { items, total, page, pageSize, pages };
}
