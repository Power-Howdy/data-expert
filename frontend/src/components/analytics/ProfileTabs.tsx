import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/common/EmptyState"
import { DatasetProfile } from "@/types"
import { ColumnProfileCard } from "./ColumnProfileCard"
import { CorrelationsView } from "./CorrelationsView"
import { MissingValuesView } from "./MissingValuesView"
import { QualityOverview } from "./QualityOverview"
import { AIInsightsPanel } from "./AIInsightsPanel"

interface ProfileTabsProps {
  profile: DatasetProfile
  activeColumn: string | null
  onColumnClick: (column: string) => void
}

export function ProfileTabs({ profile, activeColumn, onColumnClick }: ProfileTabsProps) {
  return (
    <Tabs defaultValue="overview" className="flex-1">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="columns">Column Profiles ({profile.columns.length})</TabsTrigger>
        <TabsTrigger value="correlations">Correlations</TabsTrigger>
        <TabsTrigger value="missing">Missing Values</TabsTrigger>
        <TabsTrigger value="insights">AI Insights</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="flex-1">
        <QualityOverview columns={profile.columns} />
      </TabsContent>
      <TabsContent value="columns" className="flex-1">
        <div className="p-2">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {profile.columns.map((col) => (
              <ColumnProfileCard
                key={col.name}
                column={col}
                onClick={() => onColumnClick(col.name)}
                active={activeColumn === col.name}
              />
            ))}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="correlations" className="flex-1">
        {profile.correlations
          ? <CorrelationsView correlations={profile.correlations} />
          : <EmptyState>Correlations need at least two numeric columns</EmptyState>}
      </TabsContent>
      <TabsContent value="missing" className="flex-1">
        <MissingValuesView columns={profile.columns} matrix={profile.missing_matrix} />
      </TabsContent>
      <TabsContent value="insights" className="flex-1">
        <AIInsightsPanel datasetId={profile.dataset_id} />
      </TabsContent>
    </Tabs>
  )
}
