import { describe, expect, it } from "vitest";
import { normalizePagination } from "@/lib/pagination";

describe("normalizePagination", () => {
  it("accepts a paginated API response", () => {
    expect(normalizePagination({ items: [{ id: 1 }], total: 11, page: 2, page_size: 5, pages: 3 })).toEqual({
      items: [{ id: 1 }], total: 11, page: 2, pageSize: 5, pages: 3,
    });
  });

  it("accepts a bare list and supplies safe defaults", () => {
    expect(normalizePagination([1, 2])).toEqual({ items: [1, 2], total: 2, page: 1, pageSize: 2, pages: 1 });
  });
});
