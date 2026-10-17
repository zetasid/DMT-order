export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const basePath = import.meta.env.BASE_URL;
  const workerUrl = new URL(`${basePath}sw.js`, window.location.origin);

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(workerUrl, { scope: basePath }).catch(() => {
      // The app remains usable online when service-worker registration is unavailable.
    });
  });
}
