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
              <th className={stickyClass}>Column</th>
              {columns.map((col) => (
                <th key={col} className={`${cellClass} text-center rotate-45 origin-left min-w-[60px]`}>
                  <div className="whitespace-nowrap">{col}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map((row) => (
              <tr key={row}>
                <td className={`${stickyClass} font-medium`}>{row}</td>
                {columns.map((col) => {
                  const cell = getCell(row, col)
                  return (
                    <td key={col} className={`${cellClass} text-center`} style={{ backgroundColor: cell.color }}>
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
