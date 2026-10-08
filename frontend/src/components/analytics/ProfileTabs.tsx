import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/common/EmptyState"
import { DatasetProfile } from "@/types"
import { ColumnProfileCard } from "./ColumnProfileCard"
import { CorrelationHeatmap } from "./CorrelationHeatmap"
import { MissingMatrix } from "./MissingMatrix"

interface ProfileTabsProps {
  profile: DatasetProfile
  activeColumn: string | null
  onColumnClick: (column: string) => void
}

export function ProfileTabs({ profile, activeColumn, onColumnClick }: ProfileTabsProps) {
  const columnNames = profile.columns.map((c) => c.name)
  return (
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
                onClick={() => onColumnClick(col.name)}
                active={activeColumn === col.name}
              />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="correlations" className="flex-1">
        {profile.correlations
          ? <CorrelationHeatmap correlations={profile.correlations} columns={columnNames} />
          : <EmptyState>No correlation data available</EmptyState>}
      </TabsContent>
      <TabsContent value="missing" className="flex-1">
        {profile.missing_matrix
          ? <MissingMatrix matrix={profile.missing_matrix} columns={columnNames} />
          : <EmptyState>No missing value data available</EmptyState>}
      </TabsContent>
    </Tabs>
  )
}
