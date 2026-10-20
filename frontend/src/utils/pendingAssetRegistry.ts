import { API_BASE_URL } from "../config/api";
import { compressImageFile } from "./imageOptimizer";

const pendingAssets = new Map<string, File>();

/**
 * Registers a newly selected File in browser memory and returns an instant blob preview URL.
 * No server requests are made until Publish / Save.
 */
export function registerPendingAsset(file: File): string {
  const blobUrl = URL.createObjectURL(file);
  pendingAssets.set(blobUrl, file);
  return blobUrl;
}

/**
 * Revokes a blob URL and removes the File from browser memory.
 */
export function removePendingAsset(blobUrl: string): void {
  if (!blobUrl) return;
  if (pendingAssets.has(blobUrl)) {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch (_) {}
    pendingAssets.delete(blobUrl);
  }
}

/**
 * Scans an object (like a site_definition or draft_definition) for any temporary blob: URLs,
 * compresses and uploads them in parallel to the backend, and returns a cloned object
 * with permanent server URLs.
 */
export async function resolveAndUploadPendingAssets<T>(siteDef: T): Promise<T> {
  if (!siteDef) return siteDef;

  const jsonStr = JSON.stringify(siteDef);
  const blobMatches = Array.from(
    new Set(jsonStr.match(/blob:https?:\/\/[^\s"'\\]+/g) || [])
  );

  if (blobMatches.length === 0) {
    return siteDef;
  }

  const urlReplacements = new Map<string, string>();

  await Promise.all(
    blobMatches.map(async (blobUrl) => {
      let fileToProcess = pendingAssets.get(blobUrl);

      // Fallback: If file wasn't in memory map, fetch the blob directly from browser memory
      if (!fileToProcess) {
        try {
          const res = await fetch(blobUrl);
          const blob = await res.blob();
          fileToProcess = new File([blob], "asset.webp", {
            type: blob.type || "image/webp",
          });
        } catch (fetchErr) {
          console.error("Failed to read blob from memory:", fetchErr);
          return;
        }
      }

      try {
        const compressed = await compressImageFile(fileToProcess, 1920, 1080, 0.85);
        const formData = new FormData();
        formData.append("file", compressed);

        const res = await fetch(`${API_BASE_URL}/assets/upload-logo`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            urlReplacements.set(blobUrl, data.url);
            removePendingAsset(blobUrl);
          }
        } else {
          console.error("Failed to upload pending asset to server", res.status);
        }
      } catch (err) {
        console.error("Error uploading pending asset:", err);
      }
    })
  );

  let updatedJson = jsonStr;
  for (const [blobUrl, serverUrl] of urlReplacements.entries()) {
    updatedJson = updatedJson.split(blobUrl).join(serverUrl);
  }

  try {
    return JSON.parse(updatedJson);
  } catch {
    return siteDef;
  }
}
