import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DirectoryScanInputProps {
  value: string
  onChange: (value: string) => void
  onScan: () => void
  loading: boolean
}

export function DirectoryScanInput({ value, onChange, onScan, loading }: DirectoryScanInputProps) {
  return (
    <div className="p-4 border-b space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Data Directory</label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onScan()}
          placeholder="Enter directory path..."
          className="flex-1"
        />
        <Button onClick={onScan} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
