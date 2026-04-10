import { useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete01Icon,
  Edit01Icon,
  More01Icon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons"
import { useChatStore } from "@/stores/chatStore"
import type { ChatSession } from "@/stores/chatStore"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

function SessionItem({ session }: { session: ChatSession }) {
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const selectSession = useChatStore((s) => s.selectSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const renameSession = useChatStore((s) => s.renameSession)
  const pinSession = useChatStore((s) => s.pinSession)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(session.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== session.title) {
      renameSession(session.id, trimmed)
    } else {
      setRenameValue(session.title)
    }
    setIsRenaming(false)
  }

  const startRename = () => {
    setRenameValue(session.title)
    setIsRenaming(true)
    // Focus after render
    setTimeout(() => inputRef.current?.select(), 0)
  }

  return (
    <SidebarMenuItem>
      {isRenaming ? (
        <div className="flex items-center px-2 py-1">
          <Input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") {
                setRenameValue(session.title)
                setIsRenaming(false)
              }
            }}
            className="h-7 text-sm"
            autoFocus
          />
        </div>
      ) : (
        <>
          <SidebarMenuButton
            isActive={session.id === activeSessionId}
            onClick={() => selectSession(session.id)}
            className="pr-8"
          >
            {session.pinnedAt && (
              <HugeiconsIcon icon={PinIcon} size={12} className="shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{session.title}</span>
          </SidebarMenuButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction showOnHover>
                <HugeiconsIcon icon={More01Icon} size={16} />
                <span className="sr-only">More options</span>
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-44">
              <DropdownMenuItem onClick={startRename}>
                <HugeiconsIcon icon={Edit01Icon} size={16} className="mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pinSession(session.id)}>
                <HugeiconsIcon
                  icon={session.pinnedAt ? PinOffIcon : PinIcon}
                  size={16}
                  className="mr-2"
                />
                {session.pinnedAt ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => deleteSession(session.id)}
                className="text-destructive focus:text-destructive"
              >
                <HugeiconsIcon icon={Delete01Icon} size={16} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </SidebarMenuItem>
  )
}

export function ChatHistory() {
  const sessions = useChatStore((s) => s.sessions)
  const createSession = useChatStore((s) => s.createSession)

  const pinned = sessions.filter((s) => s.pinnedAt !== null).sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
  const recent = sessions.filter((s) => s.pinnedAt === null)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarGroupAction title="New chat" onClick={createSession}>
        <HugeiconsIcon icon={Add01Icon} size={16} />
        <span className="sr-only">New chat</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        {sessions.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No chats yet</p>
        ) : (
          <SidebarMenu>
            {pinned.length > 0 && (
              <>
                {pinned.map((session) => (
                  <SessionItem key={session.id} session={session} />
                ))}
                {recent.length > 0 && <SidebarSeparator className="my-1" />}
              </>
            )}
            {recent.map((session) => (
              <SessionItem key={session.id} session={session} />
            ))}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
