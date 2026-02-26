import { ipcMain } from 'electron'
import { cdpCore } from '../veo3/cdp-core'

export function registerCdpHandlers(): void {
  ipcMain.handle('cdp:attach', async (_event, webContentsId: number) => {
    try {
      await cdpCore.attach(webContentsId)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('cdp:detach', async () => {
    cdpCore.detach()
    return { success: true }
  })

  ipcMain.handle('cdp:click-element', async (_event, selector: string) => {
    try {
      const clicked = await cdpCore.clickElement(selector)
      return { success: clicked }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('cdp:type', async (_event, text: string) => {
    try {
      await cdpCore.type(text)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('cdp:press', async (_event, key: string) => {
    try {
      await cdpCore.press(key)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(
    'cdp:evaluate',
    async (_event, expression: string) => {
      try {
        const result = await cdpCore.evaluate(expression)
        return { success: true, result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle('cdp:get-rect', async (_event, selector: string) => {
    try {
      const rect = await cdpCore.getRect(selector)
      return { success: true, rect }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('cdp:poc-test', async () => {
    try {
      if (!cdpCore.isAttached()) {
        return { success: false, error: 'CDP not attached. Attach first.' }
      }
      const results = await cdpCore.runPocTest()
      const allPassed = results.every((r) => r.success)
      return { success: allPassed, results }
    } catch (err) {
      return { success: false, error: String(err), results: [] }
    }
  })
}
