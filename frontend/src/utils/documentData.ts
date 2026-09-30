/**
 * Utilities for handling the "Document-as-Data" blueprint format.
 */

export interface WizardField {
  path: string[] // Path to the value in the JSON object
  label: string
  type: string // text, number, date, boolean
}

/**
 * Recursively crawls a blueprint JSON to find <<placeholders>>.
 * Returns a flat list of fields for the minimal wizard.
 */
export function extractWizardFields(
  obj: any,
  path: string[] = [],
): WizardField[] {
  const fields: WizardField[] = []

  if (typeof obj !== "object" || obj === null) {
    if (typeof obj === "string" && obj.startsWith("<<") && obj.endsWith(">>")) {
      const type = obj.slice(2, -2)
      // The label is the last segment of the path
      const label = path[path.length - 1] || "Field"
      fields.push({ path, label, type })
    }
    return fields
  }

  if (Array.isArray(obj)) {
    // We typically don't expect placeholders inside lists in the blueprint,
    // but we could support it if needed. For now, skip.
    return fields
  }

  for (const [key, value] of Object.entries(obj)) {
    fields.push(...extractWizardFields(value, [...path, key]))
  }

  return fields
}

/**
 * Deeply merges user inputs from the wizard into the blueprint to create the final document data.
 */
export function injectWizardData(
  blueprint: any,
  inputs: any,
  fullPath: string[] = [],
  rootInputs?: any, // Keep reference to the root for absolute path lookups
): any {
  if (typeof blueprint !== "object" || blueprint === null) {
    return blueprint
  }

  const actualRoot = rootInputs || inputs

  /**
   * Helper to get value from a nested object using dot-notation path.
   * Handles keys that might contain dots themselves by trying literal matches.
   */
  const getValueByPath = (obj: any, path: string): any => {
    if (!obj || !path) return undefined

    // 1. Try literal match for the whole path
    if (obj[path] !== undefined) return obj[path]

    // 2. Try splitting by dot
    const parts = path.split(".")
    let current = obj

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (
        current &&
        typeof current === "object" &&
        current[part] !== undefined
      ) {
        current = current[part]
      } else {
        // Fallback: maybe the dot is part of the key
        // Try combining current part with the next one
        if (current && typeof current === "object" && i < parts.length - 1) {
          const combined = `${part}.${parts[i + 1]}`
          if (current[combined] !== undefined) {
            current = current[combined]
            i++ // Skip next part
            continue
          }
        }
        return undefined
      }
    }
    return current
  }

  if (Array.isArray(blueprint)) {
    return blueprint.map((item) =>
      injectWizardData(item, inputs, fullPath, actualRoot),
    )
  }

  const result: any = {}
  for (const [key, value] of Object.entries(blueprint)) {
    const currentPath = [...fullPath, key]
    const dotPath = currentPath.join(".")

    if (
      typeof value === "string" &&
      value.startsWith("<<") &&
      value.endsWith(">>")
    ) {
      // The content inside << >> can be a type (like <<text>>) or a specific path (like <<VEHICLE DETAILS.Reg. No>>)
      const pathOrType = value.slice(2, -2)

      // 1. Try to find the value by dot-notated full path from current position (flat inputs)
      if (inputs && inputs[dotPath] !== undefined) {
        result[key] = inputs[dotPath]
      }
      // 2. Try the dotPath from root
      else if (getValueByPath(actualRoot, dotPath) !== undefined) {
        result[key] = getValueByPath(actualRoot, dotPath)
      }
      // 3. Try the content of the placeholder as a direct path from root
      else if (getValueByPath(actualRoot, pathOrType) !== undefined) {
        result[key] = getValueByPath(actualRoot, pathOrType)
      } else {
        result[key] = "[ EMPTY ]"
      }
    } else if (typeof value === "object" && value !== null) {
      // Recurse, passing the same root inputs to allow absolute path resolution
      // We pass the nested input object if it exists at the current key,
      // otherwise we pass the same inputs to allow flat path lookups.
      const nextInputs =
        inputs && typeof inputs === "object" && inputs[key]
          ? inputs[key]
          : inputs

      result[key] = injectWizardData(value, nextInputs, currentPath, actualRoot)
    } else {
      result[key] = value
    }
  }
  return result
}
