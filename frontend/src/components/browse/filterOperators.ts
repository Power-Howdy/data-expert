export interface ColumnFilter {
  column: string
  operator: string
  value: any
}

export const filterOperators = [
  { value: "eq", label: "Equals" },
  { value: "ne", label: "Not Equals" },
  { value: "gt", label: "Greater Than" },
  { value: "gte", label: "Greater Than or Equal" },
  { value: "lt", label: "Less Than" },
  { value: "lte", label: "Less Than or Equal" },
  { value: "contains", label: "Contains" },
  { value: "startswith", label: "Starts With" },
  { value: "endswith", label: "Ends With" },
  { value: "in", label: "In List" },
  { value: "is_null", label: "Is Null" },
  { value: "is_not_null", label: "Is Not Null" },
]
