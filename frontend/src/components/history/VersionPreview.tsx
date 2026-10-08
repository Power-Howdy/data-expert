import { SidePanel } from "@/components/common/SidePanel"
import { Pager } from "@/components/common/Pager"
import { BrowseTable } from "@/components/browse/BrowseTable"
import { useDatasetColumns } from "@/components/browse/useDatasetColumns"
import { formatNumber } from "@/lib/utils"
import type { VersionInfo } from "@/types/version"
import { useVersionRows } from "./useVersionRows"
import { shortId } from "./versionLabels"

interface VersionPreviewProps {
  datasetId: string
  commit: VersionInfo
  onClose: () => void
}

/** Read-only rows of one version. */
export function VersionPreview({ datasetId, commit, onClose }: VersionPreviewProps) {
  const v = useVersionRows(datasetId, commit.id)
  const columns = useDatasetColumns(v.data?.schema)
  const subtitle = `Version ${shortId(commit.id)} · ${formatNumber(v.data?.total ?? commit.row_count)} rows · read-only`

  return (
    <SidePanel title={commit.message || "Version"} subtitle={subtitle} onClose={onClose} className="max-w-5xl">
      {v.error ? (
        <p className="text-sm font-bold text-destructive">{v.error}</p>
      ) : (
        <div className="h-[calc(100vh-14rem)] min-h-[300px]">
          <BrowseTable
            columns={columns} rows={v.data?.rows ?? []} schema={v.data?.schema ?? []}
            loading={v.loading} rowOffset={v.page * v.pageSize}
          />
        </div>
      )}
      <div className="flex justify-end">
        <Pager page={v.page} pageCount={v.pageCount} onPageChange={v.setPage} disabled={v.loading} />
      </div>
    </SidePanel>
  )
}
