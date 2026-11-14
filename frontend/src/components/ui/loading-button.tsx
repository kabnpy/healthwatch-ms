import type * as React from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export interface ButtonProps extends React.ComponentProps<typeof Button> {
  loading?: boolean
}

function LoadingButton({
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Button disabled={loading || disabled} {...props}>
      {loading && <Spinner className="mr-2" />}
      {children}
    </Button>
  )
}

export { buttonVariants, LoadingButton }
