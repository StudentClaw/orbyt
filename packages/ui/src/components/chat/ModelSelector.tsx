import { useMemo, useState } from "react"
import type { ChatModel } from "@orbyt/contracts"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface ModelSelectorProps {
  readonly models: readonly ChatModel[]
  readonly selectedModel: string
  readonly onModelChange: (model: string) => void
  readonly disabled?: boolean
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
}

export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
}: ModelSelectorProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen)
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen)
    }
  }

  const current = useMemo(() => {
    return models.find((model) => model.id === selectedModel) ?? models[0] ?? null
  }, [models, selectedModel])

  const standardModels = useMemo(
    () => models.filter((model) => model.group === "standard"),
    [models],
  )
  const reasoningModels = useMemo(
    () => models.filter((model) => model.group === "reasoning"),
    [models],
  )

  if (models.length <= 1 || !current) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Select model"
        >
          {current.label}
          <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            {standardModels.length > 0 && (
              <CommandGroup heading="Standard">
                {standardModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={`${model.id} ${model.label} ${model.description}`}
                    onSelect={() => {
                      onModelChange(model.id)
                      setOpen(false)
                    }}
                  >
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="text-sm">{model.label}</span>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                    </span>
                    {selectedModel === model.id && (
                      <HugeiconsIcon icon={Tick01Icon} size={16} className="ml-auto shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {reasoningModels.length > 0 && (
              <CommandGroup heading="Reasoning">
                {reasoningModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={`${model.id} ${model.label} ${model.description}`}
                    onSelect={() => {
                      onModelChange(model.id)
                      setOpen(false)
                    }}
                  >
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="text-sm">{model.label}</span>
                      <span className="text-xs text-muted-foreground">{model.description}</span>
                    </span>
                    {selectedModel === model.id && (
                      <HugeiconsIcon icon={Tick01Icon} size={16} className="ml-auto shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
