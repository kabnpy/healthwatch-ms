import { Plus, Trash2 } from "lucide-react"
import React from "react"
import { Button } from "@/components/ui/button"
import type { RiskNoteContentValue, RiskNoteSection } from "@/types/insurance"

interface RiskNoteTableProps {
  sections: RiskNoteSection[]
  isEditable?: boolean
  onChange?: (sectionName: string, updatedContent: any) => void
  onRemoveSection?: (sectionName: string) => void
  onAddSection?: () => void
}

export const RiskNoteTable = ({
  sections,
  isEditable = false,
  onChange,
  onRemoveSection,
  onAddSection,
}: RiskNoteTableProps) => {
  const handleValueChange = (
    sectionName: string,
    key: string,
    newValue: any,
  ) => {
    if (!onChange) return
    const section = sections.find((s) => s.name === sectionName)
    if (
      section &&
      typeof section.content === "object" &&
      section.content !== null &&
      !Array.isArray(section.content)
    ) {
      const updatedContent = { ...(section.content as object), [key]: newValue }
      onChange(sectionName, updatedContent)
    }
  }

  const handleRemoveRow = (sectionName: string, key: string) => {
    if (!onChange) return
    const section = sections.find((s) => s.name === sectionName)
    if (
      section &&
      typeof section.content === "object" &&
      section.content !== null &&
      !Array.isArray(section.content)
    ) {
      const content = section.content as Record<string, any>
      const { [key]: _, ...restContent } = content
      onChange(sectionName, restContent)
    }
  }

  const handleAddRow = (sectionName: string) => {
    if (!onChange) return
    const section = sections.find((s) => s.name === sectionName)
    if (
      section &&
      typeof section.content === "object" &&
      section.content !== null &&
      !Array.isArray(section.content)
    ) {
      onChange(sectionName, {
        ...(section.content as Record<string, any>),
        "New Field": "New Value",
      })
    }
  }

  const renderValue = (v: RiskNoteContentValue): React.ReactNode => {
    if (v === null || v === undefined) return "—"
    if (React.isValidElement(v)) return v
    if (typeof v === "object") {
      if (Array.isArray(v)) {
        return (
          <ul className="list-disc list-inside">
            {v.map((item, i) => (
              <li key={i}>{renderValue(item)}</li>
            ))}
          </ul>
        )
      }
      // If it's a nested object but we are already in a table row, just JSON stringify or show summary
      return JSON.stringify(v)
    }
    const strV = String(v)
    return strV.startsWith("<<") ? "—" : strV
  }

  const renderContentCell = (section: RiskNoteSection) => {
    const value = section.content

    // 1. Handle React Elements (JSX) - directly injected pre-formatted content
    if (React.isValidElement(value)) {
      return value
    }

    // 2. Handle Arrays (Lists like Special Clauses)
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {value.map((item, idx) => (
            <li key={idx} className="text-[11px] text-black leading-tight">
              {renderValue(item)}
            </li>
          ))}
        </ul>
      )
    }

    // 3. Handle Nested Objects (Standard Section Fields)
    if (typeof value === "object" && value !== null) {
      return (
        <table className="w-full border-collapse">
          <tbody>
            {Object.entries(value).map(([k, v]) => (
              <tr key={k} className="group/row">
                <td className="py-1.5 pr-4 w-1/3 align-top">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
                    {k.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-1.5 align-top">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {isEditable ? (
                        <input
                          type="text"
                          value={
                            typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)
                          }
                          onChange={(e) =>
                            handleValueChange(section.name, k, e.target.value)
                          }
                          className="w-full bg-slate-50 border-none text-[11px] focus:ring-1 focus:ring-primary rounded px-2 h-7 font-medium"
                        />
                      ) : (
                        <div className="text-[11px] text-black leading-tight font-bold tracking-tight">
                          {renderValue(v)}
                        </div>
                      )}
                    </div>
                    {isEditable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 opacity-0 group-hover/row:opacity-100 text-destructive"
                        onClick={() => handleRemoveRow(section.name, k)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {isEditable && (
              <tr>
                <td colSpan={2} className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-[9px] text-muted-foreground"
                    onClick={() => handleAddRow(section.name)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Field
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )
    }

    // 4. Handle Primitives (String/Number)
    return (
      <span className="text-[11px] text-black leading-relaxed">
        {String(value)}
      </span>
    )
  }

  return (
    <div className="w-full">
      <table className="w-full border-collapse border-t-2 border-black">
        <tbody>
          {sections.map((section) => (
            <tr
              key={section.name}
              className="border-b border-black/10 group/section"
            >
              <th scope="row" className="py-4 px-0 w-[20%] align-top text-left">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                    {section.name}
                  </span>
                  {isEditable && onRemoveSection && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1 text-[8px] uppercase font-bold hover:bg-black/5 text-destructive self-start opacity-0 group-hover/section:opacity-100 transition-opacity"
                      onClick={() => onRemoveSection(section.name)}
                    >
                      <Trash2 className="h-2.5 w-2.5 mr-1" /> Delete
                    </Button>
                  )}
                </div>
              </th>
              <td className="py-4 px-6 align-top border-l border-black/5">
                {renderContentCell(section)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isEditable && onAddSection && (
        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full border-dashed h-8 text-xs"
            onClick={onAddSection}
          >
            <Plus className="h-3 w-3 mr-2" /> Add New Section
          </Button>
        </div>
      )}
    </div>
  )
}
