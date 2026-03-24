let deferredInstallPrompt = null;

function syncInstallButtons() {
  document.querySelectorAll('[data-pwa-install]').forEach((button) => {
    button.classList.toggle('hidden', !deferredInstallPrompt);
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  syncInstallButtons();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  syncInstallButtons();
});

window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.error('No se pudo registrar el service worker:', error);
    });
  }

  document.querySelectorAll('[data-pwa-install]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        return;
      }
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      syncInstallButtons();
    });
  });

  syncInstallButtons();
});