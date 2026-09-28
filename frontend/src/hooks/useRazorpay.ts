import { useState, useEffect } from "react";

let razorpayScriptLoadingPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  if ((window as any).Razorpay) {
    return Promise.resolve(true);
  }

  if (razorpayScriptLoadingPromise) {
    return razorpayScriptLoadingPromise;
  }

  razorpayScriptLoadingPromise = new Promise<boolean>((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      console.error("Failed to load Razorpay SDK");
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayScriptLoadingPromise;
}

function enforceBackdropTransparency() {
  if (typeof document === "undefined") return;

  const styleId = "wc-rzp-transparency-override";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .razorpay-container {
        background: transparent !important;
        background-color: transparent !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        z-index: 2147483647 !important;
      }
      .razorpay-backdrop {
        display: none !important;
        opacity: 0 !important;
        background: transparent !important;
        background-color: transparent !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        pointer-events: none !important;
      }
      .razorpay-container > iframe,
      iframe.razorpay-checkout-frame,
      iframe[name*="razorpay"],
      iframe[src*="razorpay"] {
        background: transparent !important;
        background-color: transparent !important;
        color-scheme: light !important;
        border: none !important;
        outline: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Active polling during modal insertion to ensure inline styles don't override transparency
  let ticks = 0;
  const poll = setInterval(() => {
    ticks++;
    const container = document.querySelector(".razorpay-container") as HTMLElement | null;
    const backdrop = document.querySelector(".razorpay-backdrop") as HTMLElement | null;
    const iframes = document.querySelectorAll<HTMLIFrameElement>(
      "iframe.razorpay-checkout-frame, iframe[name*='razorpay'], iframe[src*='razorpay']"
    );

    if (container) {
      container.style.setProperty("background", "transparent", "important");
      container.style.setProperty("background-color", "transparent", "important");
      container.style.setProperty("backdrop-filter", "none", "important");
      container.style.setProperty("-webkit-backdrop-filter", "none", "important");
    }

    if (backdrop) {
      backdrop.style.setProperty("display", "none", "important");
      backdrop.style.setProperty("opacity", "0", "important");
      backdrop.style.setProperty("background", "transparent", "important");
      backdrop.style.setProperty("background-color", "transparent", "important");
      backdrop.style.setProperty("backdrop-filter", "none", "important");
      backdrop.style.setProperty("-webkit-backdrop-filter", "none", "important");
    }

    if (iframes.length > 0) {
      iframes.forEach((ifr) => {
        ifr.style.setProperty("background", "transparent", "important");
        ifr.style.setProperty("background-color", "transparent", "important");
        ifr.style.setProperty("color-scheme", "light", "important");
        ifr.setAttribute("allowtransparency", "true");
      });
    }

    if (ticks > 25) {
      clearInterval(poll);
    }
  }, 100);
}

export function useRazorpay() {
  const [isLoaded, setIsLoaded] = useState<boolean>(() => {
    return typeof window !== "undefined" && Boolean((window as any).Razorpay);
  });

  useEffect(() => {
    let isMounted = true;
    loadRazorpayScript().then((success) => {
      if (isMounted) {
        setIsLoaded(success);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const openRazorpay = (options: Record<string, any>) => {
    return new Promise<void>((resolve, reject) => {
      enforceBackdropTransparency();
      loadRazorpayScript().then((success) => {
        if (!success || !(window as any).Razorpay) {
          reject(new Error("Razorpay SDK failed to load. Please check your internet connection."));
          return;
        }

        try {
          const rzp = new (window as any).Razorpay(options);
          rzp.on("payment.failed", (response: any) => {
            console.error("Razorpay payment failed:", response.error);
            if (options.onPaymentFailed) {
              options.onPaymentFailed(response.error);
            }
          });
          rzp.open();
          enforceBackdropTransparency();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  };

  return { isLoaded, openRazorpay };
}
