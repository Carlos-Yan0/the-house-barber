const VERSION_ENDPOINT = "/version.json";
const VERSION_CHECK_INTERVAL_MS = 60_000;

type VersionPayload = {
  version?: string;
};

let hasScheduledReload = false;

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache",
      },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as VersionPayload;
    return typeof payload.version === "string" ? payload.version : null;
  } catch {
    return null;
  }
}

async function activateWaitingWorker(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}

function scheduleReloadOnControllerChange() {
  if (hasScheduledReload) return;
  hasScheduledReload = true;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

async function registerVersionedServiceWorker(version: string) {
  const registration = await navigator.serviceWorker.register(
    `/sw.js?appVersion=${encodeURIComponent(version)}`,
    { scope: "/" }
  );

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        void activateWaitingWorker(registration);
      }
    });
  });

  if (registration.waiting) {
    await activateWaitingWorker(registration);
  }

  return registration;
}

async function checkForAppUpdate(currentVersion: string) {
  const latestVersion = await fetchLatestVersion();
  if (!latestVersion || latestVersion === currentVersion) return currentVersion;

  const registration = await registerVersionedServiceWorker(latestVersion);
  await registration.update();
  await activateWaitingWorker(registration);

  return latestVersion;
}

export async function initPwaAutoUpdate(currentVersion: string) {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

  scheduleReloadOnControllerChange();

  let activeVersion = currentVersion;
  const registration = await registerVersionedServiceWorker(activeVersion);
  await registration.update();

  const runUpdateCheck = async () => {
    activeVersion = await checkForAppUpdate(activeVersion);
  };

  void runUpdateCheck();
  window.setInterval(() => {
    void runUpdateCheck();
  }, VERSION_CHECK_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void runUpdateCheck();
    }
  });
}
