export interface HeatmapCell {
  label: string
  color: string
}

interface HeatmapTableProps {
  columns: string[]
  getCell: (row: string, col: string) => HeatmapCell
}

const cellClass = "p-2 border border-border"
const stickyClass = `sticky left-0 bg-background ${cellClass}`

export function HeatmapTable({ columns, getCell }: HeatmapTableProps) {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${stickyClass} z-10 text-left align-bottom`}>Column</th>
              {columns.map((col) => (
                <th
                  key={col}
                  title={col}
                  className={`${cellClass} min-w-[88px] max-w-[140px] break-words text-center align-bottom text-xs font-semibold leading-tight`}
                >
                  {col.replace(/_/g, "_\u200B")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map((row) => (
              <tr key={row}>
                <td className={`${stickyClass} min-w-[120px] max-w-[200px] break-words font-medium`}>
                  {row.replace(/_/g, "_\u200B")}
                </td>
                {columns.map((col) => {
                  const cell = getCell(row, col)
                  return (
                    <td key={col} className={`${cellClass} text-center tabular-nums`} style={{ backgroundColor: cell.color }}>
                      {cell.label}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
