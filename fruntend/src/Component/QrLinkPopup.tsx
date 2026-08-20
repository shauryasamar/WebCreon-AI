import { useMemo, useState } from "react";

type QrLinkPopupProps = {
  open: boolean;
  onClose: () => void;
  customerUrl: string;
};

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function encodePdfText(value: string) {
  return new TextEncoder().encode(value);
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function concatBytes(...parts: Uint8Array[]) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

function createPdfObject(objectNumber: number, body: string) {
  return encodePdfText(
    `${objectNumber} 0 obj\n${body}\nendobj\n`,
  );
}

function createQrPdf(qrImageDataUrl: string, customerUrl: string) {
  const qrImageBytes = dataUrlToBytes(qrImageDataUrl);

  // Compact custom page size that avoids unnecessary empty space.
  const pageWidth = 595;
  const pageHeight = 700;

  const safeUrl = customerUrl.length > 78
    ? `${customerUrl.slice(0, 75)}...`
    : customerUrl;

  const content = [
    // Full-page soft background.
    "q",
    "0.96 0.98 1 rg",
    `0 0 ${pageWidth} ${pageHeight} re`,
    "f",
    "Q",

    // Blue header.
    "q",
    "0.08 0.35 0.86 rg",
    `0 ${pageHeight - 145} ${pageWidth} 145 re`,
    "f",
    "Q",

    // Header title.
    "BT",
    "/F1 28 Tf",
    "1 1 1 rg",
    "70 620 Td",
    `(${escapePdfText("Scan & discover")}) Tj`,
    "ET",

    "BT",
    "/F1 14 Tf",
    "0.86 0.93 1 rg",
    "70 594 Td",
    `(${escapePdfText("Your next favourite products are just one scan away")}) Tj`,
    "ET",

    // QR card background.
    "q",
    "1 1 1 rg",
    "55 135 485 410 re",
    "f",
    "Q",

    // QR card border.
    "q",
    "0.78 0.85 0.94 RG",
    "1.5 w",
    "55 135 485 410 re",
    "S",
    "Q",

    // QR heading.
    "BT",
    "/F1 15 Tf",
    "0.06 0.09 0.16 rg",
    "185 510 Td",
    `(${escapePdfText("Scan to visit our online store")}) Tj`,
    "ET",

    // QR border.
    "q",
    "0.08 0.35 0.86 RG",
    "2.5 w",
    "147 190 300 300 re",
    "S",
    "Q",

    // QR image.
    "q",
    "300 0 0 300 147 190 cm",
    "/Im0 Do",
    "Q",

    // Description.
    "BT",
    "/F1 13 Tf",
    "0.22 0.29 0.38 rg",
    "115 160 Td",
    `(${escapePdfText("Explore products, offers, and more online.")}) Tj`,
    "ET",

    // Bottom callout.
    "q",
    "0.86 0.93 1 rg",
    "55 55 485 52 re",
    "f",
    "Q",

    "BT",
    "/F1 12 Tf",
    "0.08 0.35 0.86 rg",
    "78 78 Td",
    `(${escapePdfText("Open your camera, scan the code, and start shopping.")}) Tj`,
    "ET",

    // Website URL.
    "BT",
    "/F1 8 Tf",
    "0.39 0.45 0.53 rg",
    "70 32 Td",
    `(${escapePdfText(safeUrl)}) Tj`,
    "ET",
  ].join("\n");

  const contentBytes = encodePdfText(content);

  const objects: Uint8Array[] = [];

  objects[1] = createPdfObject(
    1,
    "<< /Type /Catalog /Pages 2 0 R >>",
  );

  objects[2] = createPdfObject(
    2,
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  );

  objects[3] = createPdfObject(
    3,
    `<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 ${pageWidth} ${pageHeight}]
/Resources <<
  /Font <<
    /F1 4 0 R
  >>
  /XObject <<
    /Im0 5 0 R
  >>
>>
/Contents 6 0 R
>>`,
  );

  objects[4] = createPdfObject(
    4,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );

  objects[5] = concatBytes(
    encodePdfText(
      `5 0 obj
<<
/Type /XObject
/Subtype /Image
/Width 1000
/Height 1000
/ColorSpace /DeviceRGB
/BitsPerComponent 8
/Filter /DCTDecode
/Length ${qrImageBytes.length}
>>
stream
`,
    ),
    qrImageBytes,
    encodePdfText("\nendstream\nendobj\n"),
  );

  objects[6] = concatBytes(
    encodePdfText(
      `6 0 obj
<< /Length ${contentBytes.length} >>
stream
`,
    ),
    contentBytes,
    encodePdfText("\nendstream\nendobj\n"),
  );

  const header = new Uint8Array([
    37,
    80,
    68,
    70,
    45,
    49,
    46,
    52,
    10,
    37,
    255,
    255,
    255,
    255,
    10,
  ]);

  const fileParts: Uint8Array[] = [header];
  const offsets: number[] = [0];
  let currentOffset = header.length;

  for (let index = 1; index <= 6; index += 1) {
    offsets[index] = currentOffset;
    fileParts.push(objects[index]);
    currentOffset += objects[index].length;
  }

  const xrefOffset = currentOffset;

  const xref = [
  "xref",
  "0 7",
  "0000000000 65535 f ",
  ...offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
  "trailer",
  "<< /Size 7 /Root 1 0 R >>",
  "startxref",
  String(xrefOffset),
  "%%EOF",
].join("\n");

fileParts.push(encodePdfText(`${xref}\n`));

const pdfBytes = concatBytes(...fileParts);

// Create a guaranteed ArrayBuffer-backed value for Blob.
const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
new Uint8Array(pdfBuffer).set(pdfBytes);

return new Blob([pdfBuffer], {
  type: "application/pdf",
});
}

async function createQrImageDataUrl(qrUrl: string) {
  const response = await fetch(qrUrl);

  if (!response.ok) {
    throw new Error("Unable to load QR code.");
  }

  const imageBlob = await response.blob();
  const objectUrl = URL.createObjectURL(imageBlob);

  try {
    const image = new Image();
    image.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to process QR code."));
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1000;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to create canvas.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.96);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function copyToClipboard(value: string) {
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Continue with fallback.
  }

  try {
    const textarea = document.createElement("textarea");

    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const copied = document.execCommand("copy");
    textarea.remove();

    return copied;
  } catch {
    return false;
  }
}

export default function QrLinkPopup({
  open,
  onClose,
  customerUrl,
}: QrLinkPopupProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const qrFallback = useMemo(() => {
    if (!customerUrl) return "";

    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      customerUrl,
    )}`;
  }, [customerUrl]);

  if (!open) return null;

  const handleCopy = async () => {
    const success = await copyToClipboard(customerUrl);

    if (!success) return;

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  const handleOpenWebsite = () => {
    if (!customerUrl) return;

    window.open(customerUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadPdf = async () => {
    if (!qrFallback || !customerUrl || isDownloading) return;

    try {
      setIsDownloading(true);

      const qrImageDataUrl = await createQrImageDataUrl(qrFallback);
      const pdfBlob = createQrPdf(qrImageDataUrl, customerUrl);
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "shop-website-qr-code.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch {
      // Intentionally silent for now.
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-link-popup-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(15,23,42,0.52)",
        display: "grid",
        placeItems: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(720px, calc(100vw - 32px))",
          maxHeight: "calc(100dvh - 32px)",
          overflow: "hidden",
          borderRadius: "24px",
          background: "#ffffff",
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 28px 80px rgba(15,23,42,0.24)",
          padding: "22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h3
              id="qr-link-popup-title"
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "20px",
                lineHeight: 1.2,
              }}
            >
              Share your online store
            </h3>

            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
                fontSize: "13px",
                lineHeight: 1.45,
              }}
            >
              Let customers discover your products with one simple scan.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR code popup"
            style={{
              flexShrink: 0,
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              border: "1px solid rgba(15,23,42,0.1)",
              background: "#ffffff",
              color: "#475569",
              fontSize: "21px",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(230px, 280px)",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Scan to visit our online store
            </p>

            <div
              style={{
                width: "min(250px, 100%)",
                aspectRatio: "1",
                margin: "0 auto",
                padding: "12px",
                borderRadius: "22px",
                border: "2px solid #2563eb",
                background: "#ffffff",
                boxShadow: "0 14px 32px rgba(37,99,235,0.14)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  borderRadius: "12px",
                  background: "#f8fafc",
                }}
              >
                {qrFallback ? (
                  <img
                    src={qrFallback}
                    alt="QR code for the customer website"
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "block",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: "#94a3b8",
                      fontSize: "13px",
                    }}
                  >
                    QR preview unavailable
                  </div>
                )}
              </div>
            </div>

            <p
              style={{
                maxWidth: "280px",
                margin: "14px auto 0",
                color: "#64748b",
                fontSize: "13px",
                lineHeight: 1.55,
              }}
            >
              Customers can scan this code to explore your products, offers,
              and online shopping experience.
            </p>
          </div>

          <div>
            <div
              style={{
                marginBottom: "14px",
                padding: "16px",
                borderRadius: "16px",
                background: "#eff6ff",
                border: "1px solid #dbeafe",
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  color: "#1d4ed8",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Make your store easier to find
              </p>

              <p
                style={{
                  margin: 0,
                  color: "#475569",
                  fontSize: "12px",
                  lineHeight: 1.55,
                }}
              >
                Download the printable PDF, place it near your counter, and
                invite customers to scan it.
              </p>
            </div>

            <label
              style={{
                display: "block",
                marginBottom: "7px",
                color: "#334155",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Customer website URL
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: 0,
                marginBottom: "14px",
                padding: "10px 10px 10px 12px",
                borderRadius: "13px",
                background: "#f8fafc",
                border: "1px solid rgba(15,23,42,0.1)",
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: customerUrl ? "#0f172a" : "#94a3b8",
                  fontSize: "12px",
                  lineHeight: 1.4,
                  wordBreak: "break-all",
                }}
              >
                {customerUrl || "Not available"}
              </span>

              <button
                type="button"
                onClick={handleCopy}
                disabled={!customerUrl}
                aria-label={copied ? "Link copied" : "Copy website link"}
                title={copied ? "Copied" : "Copy link"}
                style={{
                  flexShrink: 0,
                  width: "34px",
                  height: "34px",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "10px",
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: copied ? "#dcfce7" : "#ffffff",
                  color: copied ? "#15803d" : "#475569",
                  cursor: customerUrl ? "pointer" : "not-allowed",
                  opacity: customerUrl ? 1 : 0.5,
                }}
              >
                {copied ? (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m5 12 4 4L19 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="10"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "9px",
              }}
            >
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!customerUrl || isDownloading}
                style={{
                  minHeight: "44px",
                  borderRadius: "12px",
                  border: "1px solid #2563eb",
                  background: "#ffffff",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor:
                    customerUrl && !isDownloading
                      ? "pointer"
                      : "not-allowed",
                  opacity: customerUrl && !isDownloading ? 1 : 0.55,
                }}
              >
                {isDownloading ? "Preparing..." : "Download PDF"}
              </button>

              <button
                type="button"
                onClick={handleOpenWebsite}
                disabled={!customerUrl}
                style={{
                  minHeight: "44px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: customerUrl ? "pointer" : "not-allowed",
                  opacity: customerUrl ? 1 : 0.55,
                }}
              >
                Open website
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}