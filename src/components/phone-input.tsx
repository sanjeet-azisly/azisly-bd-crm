"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Indian mobile number box with a fixed +91 in front. Keeps digits only, and if
 * someone pastes "+91 98765 43210" or "098765 43210" it keeps the 10-digit number.
 */
export function PhoneInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string
  onChange: (digits: string) => void
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center overflow-hidden rounded-lg border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <span className="flex h-full items-center border-r bg-muted px-3 text-sm font-medium text-muted-foreground select-none">
        +91
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="98765 43210"
        {...props}
        value={value}
        onChange={(e) => {
          let digits = e.target.value.replace(/\D/g, "")
          if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2)
          if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1)
          onChange(digits.slice(0, 10))
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
