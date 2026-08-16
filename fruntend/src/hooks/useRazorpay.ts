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
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  };

  return { isLoaded, openRazorpay };
}
