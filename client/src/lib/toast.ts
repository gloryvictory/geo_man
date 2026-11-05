import hotToast from 'react-hot-toast';
import { api } from '../api';

// Обёртка над react-hot-toast: каждое всплывающее сообщение дополнительно
// журналируется в БД (POST /api/messages) для вкладки «Сообщения» в админке.
// Ошибки логирования игнорируются — показ тоста важнее журнала.
type ToastType = 'success' | 'error' | 'info';

function log(type: ToastType, text: string): void {
  api.logMessage({ type, text }).catch(() => {});
}

const toast = {
  success: (text: string) => {
    hotToast.success(text);
    log('success', text);
  },
  error: (text: string) => {
    hotToast.error(text);
    log('error', text);
  },
  info: (text: string) => {
    hotToast(text);
    log('info', text);
  },
};

export default toast;
