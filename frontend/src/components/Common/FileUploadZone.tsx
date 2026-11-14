import { FileIcon, UploadCloud, X } from "lucide-react"
import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FileUploadZoneProps {
  onFileSelect: (file: File | null) => void
  selectedFile?: File | null
  accept?: string
  maxSizeMB?: number
  className?: string
}

export function FileUploadZone({
  onFileSelect,
  selectedFile,
  accept = "image/*,application/pdf",
  maxSizeMB = 10,
  className,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const validateAndSelect = useCallback(
    (file: File) => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`File too large. Maximum size is ${maxSizeMB}MB.`)
        return
      }
      onFileSelect(file)
    },
    [maxSizeMB, onFileSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) validateAndSelect(file)
    },
    [validateAndSelect],
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSelect(file)
  }

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFileSelect(null)
  }

  const handleClick = () => {
    document.getElementById("file-upload-input")?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <button
      type="button"
      className={cn(
        "relative group cursor-pointer transition-all duration-200 w-full text-left",
        "border-2 border-dashed rounded-xl p-6 block",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/5",
        selectedFile && "border-green-500/50 bg-green-500/5",
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <input
        id="file-upload-input"
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileInput}
      />

      <div className="flex flex-col items-center justify-center gap-2 text-center">
        {!selectedFile ? (
          <>
            <div className="p-3 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
              <UploadCloud className="size-6 text-muted-foreground group-hover:text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, PNG, JPG (max. {maxSizeMB}MB)
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4 w-full p-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <FileIcon className="size-8 text-green-600" />
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-sm font-bold truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove selected file"
              className="hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={clearFile}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </button>
  )
}
