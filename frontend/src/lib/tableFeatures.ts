import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"

/**
 * Feature set shared by every `DataTable` in the app.
 *
 * v9 registers features explicitly (v8 bundled them all) and exposes a
 * column/header/table API only when its feature is registered. Feature
 * properties come first so row-model slots and the `sortFns` registry —
 * which declare these features as prerequisites — type-check.
 *
 * `sortFns` keeps the functions v8 resolved automatically for
 * `sortFn: "auto"`; without them auto-sorting falls back to `basic`.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
  },
})

export type DataTableFeatures = typeof dataTableFeatures
