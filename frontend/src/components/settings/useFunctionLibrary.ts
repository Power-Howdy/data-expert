import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { aiApi } from "@/lib/aiApi"
import type { FunctionSpec } from "@/types/ai"

export function useFunctionLibrary() {
  const [functions, setFunctions] = useState<FunctionSpec[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setFunctions(await aiApi.listFunctions())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const categories = useMemo(() => [...new Set(functions.map((f) => f.category))].sort(), [functions])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return functions.filter((f) =>
      (!category || f.category === category) &&
      (!q || `${f.name} ${f.title} ${f.purpose}`.toLowerCase().includes(q))
    )
  }, [functions, query, category])

  const remove = useCallback(async (name: string) => {
    await aiApi.deleteFunction(name)
    setFunctions((current) => current.filter((f) => f.name !== name))
    toast.success(`Deleted ${name}`)
  }, [])

  const generatedCount = functions.filter((f) => f.source === "generated").length

  return { functions, visible, loading, query, setQuery, category, setCategory, categories, remove, generatedCount, reload }
}
