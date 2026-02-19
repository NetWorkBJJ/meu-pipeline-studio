import { useState } from 'react'

type LogType = 'info' | 'success' | 'error' | 'warning'

interface IpcOptions {
  onLog?: (type: LogType, message: string) => void
  onSuccess?: () => void
  onFinally?: () => void
  successMessage?: string
  silentSuccess?: boolean
}

export async function invokeIpc<T>(
  apiFn: () => Promise<T>,
  options: IpcOptions = {}
): Promise<T | null> {
  const { onLog, onSuccess, onFinally, successMessage, silentSuccess } = options

  try {
    const result = await apiFn()

    if (!silentSuccess) {
      onLog?.('success', successMessage || 'Operacao concluida')
    }

    onSuccess?.()
    return result
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    onLog?.('error', msg)
    return null
  } finally {
    onFinally?.()
  }
}

export async function invokeIpcSequence<T>(
  calls: Array<{ fn: () => Promise<T>; options?: Omit<IpcOptions, 'onLog'> }>,
  globalOptions: Pick<IpcOptions, 'onLog' | 'onFinally'> = {}
): Promise<T[]> {
  const results: T[] = []

  try {
    for (const call of calls) {
      const result = await invokeIpc<T>(call.fn, {
        ...globalOptions,
        ...call.options
      })

      if (result === null) break
      results.push(result)
    }
  } finally {
    globalOptions.onFinally?.()
  }

  return results
}

export function listenIpc(
  subscribe: (callback: (data: unknown) => void) => () => void,
  callback: (data: unknown) => void
): () => void {
  return subscribe(callback)
}

export function useIpc(globalOptions: IpcOptions = {}): {
  invoke: <T>(apiFn: () => Promise<T>, options?: IpcOptions) => Promise<T | null>
  isLoading: boolean
} {
  const [isLoading, setIsLoading] = useState(false)

  const invoke = async <T>(
    apiFn: () => Promise<T>,
    options: IpcOptions = {}
  ): Promise<T | null> => {
    setIsLoading(true)

    try {
      return await invokeIpc<T>(apiFn, {
        ...globalOptions,
        ...options
      })
    } finally {
      setIsLoading(false)
    }
  }

  return { invoke, isLoading }
}
