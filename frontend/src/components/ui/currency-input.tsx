import * as React from "react"
import { Input } from "@/components/ui/input"

interface CurrencyInputProps extends React.ComponentProps<"input"> {
  value: number
  onValueChange: (value: number) => void
}

export const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(({ value, onValueChange, ...props }, ref) => {
  const [displayValue, setDisplayValue] = React.useState("")

  // Format number to string with commas
  const format = (val: number) => {
    if (Number.isNaN(val) || val === 0) return ""
    return new Intl.NumberFormat("en-KE").format(val)
  }

  // Initialize display value
  React.useEffect(() => {
    const formatted = format(value)
    if (formatted !== displayValue) {
      setDisplayValue(formatted)
    }
  }, [value, format, displayValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, "")
    if (raw === "" || !Number.isNaN(Number(raw))) {
      const digitsAndDot = e.target.value.replace(/[^\d.]/g, "")
      const [integers, decimals] = digitsAndDot.split(".")
      const formattedInts = integers.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      const limitedDecimals =
        decimals !== undefined ? decimals.slice(0, 2) : undefined
      setDisplayValue(
        limitedDecimals !== undefined
          ? `${formattedInts}.${limitedDecimals}`
          : formattedInts,
      )
      const correctedNum = Math.round(Number(digitsAndDot) * 100) / 100 || 0
      onValueChange(correctedNum)
    }
  }

  return (
    <Input
      {...props}
      ref={ref}
      value={displayValue}
      onChange={handleChange}
      placeholder="0"
    />
  )
})

CurrencyInput.displayName = "CurrencyInput"
