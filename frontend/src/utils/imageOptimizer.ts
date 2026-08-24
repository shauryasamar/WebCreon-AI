export function optimizeImageUrl(
  url?: string | null,
  width = 600,
  height?: number,
  quality = 80
): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // If it's an Unsplash image, inject dynamic CDN resizing and WebP conversion
  if (trimmed.includes("images.unsplash.com")) {
    const baseUrl = trimmed.split("?")[0];
    if (height) {
      return `${baseUrl}?auto=format&fit=crop&w=${width}&h=${height}&q=${quality}&fm=webp`;
    }
    return `${baseUrl}?auto=format&fit=crop&w=${width}&q=${quality}&fm=webp`;
  }

  return trimmed;
}

export function getThumbnailUrl(
  url?: string | null,
  width = 120,
  height = 140
): string {
  return optimizeImageUrl(url, width, height, 75);
}

/**
 * Automatically downsizes and compresses large user-uploaded images (e.g. 5-15MB phone photos)
 * into lightweight, web-optimized WebP files (~50-90KB) directly in the browser before upload.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<File> {
  if (!file || !file.type.startsWith("image/") || file.size < 40 * 1024) {
    return file;
  }

  if (file.type === "image/svg+xml") {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            if (width / maxWidth > height / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                const baseName = file.name.replace(/\.[^/.]+$/, "");
                const compressedFile = new File([blob], `${baseName}.webp`, {
                  type: "image/webp",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/webp",
            quality
          );
        } catch {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

