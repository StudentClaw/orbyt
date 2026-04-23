import { Context } from "effect"
import type { SkillManagementService } from "./SkillManagementService.js"

export class SkillManagement extends Context.Tag("SkillManagement")<
  SkillManagement,
  SkillManagementService
>() {}
