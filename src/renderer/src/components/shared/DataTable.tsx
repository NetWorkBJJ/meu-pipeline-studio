interface Column<T> {
  key: string
  header: string
  width?: string
  render?: (item: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  emptyMessage?: string
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Nenhum item'
}: DataTableProps<T>): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-surface p-8 text-sm text-text-muted">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-left text-xs font-medium text-text-muted"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className="border-b border-border/50 hover:bg-surface-hover"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2 text-text">
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
