import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

// Basic config for style/theme
const base = {
  allowOutsideClick: false,
  confirmButtonText: 'Aceptar',
  cancelButtonText: 'Cancelar',
  customClass: {
    popup: 'rounded-2xl',
    confirmButton: 'px-4 py-2',
    cancelButton: 'px-4 py-2'
  }
}

// Toasts
const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  timer: 2500,
  timerProgressBar: true,
  showConfirmButton: false
})

export const alert = {
  fire(opts) {
    return Swal.fire({ ...base, ...opts })
  },
  success(title, text = '') {
    return Swal.fire({ ...base, title, text, icon: 'success' })
  },
  error(title, text = '') {
    return Swal.fire({ ...base, title, text, icon: 'error' })
  },
  info(title, text = '') {
    return Swal.fire({ ...base, title, text, icon: 'info' })
  },
  warning(title, text = '') {
    return Swal.fire({ ...base, title, text, icon: 'warning' })
  },
  toast(title, icon = 'success', timer = 2500) {
    return toast.fire({ title, icon, timer })
  },
  async confirm({ title, text, icon = 'question', confirmText = 'Confirmar', cancelText = 'Cancelar' }) {
    const res = await Swal.fire({
      ...base,
      title,
      text,
      icon,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText
    })
    return res.isConfirmed
  },
  async prompt({ title, input = 'text', inputPlaceholder = '', inputValue = '', icon = 'question' }) {
    const res = await Swal.fire({
      ...base,
      title,
      input,
      inputPlaceholder,
      inputValue,
      showCancelButton: true,
      icon
    })
    return res.isConfirmed ? res.value : null
  }
}
