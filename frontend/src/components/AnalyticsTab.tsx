"use client"
import * as React from "react"
import { useDatasetStore } from "@/stores/useStore"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Loader2, Database, BarChart, TrendingUp, AlertTriangle, X } from "lucide-react"
import { cn, formatNumber, formatPercent, formatBytes } from "@/lib/utils"
import { DatasetProfile, ColumnProfile, AnalyticsOverview } from "@/types"
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import toast from "react-hot-toast"

export function AnalyticsTab() {
  const { selectedDatasetId, datasets } = useDatasetStore()
  const dataset = datasets.find(d => d.id === selectedDatasetId)

  const [overview, setOverview] = React.useState<AnalyticsOverview | null>(null)
  const [profile, setProfile] = React.useState<DatasetProfile | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [activeColumn, setActiveColumn] = React.useState<string | null>(null)
  const [columnDist, setColumnDist] = React.useState<any>(null)
  const [outliers, setOutliers] = React.useState<any>(null)

  React.useEffect(() => {
    if (!dataset) return
    loadOverview()
  }, [dataset])

  const loadOverview = async () => {
    if (!dataset) return
    setLoading(true)
    try {
      const data = await api.getStats(dataset.id)
      setOverview(data)
    } catch (error) {
      toast.error("Failed to load overview")
    } finally {
      setLoading(false)
    }
  }

  const loadProfile = async () => {
    if (!dataset) return
    setProfileLoading(true)
    try {
      const data = await api.getProfile(dataset.id)
      setProfile(data)
    } catch (error) {
      toast.error("Failed to load profile")
    } finally {
      setProfileLoading(false)
    }
  }

  const loadColumnDistribution = async (column: string) => {
    if (!dataset) return
    try {
      const data = await api.getDistribution(dataset.id, column)
      setColumnDist(data)
    } catch (error) {
      toast.error("Failed to load distribution")
    }
  }

  const loadOutliers = async (column: string) => {
    if (!dataset) return
    try {
      const data = await api.getOutliers(dataset.id, column)
      setOutliers(data)
    } catch (error) {
      toast.error("Failed to load outliers")
    }
  }

  const handleColumnClick = (column: string) => {
    setActiveColumn(column)
    loadColumnDistribution(column)
    loadOutliers(column)
  }

  if (!dataset) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select a dataset from the sidebar to view analytics
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dataset.name} Analytics</h1>
          <p className="text-muted-foreground">
            {formatNumber(dataset.row_count)} rows · {dataset.schema.length} columns
          </p>
        </div>
        <Button variant="outline" onClick={loadProfile} disabled={profileLoading}>
          <Loader2 className={cn("h-4 w-4 mr-2", profileLoading && "animate-spin")} />
          {profileLoading ? "Loading..." : profile ? "Refresh Profile" : "Generate Full Profile"}
        </Button>
      </div>

      {loading && overview === null ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Rows" value={formatNumber(overview.row_count)} icon={<Database className="h-5 w-5" />} />
          <StatCard title="Columns" value={String(overview.column_count)} icon={<BarChart className="h-5 w-5" />} />
          <StatCard title="Memory" value={formatBytes(overview.memory_bytes)} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title="Missing %" value={formatPercent(overview.missing_percentage)} icon={<AlertTriangle className="h-5 w-5" />} />
        </div>
      )}

      {profile && (
        <Tabs defaultValue="columns" className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="columns">Column Profiles ({profile.columns.length})</TabsTrigger>
            <TabsTrigger value="correlations">Correlations</TabsTrigger>
            <TabsTrigger value="missing">Missing Values</TabsTrigger>
          </TabsList>

          <TabsContent value="columns" className="flex-1">
            <ScrollArea className="h-full p-2">
              <div className="space-y-4">
                {profile.columns.map((col) => (
                  <ColumnProfileCard
                    key={col.name}
                    column={col}
                    onClick={() => handleColumnClick(col.name)}
                    active={activeColumn === col.name}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="correlations" className="flex-1">
            {profile.correlations ? (
              <CorrelationHeatmap correlations={profile.correlations} columns={profile.columns.map(c => c.name)} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No correlation data available
              </div>
            )}
          </TabsContent>

          <TabsContent value="missing" className="flex-1">
            {profile.missing_matrix ? (
              <MissingMatrix matrix={profile.missing_matrix} columns={profile.columns.map(c => c.name)} />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No missing value data available
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {activeColumn && columnDist && (
        <ColumnDetailPanel
          column={activeColumn}
          distribution={columnDist}
          outliers={outliers}
          onClose={() => setActiveColumn(null)}
        />
      )}
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function ColumnProfileCard({ column, onClick, active }: { column: ColumnProfile; onClick: () => void; active: boolean }) {
  return (
    <Card className={cn("cursor-pointer transition-all", active && "ring-2 ring-primary")} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{column.name}</h4>
              <Badge variant="outline" className="text-xs">{column.type}</Badge>
              {column.null_percentage > 0 && (
                <Badge variant="secondary" className="text-xs">{formatPercent(column.null_percentage)} null</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {formatNumber(column.unique_count)} unique · {formatPercent(column.unique_percentage)} unique
            </p>
          </div>
          {column.type === "integer" || column.type === "float" ? (
            <div className="text-right text-sm">
              <p>Min: {column.min !== undefined ? column.min : "N/A"}</p>
              <p>Max: {column.max !== undefined ? column.max : "N/A"}</p>
              <p>Mean: {column.mean !== undefined ? column.mean.toFixed(2) : "N/A"}</p>
              <p>Std: {column.std !== undefined ? column.std.toFixed(2) : "N/A"}</p>
            </div>
          ) : column.top_values && column.top_values.length > 0 ? (
            <div className="text-right text-sm text-muted-foreground">
              Top: {column.top_values[0].value} ({column.top_values[0].count})
            </div>
          ) : null}
        </div>
        
        {column.histogram && (
          <div className="mt-3 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={column.histogram.bins.map((count: number, i: number) => ({
                count,
                range: `${column.histogram!.bin_edges[i].toFixed(1)}-${column.histogram!.bin_edges[i+1]?.toFixed(1) || ''}`
              }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {column.top_values && column.top_values.length > 0 && !column.histogram && (
          <div className="mt-3 space-y-1">
            {column.top_values.slice(0, 5).map((tv, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate max-w-[200px]">{String(tv.value)}</span>
                <span className="text-muted-foreground">{tv.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CorrelationHeatmap({ correlations, columns }: { correlations: Record<string, Record<string, number>>; columns: string[] }) {
  const data = columns.map(col1 => ({
    column: col1,
    ...columns.reduce((acc, col2) => {
      acc[col2] = correlations[col1]?.[col2] ?? 0
      return acc
    }, {} as Record<string, number>)
  }))

  return (
    <div className="h-full p-4 overflow-auto">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 p-2 bg-background border border-border">Column</th>
              {columns.map(col => (
                <th key={col} className="p-2 border border-border text-center rotate-45 origin-left min-w-[60px]">
                  <div className="whitespace-nowrap">{col}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.column}>
                <td className="sticky left-0 p-2 bg-background border border-border font-medium">{row.column}</td>
                {columns.map(col => {
                  const value = row[col as keyof typeof row] as unknown as number
                  const intensity = Math.abs(value)
                  const bgColor = value > 0 
                    ? `rgba(59, 130, 246, ${intensity * 0.5})` 
                    : `rgba(239, 68, 68, ${intensity * 0.5})`
                  return (
                    <td key={col} className="p-2 border border-border text-center" style={{ backgroundColor: bgColor }}>
                      {value.toFixed(2)}
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

function MissingMatrix({ matrix, columns }: { matrix: Record<string, Record<string, number>>; columns: string[] }) {
  return (
    <div className="h-full p-4 overflow-auto">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 p-2 bg-background border border-border">Column</th>
              {columns.map(col => (
                <th key={col} className="p-2 border border-border text-center rotate-45 origin-left min-w-[60px]">
                  <div className="whitespace-nowrap">{col}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map(col1 => (
              <tr key={col1}>
                <td className="sticky left-0 p-2 bg-background border border-border font-medium">{col1}</td>
                {columns.map(col2 => {
                  const value = matrix[col1]?.[col2] ?? 0
                  const total = matrix[col1]?.[col1] ?? 1
                  const pct = (value / total * 100).toFixed(1)
                  return (
                    <td key={col2} className="p-2 border border-border text-center" style={{ backgroundColor: `rgba(239, 68, 68, ${value / total * 0.5})` }}>
                      {pct}%
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

function ColumnDetailPanel({ column, distribution, outliers, onClose }: { 
  column: string; 
  distribution: any; 
  outliers: any; 
  onClose: () => void 
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border-l h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Column Details: {column}</h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ScrollArea className="flex-1 p-4 space-y-6">
          <div>
            <h4 className="font-medium mb-2">Distribution</h4>
            {distribution.type === "histogram" && (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={distribution.bins.map((count: number, i: number) => ({
                  count,
                  range: `${distribution.bin_edges[i].toFixed(2)}-${distribution.bin_edges[i+1]?.toFixed(2) || ''}`
                }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
            {distribution.type === "bar" && (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={distribution.values.map((v: any, i: number) => ({
                  value: v,
                  count: distribution.counts[i]
                }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="value" tick={{ fontSize: 10 }} type="category" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </div>

          {outliers && outliers.count > 0 && (
            <div>
              <h4 className="font-medium mb-2">Outliers ({outliers.count} found)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Method: {outliers.method} (threshold: {outliers.threshold})
              </p>
              <div className="max-h-40 overflow-auto text-sm font-mono">
                {outliers.outliers.slice(0, 50).map((v: any, i: number) => (
                  <div key={i}>{v}</div>
                ))}
                {outliers.outliers.length > 50 && <div className="text-muted-foreground">... and {outliers.outliers.length - 50} more</div>}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}