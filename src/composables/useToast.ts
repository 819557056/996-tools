import { ref } from 'vue'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const toasts = ref<Array<ToastOptions & { id: number; visible: boolean }>>([])
let nextId = 0

export function useToast() {
  function toast(options: ToastOptions | string) {
    const opts = typeof options === 'string' ? { description: options } : options
    const id = nextId++
    const toastItem = { ...opts, id, visible: true }
    toasts.value.push(toastItem)

    const duration = opts.duration ?? 3000
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  function success(title: string, description?: string) {
    return toast({ title, description, variant: 'success' })
  }

  function error(title: string, description?: string) {
    return toast({ title, description, variant: 'error' })
  }

  function warning(title: string, description?: string) {
    return toast({ title, description, variant: 'warning' })
  }

  function info(title: string, description?: string) {
    return toast({ title, description, variant: 'info' })
  }

  function removeToast(id: number) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    toast,
    success,
    error,
    warning,
    info,
    removeToast,
  }
}

