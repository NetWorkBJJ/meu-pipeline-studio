import { registerCapCutHandlers } from './capcut.handlers'
import { registerFileHandlers } from './file.handlers'
import { registerProjectHandlers } from './project.handlers'
import { registerWorkspaceHandlers } from './workspace.handlers'

export function registerAllHandlers(): void {
  registerCapCutHandlers()
  registerFileHandlers()
  registerProjectHandlers()
  registerWorkspaceHandlers()
}
