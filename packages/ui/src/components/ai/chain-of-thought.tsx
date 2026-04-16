import {
  BrainIcon,
  ChevronDownIcon,
  DotIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { createContext, memo, useCallback, useContext, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface ChainOfThoughtContextValue {
  readonly isOpen: boolean
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null)

function useChainOfThought() {
  const context = useContext(ChainOfThoughtContext)
  if (!context) {
    throw new Error("ChainOfThought components must be used within ChainOfThought.")
  }

  return context
}

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean) => void
}

export const ChainOfThought = memo(({
  className,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: ChainOfThoughtProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = typeof open === "boolean"
  const isOpen = isControlled ? open : uncontrolledOpen

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }, [isControlled, onOpenChange])

  const contextValue = useMemo(() => ({ isOpen }), [isOpen])

  return (
    <ChainOfThoughtContext.Provider value={contextValue}>
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <div className={cn("not-prose max-w-prose space-y-4", className)} {...props}>
          {children}
        </div>
      </Collapsible>
    </ChainOfThoughtContext.Provider>
  )
})
ChainOfThought.displayName = "ChainOfThought"

export type ChainOfThoughtHeaderProps = ComponentProps<typeof CollapsibleTrigger>

export const ChainOfThoughtHeader = memo(({
  className,
  children,
  ...props
}: ChainOfThoughtHeaderProps) => {
  const { isOpen } = useChainOfThought()

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
      {...props}
    >
      <BrainIcon className="size-4 shrink-0" />
      <span className="flex-1 text-left">{children ?? "Chain of Thought"}</span>
      <ChevronDownIcon
        className={cn("size-4 shrink-0 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
      />
    </CollapsibleTrigger>
  )
})
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader"

export type ChainOfThoughtContentProps = ComponentProps<typeof CollapsibleContent>

export const ChainOfThoughtContent = memo(({
  className,
  children,
  ...props
}: ChainOfThoughtContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-2 space-y-3 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2",
      className,
    )}
    {...props}
  >
    {children}
  </CollapsibleContent>
))
ChainOfThoughtContent.displayName = "ChainOfThoughtContent"

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
  readonly icon?: LucideIcon
  readonly label: ReactNode
  readonly description?: ReactNode
  readonly status?: "complete" | "active" | "pending"
}

export const ChainOfThoughtStep = memo(({
  className,
  icon: Icon = DotIcon,
  label,
  description,
  status = "complete",
  children,
  ...props
}: ChainOfThoughtStepProps) => {
  const statusStyles: Record<NonNullable<ChainOfThoughtStepProps["status"]>, string> = {
    complete: "text-muted-foreground",
    active: "text-foreground",
    pending: "text-muted-foreground/50",
  }

  return (
    <div
      className={cn(
        "flex gap-2 text-sm data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2",
        statusStyles[status],
        className,
      )}
      {...props}
    >
      <div className="relative mt-0.5">
        <Icon className="size-4 shrink-0" />
        <div className="-mx-px absolute top-7 bottom-0 left-1/2 w-px bg-border" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>{label}</div>
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
        {children}
      </div>
    </div>
  )
})
ChainOfThoughtStep.displayName = "ChainOfThoughtStep"

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">

export const ChainOfThoughtSearchResults = memo(({
  className,
  ...props
}: ChainOfThoughtSearchResultsProps) => (
  <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
))
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults"

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>

export const ChainOfThoughtSearchResult = memo(({
  className,
  children,
  ...props
}: ChainOfThoughtSearchResultProps) => (
  <Badge
    className={cn("gap-1 px-2 py-0.5 text-xs font-normal", className)}
    variant="secondary"
    {...props}
  >
    {children}
  </Badge>
))
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult"

export { SearchIcon as SearchStepIcon, DotIcon as DotStepIcon }
