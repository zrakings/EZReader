/**
 * Registers the offline app-shell service worker in production builds.
 *
 * Documents are intentionally never cached: only the application shell and
 * runtime assets are stored. The service worker lives next to index.html so
 * the same build works at a domain root or in a GitHub Pages subdirectory.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  const register = () => {
    const workerUrl = new URL('sw.js', window.location.href)
    void navigator.serviceWorker
      .register(workerUrl, { scope: './' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('ezreader:update-ready'))
            }
          })
        })
      })
      .catch((error: unknown) => {
        console.info('EZReader offline support is unavailable in this browser.', error)
      })
  }

  if (window.document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
