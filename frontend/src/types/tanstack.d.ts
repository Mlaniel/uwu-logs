import '@tanstack/vue-table'

declare module '@tanstack/table-core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    cls?: string      // CSS class applied to both header and data cells
    noHide?: boolean  // exclude from column picker (always visible)
  }
}
