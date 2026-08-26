import React, { useCallback, useEffect, useRef, useState } from "react";
import { checkDeliverability, DeliverabilityResult } from "../addressService";

export type GeoPickerResult = {
  lat: number;
  lng: number;
  addressLine: string;
  city: string;
  state?: string;
  pincode: string;
  geoAccuracy: "pinned" | "geocoded";
};

export type GoogleMapPickerProps = {
  siteId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: GeoPickerResult) => void;
  accentColor?: string;
  theme?: "light" | "dark";
  backgroundColor?: string;
  inputColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  borderColor?: string;
  deliveryMode?: string; // 'own_agent' | 'shiprocket' | 'hybrid' | 'manual'
  initialLat?: number;
  initialLng?: number;
  mode?: "customer" | "store"; // 'store' = configuring store/warehouse dispatch pin (skips deliverability validation)
};

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // Geographic center of India

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    if (window.google?.maps?.places) {
      resolve();
      return;
    }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps"))
      );
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function extractAddressComponents(results: google.maps.GeocoderResult[]): {
  addressLine: string;
  city: string;
  state?: string;
  pincode: string;
} {
  if (!results || results.length === 0) {
    return { addressLine: "", city: "", state: "", pincode: "" };
  }
  const result = results[0];
  const components = result.address_components;

  let streetNumber = "";
  let route = "";
  let sublocality = "";
  let locality = "";
  let city = "";
  let state = "";
  let pincode = "";

  for (const c of components) {
    if (c.types.includes("street_number")) streetNumber = c.long_name;
    if (c.types.includes("route")) route = c.long_name;
    if (c.types.includes("sublocality_level_1") || c.types.includes("sublocality"))
      sublocality = c.long_name;
    if (c.types.includes("locality")) locality = c.long_name;
    if (c.types.includes("administrative_area_level_2") && !locality)
      city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.long_name;
    if (c.types.includes("postal_code")) pincode = c.long_name;
  }

  const addressLine = [streetNumber, route, sublocality].filter(Boolean).join(", ");

  return {
    addressLine: addressLine || locality || city,
    city: locality || city,
    state,
    pincode,
  };
}

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1f242d" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8d99ae" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1d24" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#3d4852" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#a0aec0" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e0" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#182026" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2d3748" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#a0aec0" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4a5568" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
];

const LIGHT_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

export const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({
  siteId,
  isOpen,
  onClose,
  onConfirm,
  accentColor = "#2563eb",
  theme = "light",
  backgroundColor,
  inputColor,
  textColor,
  mutedTextColor,
  borderColor,
  initialLat,
  initialLng,
  mode = "customer",
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [currentLat, setCurrentLat] = useState<number | null>(initialLat ?? null);
  const [currentLng, setCurrentLng] = useState<number | null>(initialLng ?? null);
  const [searchValue, setSearchValue] = useState("");
  const [reversedAddress, setReversedAddress] = useState<{
    addressLine: string;
    city: string;
    state?: string;
    pincode: string;
  }>({ addressLine: "", city: "", state: "", pincode: "" });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [deliverability, setDeliverability] = useState<DeliverabilityResult | null>(null);
  const [isCheckingDeliverability, setIsCheckingDeliverability] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Responsive mobile detector
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 680 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 680);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Theme resolution
  const isDark = theme === "dark" || (backgroundColor && isColorDarkHex(backgroundColor));
  const palette = {
    modalBg: isDark ? backgroundColor || "#0f172a" : "#ffffff",
    cardBg: isDark ? "rgba(30, 41, 59, 0.94)" : "rgba(255, 255, 255, 0.94)",
    inputBg: isDark ? inputColor || "#1e293b" : "#ffffff",
    text: isDark ? textColor || "#f8fafc" : "#0f172a",
    textMuted: isDark ? mutedTextColor || "#94a3b8" : "#64748b",
    border: isDark ? borderColor || "#334155" : "#e2e8f0",
    headerBg: isDark ? "#0f172a" : "#ffffff",
    bottomBarBg: isDark ? "#111827" : "#ffffff",
    accent: accentColor || "#2563eb",
  };

  // Load Maps SDK
  useEffect(() => {
    if (!isOpen) return;
    if (!MAPS_API_KEY) {
      setLoadError(true);
      return;
    }
    loadGoogleMapsScript(MAPS_API_KEY)
      .then(() => setMapsLoaded(true))
      .catch(() => setLoadError(true));
  }, [isOpen]);

  // Reverse geocode a lat/lng
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!geocoderRef.current) return;
    setIsGeocoding(true);
    try {
      const response = await geocoderRef.current.geocode({
        location: { lat, lng },
      });
      const extracted = extractAddressComponents(response.results);
      setReversedAddress(extracted);
    } catch {
      setReversedAddress({ addressLine: "", city: "", state: "", pincode: "" });
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Check deliverability
  const checkDeliverabilityForPin = useCallback(
    async (lat: number, lng: number) => {
      if (!siteId || mode === "store") return;
      setIsCheckingDeliverability(true);
      try {
        const result = await checkDeliverability(siteId, lat, lng);
        setDeliverability(result);
      } catch {
        setDeliverability(null);
      } finally {
        setIsCheckingDeliverability(false);
      }
    },
    [siteId, mode]
  );

  // Move marker to a position and trigger geocoding + deliverability
  const moveMarkerTo = useCallback(
    (lat: number, lng: number) => {
      setCurrentLat(lat);
      setCurrentLng(lng);
      markerRef.current?.setPosition({ lat, lng });
      reverseGeocode(lat, lng);
      if (mode !== "store") {
        checkDeliverabilityForPin(lat, lng);
      }
    },
    [reverseGeocode, checkDeliverabilityForPin, mode]
  );

  // Trigger robust two-stage browser geolocation (high-accuracy with standard fallback)
  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your device/browser.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    const onLocationSuccess = (pos: GeolocationPosition) => {
      setIsLocating(false);
      setLocationError(null);
      const { latitude, longitude } = pos.coords;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: latitude, lng: longitude });
        mapInstanceRef.current.setZoom(17);
      }
      moveMarkerTo(latitude, longitude);
    };

    const tryLowAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        (err) => {
          setIsLocating(false);
          console.warn("Geolocation fallback failed:", err);
          setLocationError("Could not retrieve your location. Please check browser location permissions or search your address above.");
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      () => {
        tryLowAccuracy();
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  }, [moveMarkerTo]);

  // Initialize map once SDK is loaded and modal is open
  useEffect(() => {
    if (!mapsLoaded || !isOpen || !mapRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    geocoderRef.current = new google.maps.Geocoder();

    const startCenter =
      initialLat && initialLng
        ? { lat: initialLat, lng: initialLng }
        : DEFAULT_CENTER;

    const map = new google.maps.Map(mapRef.current, {
      center: startCenter,
      zoom: initialLat ? 17 : 5,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy", // Smooth single-finger touch on mobile
      styles: isDark ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
    });
    mapInstanceRef.current = map;

    // SVG Pin Icon with glowing pulse base
    const marker = new google.maps.Marker({
      map,
      position: startCenter,
      draggable: true,
      animation: google.maps.Animation.DROP,
      icon: {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: palette.accent,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 2,
        anchor: new google.maps.Point(12, 22),
      },
    });
    markerRef.current = marker;

    // Drag end → reverse geocode
    marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      moveMarkerTo(lat, lng);
    });

    // Map click → move marker
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      moveMarkerTo(e.latLng.lat(), e.latLng.lng());
    });

    if (initialLat && initialLng) {
      setCurrentLat(initialLat);
      setCurrentLng(initialLng);
      reverseGeocode(initialLat, initialLng);
      if (mode !== "store") {
        checkDeliverabilityForPin(initialLat, initialLng);
      }
    } else {
      locateUser();
    }

    // Places autocomplete
    if (searchInputRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(
        searchInputRef.current,
        {
          componentRestrictions: { country: "in" },
          fields: ["geometry", "address_components", "formatted_address"],
        }
      );
      autocompleteRef.current = autocomplete;
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        map.setCenter({ lat, lng });
        map.setZoom(17);
        moveMarkerTo(lat, lng);
        setSearchValue(place.formatted_address || "");
      });
    }
  }, [mapsLoaded, isOpen, initialLat, initialLng, palette.accent, isDark, moveMarkerTo, reverseGeocode, checkDeliverabilityForPin, mode, locateUser]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      mapInstanceRef.current = null;
      markerRef.current = null;
      geocoderRef.current = null;
      autocompleteRef.current = null;
      setCurrentLat(null);
      setCurrentLng(null);
      setSearchValue("");
      setReversedAddress({ addressLine: "", city: "", state: "", pincode: "" });
      setDeliverability(null);
      setIsConfirming(false);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!currentLat || !currentLng) return;
    setIsConfirming(true);
    onConfirm({
      lat: currentLat,
      lng: currentLng,
      addressLine: reversedAddress.addressLine,
      city: reversedAddress.city,
      state: reversedAddress.state,
      pincode: reversedAddress.pincode,
      geoAccuracy: "pinned",
    });
  };

  if (!isOpen) return null;

  const showDeliverabilityBadge =
    mode !== "store" &&
    currentLat !== null &&
    (isCheckingDeliverability ||
      (deliverability && deliverability.check_required));
  const isDeliverable = deliverability?.deliverable ?? true;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: isDark ? "rgba(0,0,0,0.75)" : "rgba(15,23,42,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? "0" : "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : "720px",
          height: isMobile ? "100dvh" : "min(88vh, 660px)",
          background: palette.modalBg,
          borderRadius: isMobile ? "0" : "16px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: isDark
            ? "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)"
            : "0 24px 60px rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: isMobile ? "12px 14px" : "14px 18px",
            borderBottom: `1px solid ${palette.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            background: palette.headerBg,
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: isDark ? "rgba(255,255,255,0.06)" : "#eff6ff",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#bfdbfe"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: palette.accent,
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: isMobile ? "14px" : "15px",
                  fontWeight: 700,
                  color: palette.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {mode === "store" ? "Pin Store Origin Location" : "Pin Exact Delivery Location"}
              </h3>
              <p
                style={{
                  margin: "1px 0 0",
                  fontSize: isMobile ? "11px" : "12px",
                  color: palette.textMuted,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {mode === "store"
                  ? "Tap on the map or drag the pin to set store dispatch center"
                  : "Drag the pin or tap anywhere on the map to set doorstep"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Map"
            style={{
              border: "none",
              background: isDark ? "rgba(255,255,255,0.1)" : "#f1f5f9",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "14px",
              color: palette.textMuted,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Floating Search Bar + Mobile GPS Button */}
        {mapsLoaded && !loadError && (
          <div
            style={{
              padding: isMobile ? "8px 10px" : "10px 14px",
              background: isDark ? "rgba(15,23,42,0.92)" : "rgba(248,250,252,0.95)",
              borderBottom: `1px solid ${palette.border}`,
              flexShrink: 0,
              display: "flex",
              gap: "8px",
              alignItems: "center",
              zIndex: 10,
            }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <span
                style={{
                  position: "absolute",
                  left: "11px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                  color: palette.textMuted,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={isMobile ? "Search street, landmark..." : "Search for street, apartment, landmark or area..."}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: "40px",
                  padding: "0 34px 0 34px",
                  fontSize: isMobile ? "13px" : "13.5px",
                  border: `1px solid ${palette.border}`,
                  borderRadius: "8px",
                  background: palette.inputBg,
                  color: palette.text,
                  outline: "none",
                }}
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: palette.textMuted,
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "12px",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick GPS button */}
            <button
              type="button"
              onClick={locateUser}
              disabled={isLocating}
              title="Use Current Location (GPS)"
              style={{
                height: "40px",
                padding: isMobile ? "0 10px" : "0 14px",
                borderRadius: "8px",
                border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"}`,
                background: isDark ? "rgba(37,99,235,0.15)" : "#eff6ff",
                color: isDark ? "#60a5fa" : "#1d4ed8",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: isLocating ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {isLocating ? (
                <>
                  <div
                    style={{
                      width: "14px",
                      height: "14px",
                      border: `2px solid ${isDark ? "#60a5fa" : "#1d4ed8"}`,
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  {!isMobile && <span>Locating...</span>}
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                  </svg>
                  <span>{isMobile ? "GPS" : "Use Current Location"}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Map Viewport */}
        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          {loadError ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "24px",
                textAlign: "center",
                background: palette.modalBg,
              }}
            >
              <span style={{ fontSize: "36px" }}>🗺️</span>
              <p style={{ margin: 0, fontWeight: 700, color: palette.text, fontSize: "15px" }}>
                Google Maps Configuration Needed
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: palette.textMuted, maxWidth: "340px" }}>
                Add your <code>VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
                <code>frontend/.env</code> with Maps JavaScript, Places &amp; Geocoding enabled.
              </p>
            </div>
          ) : !mapsLoaded ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                color: palette.textMuted,
                fontSize: "13px",
                background: palette.modalBg,
              }}
            >
              <div
                style={{
                  width: "22px",
                  height: "22px",
                  border: `2.5px solid ${palette.accent}`,
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Loading map...
            </div>
          ) : (
            <>
              <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

              {/* Floating Re-center FAB on Mobile & Desktop */}
              <button
                type="button"
                onClick={locateUser}
                disabled={isLocating}
                title="Jump to my current location"
                style={{
                  position: "absolute",
                  bottom: "16px",
                  right: "14px",
                  zIndex: 10,
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: palette.cardBg,
                  border: `1px solid ${palette.border}`,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isLocating ? "wait" : "pointer",
                  color: palette.accent,
                  backdropFilter: "blur(4px)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                </svg>
              </button>
            </>
          )}

          {/* Deliverability Badge Overlay */}
          {showDeliverabilityBadge && (
            <div
              style={{
                position: "absolute",
                top: "12px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
                background: isCheckingDeliverability
                  ? isDark ? "#1e293b" : "#f8fafc"
                  : isDeliverable
                  ? isDark ? "rgba(22, 101, 52, 0.9)" : "#f0fdf4"
                  : isDark ? "rgba(153, 27, 27, 0.9)" : "#fef2f2",
                border: `1px solid ${
                  isCheckingDeliverability
                    ? palette.border
                    : isDeliverable
                    ? isDark ? "#16a34a" : "#bbf7d0"
                    : isDark ? "#dc2626" : "#fecaca"
                }`,
                borderRadius: "999px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                color: isCheckingDeliverability
                  ? palette.textMuted
                  : isDeliverable
                  ? isDark ? "#bbf7d0" : "#15803d"
                  : isDark ? "#fecaca" : "#dc2626",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                whiteSpace: "nowrap",
                backdropFilter: "blur(4px)",
              }}
            >
              {isCheckingDeliverability ? (
                <>
                  <div
                    style={{
                      width: "11px",
                      height: "11px",
                      border: `1.5px solid ${palette.textMuted}`,
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>Checking serviceability...</span>
                </>
              ) : isDeliverable ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Delivery available to this location</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>Outside delivery area</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom Address Card & Confirm Action */}
        <div
          style={{
            padding: isMobile ? "12px 14px 16px" : "14px 18px",
            borderTop: `1px solid ${palette.border}`,
            background: palette.bottomBarBg,
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {locationError && (
            <div
              style={{
                marginBottom: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: isDark ? "rgba(153,27,27,0.25)" : "#fef2f2",
                border: `1px solid ${isDark ? "rgba(220,38,38,0.4)" : "#fecaca"}`,
                color: isDark ? "#fca5a5" : "#991b1b",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{locationError}</span>
            </div>
          )}

          {currentLat !== null && (
            <div
              style={{
                marginBottom: "12px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                border: `1px solid ${palette.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: palette.accent,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: "11px", fontWeight: 700, color: palette.textMuted, letterSpacing: "0.5px" }}>
                  PINNED ADDRESS
                </span>
              </div>
              {isGeocoding ? (
                <p style={{ margin: 0, fontSize: "12.5px", color: palette.textMuted }}>Detecting exact street &amp; area...</p>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: isMobile ? "12.5px" : "13.5px",
                    color: palette.text,
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  {[reversedAddress.addressLine, reversedAddress.city, reversedAddress.pincode]
                    .filter(Boolean)
                    .join(", ") || "Location selected on map"}
                </p>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: isMobile ? "0 0 38%" : "0 0 110px",
                height: "44px",
                border: `1px solid ${palette.border}`,
                borderRadius: "8px",
                background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
                color: palette.text,
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!currentLat || isConfirming}
              style={{
                flex: 1,
                height: "44px",
                border: "none",
                borderRadius: "8px",
                background:
                  !currentLat || isConfirming
                    ? isDark ? "#334155" : "#cbd5e1"
                    : palette.accent,
                color: "#ffffff",
                fontSize: isMobile ? "13px" : "13.5px",
                fontWeight: 700,
                cursor: !currentLat || isConfirming ? "not-allowed" : "pointer",
                boxShadow: !currentLat || isConfirming ? "none" : `0 4px 14px ${palette.accent}40`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              {isConfirming
                ? "Confirming..."
                : mode === "store"
                ? "✓ Confirm Origin"
                : "✓ Confirm This Location"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .pac-container {
          z-index: 100002 !important;
          border-radius: 8px !important;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3) !important;
          border: 1px solid ${palette.border} !important;
          background-color: ${palette.modalBg} !important;
          font-family: inherit !important;
          margin-top: 4px !important;
        }
        .pac-item {
          padding: 8px 12px !important;
          font-size: 13px !important;
          color: ${palette.text} !important;
          border-top: 1px solid ${palette.border} !important;
          cursor: pointer !important;
        }
        .pac-item:hover, .pac-item-selected {
          background-color: ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"} !important;
        }
        .pac-item-query {
          font-size: 13.5px !important;
          color: ${palette.text} !important;
        }
        .pac-matched {
          font-weight: 700 !important;
          color: ${palette.accent} !important;
        }
      `}</style>
    </div>
  );
};

function isColorDarkHex(hexColor?: string): boolean {
  if (!hexColor) return false;
  const hex = hexColor.replace("#", "").trim();
  if (hex.length !== 6 && hex.length !== 3) return false;
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

export default GoogleMapPicker;
