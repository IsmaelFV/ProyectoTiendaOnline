/**
 * ============================================================================
 * Custom Notifications - Dark Theme
 * Reemplaza alert() y confirm() nativos con versiones personalizadas
 * ============================================================================
 */

// Toast notification manager
class ToastManager {
  private container: HTMLDivElement | null = null;

  private getContainer(): HTMLDivElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 4000) {
    const container = this.getContainer();
    const id = `toast-${Date.now()}-${Math.random()}`;

    const toastEl = document.createElement('div');
    toastEl.id = id;
    toastEl.className = 'toast-item pointer-events-auto transform translate-x-full transition-all duration-300';
    
    const icons = {
      success: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      error: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      warning: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      info: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    };

    const colors = {
      success: 'bg-green-500/10 border-green-500/50 text-green-400',
      error: 'bg-red-500/10 border-red-500/50 text-red-400',
      warning: 'bg-orange-500/10 border-orange-500/50 text-orange-400',
      info: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
    };

    const wrapper = document.createElement('div');
    wrapper.className = `flex items-center gap-3 bg-gray-900 border-2 rounded-lg px-4 py-3 shadow-2xl min-w-[320px] max-w-md ${colors[type]}`;
    const iconDiv = document.createElement('div');
    iconDiv.className = 'flex-shrink-0';
    iconDiv.innerHTML = icons[type]; // SVG estático — seguro
    const messageP = document.createElement('p');
    messageP.className = 'flex-1 text-sm text-white font-medium leading-snug';
    messageP.textContent = message;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-toast flex-shrink-0 text-gray-400 hover:text-white transition-colors';
    closeBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    wrapper.appendChild(iconDiv);
    wrapper.appendChild(messageP);
    wrapper.appendChild(closeBtn);
    toastEl.appendChild(wrapper);

    container.appendChild(toastEl);

    // Animate in
    requestAnimationFrame(() => {
      toastEl.classList.remove('translate-x-full');
      toastEl.classList.add('translate-x-0');
    });

    // Close button handler (ya tenemos referencia directa)
    closeBtn.addEventListener('click', () => this.remove(toastEl));

    // Auto-remove
    setTimeout(() => this.remove(toastEl), duration);
  }

  private remove(element: HTMLElement) {
    element.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => element.remove(), 300);
  }
}

// Confirm Dialog Manager
class ConfirmManager {
  show(
    message: string,
    options: {
      title?: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
    } = {}
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const {
        title = '¿Estás seguro?',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        type = 'danger'
      } = options;

      const dialogEl = document.createElement('div');
      dialogEl.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm opacity-0 transition-opacity duration-200';
      
      const buttonColors = {
        danger: 'bg-red-500 hover:bg-red-600',
        warning: 'bg-orange-500 hover:bg-orange-600',
        info: 'bg-blue-500 hover:bg-blue-600'
      };

      const dialogContent = document.createElement('div');
      dialogContent.className = 'confirm-dialog bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 scale-95 transition-transform duration-200';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'border-b border-gray-800 px-6 py-4';
      const h3 = document.createElement('h3');
      h3.className = 'text-xl font-bold text-white';
      h3.textContent = title;
      headerDiv.appendChild(h3);

      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'px-6 py-6';
      const bodyP = document.createElement('p');
      bodyP.className = 'text-gray-300 leading-relaxed whitespace-pre-line';
      bodyP.textContent = message;
      bodyDiv.appendChild(bodyP);

      const footerDiv = document.createElement('div');
      footerDiv.className = 'border-t border-gray-800 px-6 py-4 flex gap-3 justify-end';
      const cancelBtnEl = document.createElement('button');
      cancelBtnEl.className = 'cancel-btn px-5 py-2.5 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700 transition-colors';
      cancelBtnEl.textContent = cancelText;
      const confirmBtnEl = document.createElement('button');
      confirmBtnEl.className = `confirm-btn px-5 py-2.5 ${buttonColors[type]} text-white rounded-lg font-medium transition-colors`;
      confirmBtnEl.textContent = confirmText;
      footerDiv.appendChild(cancelBtnEl);
      footerDiv.appendChild(confirmBtnEl);

      dialogContent.appendChild(headerDiv);
      dialogContent.appendChild(bodyDiv);
      dialogContent.appendChild(footerDiv);
      dialogEl.appendChild(dialogContent);

      document.body.appendChild(dialogEl);

      // Animate in
      requestAnimationFrame(() => {
        dialogEl.classList.remove('opacity-0');
        const dialog = dialogEl.querySelector('.confirm-dialog');
        dialog?.classList.remove('scale-95');
        dialog?.classList.add('scale-100');
      });

      const cleanup = (result: boolean) => {
        dialogEl.classList.add('opacity-0');
        const dialog = dialogEl.querySelector('.confirm-dialog');
        dialog?.classList.remove('scale-100');
        dialog?.classList.add('scale-95');
        setTimeout(() => {
          dialogEl.remove();
          resolve(result);
        }, 200);
      };

      // Event listeners
      dialogEl.querySelector('.confirm-btn')?.addEventListener('click', () => cleanup(true));
      dialogEl.querySelector('.cancel-btn')?.addEventListener('click', () => cleanup(false));
      dialogEl.addEventListener('click', (e) => {
        if (e.target === dialogEl) cleanup(false);
      });

      // ESC key
      const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          cleanup(false);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    });
  }
}

// Singleton instances
const toastManager = new ToastManager();
const confirmManager = new ConfirmManager();

// Custom alert function
export function customAlert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  toastManager.show(message, type);
}

// Custom confirm function
export function customConfirm(
  message: string,
  options?: {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
  }
): Promise<boolean> {
  return confirmManager.show(message, options);
}

// Global exports
if (typeof window !== 'undefined') {
  // @ts-ignore - Override native alert
  window.customAlert = customAlert;
  // @ts-ignore - Override native confirm
  window.customConfirm = customConfirm;
  
  // Helper methods
  // @ts-ignore
  window.toast = {
    success: (msg: string) => customAlert(msg, 'success'),
    error: (msg: string) => customAlert(msg, 'error'),
    warning: (msg: string) => customAlert(msg, 'warning'),
    info: (msg: string) => customAlert(msg, 'info'),
  };
}

// TypeScript declarations
declare global {
  interface Window {
    customAlert: typeof customAlert;
    customConfirm: typeof customConfirm;
    toast: {
      success: (msg: string) => void;
      error: (msg: string) => void;
      warning: (msg: string) => void;
      info: (msg: string) => void;
    };
  }
}
