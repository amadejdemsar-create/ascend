/**
 * Wave 9 Phase 8: client-side .excalidraw export. The caller passes
 * the live Excalidraw API; we serialize the scene + appState + files,
 * wrap them in the .excalidraw envelope, and trigger a browser
 * download.
 */

interface ExcalidrawAPIForExport {
  getSceneElementsIncludingDeleted: () => readonly unknown[];
  getAppState: () => unknown;
  getFiles?: () => Record<string, unknown>;
}

const EXCALIDRAW_FILE_VERSION = 2;

export function exportLayoutAsExcalidraw(
  api: ExcalidrawAPIForExport,
  filenameSeed: string,
): void {
  const elements = api.getSceneElementsIncludingDeleted();
  // Strip deleted elements at export time (Excalidraw convention).
  const live = elements.filter((el) => {
    const obj = el as { isDeleted?: unknown };
    return obj.isDeleted !== true;
  });
  const appStateRaw = api.getAppState();
  const appState =
    typeof appStateRaw === "object" && appStateRaw !== null
      ? (appStateRaw as Record<string, unknown>)
      : {};
  const files = api.getFiles?.() ?? {};

  const envelope = {
    type: "excalidraw",
    version: EXCALIDRAW_FILE_VERSION,
    source: "ascend",
    elements: live,
    appState,
    files,
  };

  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyFilename(filenameSeed)}.excalidraw`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Chromium fires the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugifyFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "ascend-canvas";
}
