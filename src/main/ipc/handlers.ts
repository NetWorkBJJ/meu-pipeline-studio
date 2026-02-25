import { registerCapCutHandlers } from './capcut.handlers'
import { registerFileHandlers } from './file.handlers'
import { registerProjectHandlers } from './project.handlers'
import { registerWorkspaceHandlers } from './workspace.handlers'
import { registerTtsHandlers } from './tts.handlers'
import { registerDirectorHandlers } from './director.handlers'
import { registerVeo3Handlers } from './veo3.handlers'

export function registerAllHandlers(): void {
  registerCapCutHandlers()
  registerFileHandlers()
  registerProjectHandlers()
  registerWorkspaceHandlers()
  registerTtsHandlers()
  registerDirectorHandlers()
  registerVeo3Handlers()
}
