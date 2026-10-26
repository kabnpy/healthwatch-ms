import { FileText, Info } from "lucide-react"
import { useMemo } from "react"
import { useFormContext } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RiskNoteTable } from "./RiskNoteTable"

export const SchemaBuilder = () => {
  const { watch, setValue } = useFormContext()
  const productDetails = watch("product_details") || {}

  const handleDataChange = (sectionName: string, updatedContent: any) => {
    const newData = { ...productDetails, [sectionName]: updatedContent }
    setValue("product_details", newData, { shouldDirty: true })
  }

  const handleRemoveSection = (sectionName: string) => {
    const newData = { ...productDetails }
    delete newData[sectionName]
    setValue("product_details", newData, { shouldDirty: true })
  }

  const handleAddSection = () => {
    const newData = { ...productDetails, "NEW SECTION": {} }
    setValue("product_details", newData, { shouldDirty: true })
  }

  // Convert product_details object to sections array
  const tableSections = useMemo(() => {
    return Object.entries(productDetails).map(([name, content]) => ({
      name,
      content: content as any,
    }))
  }, [productDetails])

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-40">
      {/* HEADER INFO */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 text-xs">
          Use <strong>{"<<text>>"}</strong> or <strong>{"<<number>>"}</strong>{" "}
          to create input fields for the Policy Wizard. Everything else will
          appear as fixed text on the Risk Note.
        </AlertDescription>
      </Alert>

      {/* THE "PAPER" */}
      <div className="bg-white shadow-2xl border border-slate-200 min-h-[800px] rounded-sm flex flex-col overflow-hidden">
        {/* Paper Header Decoration */}
        <div className="p-10 border-b-2 border-black/5 bg-slate-50/30">
          <div className="flex justify-between items-start text-black">
            <div>
              <div className="h-4 w-32 bg-slate-200 rounded mb-3" />
              <div className="h-8 w-64 bg-slate-100 rounded" />
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-5 w-40 bg-slate-100 rounded" />
            </div>
          </div>
        </div>

        <div className="flex-1 p-0">
          <RiskNoteTable
            sections={tableSections}
            isEditable={true}
            onChange={handleDataChange}
            onRemoveSection={handleRemoveSection}
            onAddSection={handleAddSection}
          />

          {Object.keys(productDetails).length === 0 && (
            <div className="p-20 text-center flex flex-col items-center">
              <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-slate-200">
                <FileText className="h-10 w-10 text-slate-300" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 tracking-tight">
                Empty Template
              </h4>
              <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm">
                Start by creating your first section.
              </p>
            </div>
          )}
        </div>

        {/* Paper Footer Decoration */}
        <div className="p-12 mt-auto border-t-4 border-black/5 opacity-30 grayscale">
          <div className="h-4 w-full bg-slate-100 rounded mb-2" />
          <div className="h-4 w-3/4 bg-slate-100 rounded" />
        </div>
      </div>
    </div>
  )
}
