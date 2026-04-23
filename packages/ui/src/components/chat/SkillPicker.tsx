import { useEffect, useMemo, useRef, useState } from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { MoreHorizontal } from "lucide-react"

export type SkillPickerTier = "curated" | "custom"

export type SkillPickerEntry = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly tier?: SkillPickerTier
  readonly requestedCapabilities?: readonly string[]
  readonly missingCapabilities?: readonly string[]
  readonly forkedFrom?: string | null
  readonly editable?: boolean
}

interface SkillPickerProps {
  readonly skills: readonly SkillPickerEntry[]
  readonly filter: string
  readonly onSelect: (skill: SkillPickerEntry) => void
  readonly onManagePermissions?: (skill: SkillPickerEntry) => void
  readonly onFork?: (skill: SkillPickerEntry) => void
  readonly onEdit?: (skill: SkillPickerEntry) => void
  readonly highlightedIndex?: number
  readonly onHighlightChange?: (index: number) => void
  readonly onVisibleCountChange?: (count: number) => void
  /**
   * When true, the current thread has Full Access enabled so skill capability
   * checks are effectively bypassed. The picker suppresses "Needs permission"
   * prompts and missing-count badges.
   */
  readonly fullAccess?: boolean
}

export function filterSkills(
  skills: readonly SkillPickerEntry[],
  filter: string,
): readonly SkillPickerEntry[] {
  const q = filter.toLowerCase()
  if (q === "") return skills
  return skills.filter(
    (s) => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  )
}

function tierLabel(skill: SkillPickerEntry): "Curated" | "Forked" | "Custom" {
  if (skill.tier === "custom" && skill.forkedFrom) return "Forked"
  if (skill.tier === "custom") return "Custom"
  return "Curated"
}

export function SkillPicker({
  skills,
  filter,
  onSelect,
  onManagePermissions,
  onFork,
  onEdit,
  highlightedIndex,
  onHighlightChange,
  onVisibleCountChange,
  fullAccess = false,
}: SkillPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null)

  const visible = useMemo(() => filterSkills(skills, filter), [skills, filter])

  useEffect(() => {
    onVisibleCountChange?.(visible.length)
  }, [visible.length, onVisibleCountChange])

  useEffect(() => {
    if (highlightedIndex === undefined) return
    const el = itemRefs.current[highlightedIndex]
    if (el) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex])

  const cmdkValue =
    highlightedIndex !== undefined && visible[highlightedIndex]
      ? visible[highlightedIndex].id
      : ""

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-xl">
      <Command shouldFilter={false} value={cmdkValue} className="bg-transparent">
        <CommandList>
          <CommandEmpty className="py-4 text-xs text-muted-foreground">
            No skills found
          </CommandEmpty>
          <CommandGroup>
            {visible.map((skill, index) => {
              const label = tierLabel(skill)
              const rawMissing = skill.missingCapabilities ?? []
              const missing = fullAccess ? [] : rawMissing
              const editable = skill.editable === true
              const hasMenuActions = Boolean(onFork || onManagePermissions || (onEdit && editable))
              const isHighlighted = index === highlightedIndex
              return (
                <CommandItem
                  key={skill.id}
                  value={skill.id}
                  ref={(el) => {
                    itemRefs.current[index] = el as HTMLDivElement | null
                  }}
                  onSelect={() => onSelect(skill)}
                  onMouseEnter={() => onHighlightChange?.(index)}
                  data-highlighted={isHighlighted ? "" : undefined}
                  aria-selected={isHighlighted || undefined}
                  className={cn(
                    "flex items-start gap-2 rounded-xl py-2.5",
                    isHighlighted && "bg-accent text-accent-foreground",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">/{skill.name}</span>
                      <Badge
                        variant={label === "Curated" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {label}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {skill.description}
                    </span>
                    {missing.length > 0 && onManagePermissions ? (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onManagePermissions(skill)
                        }}
                        className="mt-1 self-start text-[11px] font-medium text-amber-600 hover:underline"
                      >
                        Needs permission ({missing.length})
                      </button>
                    ) : null}
                  </div>

                  {hasMenuActions ? (
                    <DropdownMenu
                      open={openMenuFor === skill.id}
                      onOpenChange={(open) => setOpenMenuFor(open ? skill.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${skill.name}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setOpenMenuFor(openMenuFor === skill.id ? null : skill.id)
                          }}
                          className="mt-0.5 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                        {onManagePermissions ? (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              setOpenMenuFor(null)
                              onManagePermissions(skill)
                            }}
                          >
                            Manage permissions
                            {missing.length > 0 ? (
                              <span className="ml-auto text-[10px] text-amber-600">
                                {missing.length}
                              </span>
                            ) : null}
                          </DropdownMenuItem>
                        ) : null}
                        {onFork ? (
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              setOpenMenuFor(null)
                              onFork(skill)
                            }}
                          >
                            Fork into custom skill
                          </DropdownMenuItem>
                        ) : null}
                        {onEdit && editable ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                setOpenMenuFor(null)
                                onEdit(skill)
                              }}
                            >
                              Edit skill
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
