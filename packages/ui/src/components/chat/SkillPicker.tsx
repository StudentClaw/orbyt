import { useRef } from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export type SkillPickerEntry = {
  readonly id: string
  readonly name: string
  readonly description: string
}

interface SkillPickerProps {
  readonly skills: readonly SkillPickerEntry[]
  readonly filter: string
  readonly onSelect: (skill: SkillPickerEntry) => void
  readonly onDismiss: () => void
}

export function SkillPicker({ skills, filter, onSelect, onDismiss }: SkillPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const visible = skills.filter((s) => {
    const q = filter.toLowerCase()
    return q === "" || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  })

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 z-50 mb-1 mx-3 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-lg"
    >
      <Command shouldFilter={false}>
        <CommandList>
          <CommandEmpty className="py-4 text-xs text-muted-foreground">
            No skills found
          </CommandEmpty>
          <CommandGroup>
            {visible.map((skill) => (
              <CommandItem
                key={skill.id}
                value={skill.id}
                onSelect={() => onSelect(skill)}
                className="flex flex-col items-start gap-0.5 rounded-xl py-2.5"
              >
                <span className="text-sm font-medium text-foreground">
                  /{skill.name}
                </span>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {skill.description}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
