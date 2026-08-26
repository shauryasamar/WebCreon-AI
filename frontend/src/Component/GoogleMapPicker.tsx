/**
 * GoogleMapPicker.tsx
 * 
 * A modal component that lets users:
 * 1. Drag a pin to their exact delivery location
 * 2. Search via Places Autocomplete
 * 3. See a live deliverability badge (own_agent mode only)
 * 4. Reverse-geocode the pin to fill address fields
 * 
 * Returns { lat, lng, addressLine, city, pincode, geoAccuracy: 'pinned' } to the parent.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { checkDeliverability, DeliverabilityResult } from "../addressService";
declare global {
  interface Window {
    _googleMapsLoaded?: boolean;
    _googleMapsCallbacks?: Array<() => void>;
    __googleMapsReady?: () => void;
  }
}



export type GeoPickerResult = {
  lat: number;
  lng: number;
  addressLine: string;
  city: string;
  state?: string;
  pincode: string;
  geoAccuracy: "pinned";
};

type GoogleMapPickerProps = {
  siteId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: GeoPickerResult) => void;
  accentColor?: string;
  deliveryMode?: string; // 'own_agent' | 'shiprocket' | 'hybrid' | 'manual'
  initialLat?: number;
  initialLng?: number;
  mode?: "customer" | "store"; // 'store' = configuring store/warehouse dispatch pin (skips deliverability validation)
};

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }; // India center fallback

export function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof google !== "undefined" && google.maps) {
      resolve();
      return;
    }
    if (!window._googleMapsCallbacks) {
      window._googleMapsCallbacks = [];
    }
    window._googleMapsCallbacks.push(resolve);

    if (!window._googleMapsLoaded) {
      window._googleMapsLoaded = true;
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&callback=__googleMapsReady`;
      script.async = true;
      script.defer = true;
      (window as Window).__googleMapsReady = () => {
        (window._googleMapsCallbacks || []).forEach((cb) => cb());
        window._googleMapsCallbacks = [];
      };
      document.head.appendChild(script);
    }
  });
}

export async function geocodeAddressText(addressText: string): Promise<{ lat: number; lng: number } | null> {
  if (!addressText || !addressText.trim()) return null;
  await loadGoogleMapsScript();
  if (typeof google === "undefined" || !google.maps) return null;
  const geocoder = new google.maps.Geocoder();
  try {
    const res = await geocoder.geocode({ address: addressText });
    if (res.results && res.results.length > 0 && res.results[0].geometry?.location) {
      const loc = res.results[0].geometry.location;
      return { lat: loc.lat(), lng: loc.lng() };
    }
  } catch (e) {
    console.warn("Geocoding failed for text address:", addressText, e);
  }
  return null;
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

export const GoogleMapPicker: React.FC<GoogleMapPickerProps> = ({
  siteId,
  isOpen,
  onClose,
  onConfirm,
  accentColor = "#2563eb",
  deliveryMode,
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
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [reversedAddress, setReversedAddress] = useState<{
    addressLine: string;
    city: string;
    state?: string;
    pincode: string;
  }>({ addressLine: "", city: "", state: "", pincode: "" });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [deliverability, setDeliverability] = useState<DeliverabilityResult | null>(null);
  const [isCheckingDeliverability, setIsCheckingDeliverability] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Load Google Maps SDK
  useEffect(() => {
    if (!isOpen) return;
    if (!MAPS_API_KEY || MAPS_API_KEY === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
      setLoadError(true);
      return;
    }
    loadGoogleMapsScript()
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
      if (!siteId) return;
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
    [siteId]
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
      setLocationError("Geolocation is not supported by your browser");
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
        // If high-accuracy times out, try standard accuracy immediately
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
      zoom: initialLat ? 16 : 5,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    });
    mapInstanceRef.current = map;

    const marker = new google.maps.Marker({
      map,
      position: startCenter,
      draggable: true,
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: accentColor,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
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
      checkDeliverabilityForPin(initialLat, initialLng);
    } else {
      // Prompt GPS geolocation immediately with high accuracy
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
      });
    }
  }, [mapsLoaded, isOpen, initialLat, initialLng, accentColor, moveMarkerTo, reverseGeocode, checkDeliverabilityForPin]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      mapInstanceRef.current = null;
      markerRef.current = null;
      geocoderRef.current = null;
      autocompleteRef.current = null;
      setCurrentLat(null);
      setCurrentLng(null);
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
  const hasRadius = deliverability?.check_required && deliverability.radius_km;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          height: "min(86vh, 640px)",
          background: "#ffffff",
          borderRadius: "16px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: accentColor,
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                {mode === "store" ? "Pin Warehouse / Store Location" : "Pin Delivery Location"}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                {mode === "store"
                  ? "Drop pin at your store or dispatch warehouse to configure delivery routing"
                  : "Drag the marker or tap on the map to set your exact doorstep location"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "#f1f5f9",
              borderRadius: "8px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "14px",
              color: "#475569",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Search bar + Current Location button */}
        {mapsLoaded && !loadError && (
          <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexShrink: 0, display: "flex", gap: "8px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                  color: "#94a3b8",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search for street, landmark or area..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: "38px",
                  padding: "0 12px 0 36px",
                  fontSize: "13px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  background: "#ffffff",
                  color: "#0f172a",
                  outline: "none",
                }}
              />
            </div>

            <button
              type="button"
              onClick={locateUser}
              disabled={isLocating}
              title="Detect and jump to your current GPS location"
              style={{
                height: "38px",
                padding: "0 14px",
                borderRadius: "8px",
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1d4ed8",
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
                      width: "12px",
                      height: "12px",
                      border: "2px solid #1d4ed8",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>Locating...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                  </svg>
                  <span>Use Current Location</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Map area */}
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
              }}
            >
              <span style={{ fontSize: "36px" }}>🗺️</span>
              <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "15px" }}>
                Google Maps not configured
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", maxWidth: "340px" }}>
                Add your <code>VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
                <code>frontend/.env</code> with Maps JavaScript API, Places API &amp;
                Geocoding API enabled.
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
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: `2px solid ${accentColor}`,
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
              {/* Floating Locate Me GPS button */}
              <button
                type="button"
                onClick={locateUser}
                disabled={isLocating}
                title="Jump to my current GPS location"
                style={{
                  position: "absolute",
                  bottom: "20px",
                  right: "16px",
                  zIndex: 10,
                  width: "42px",
                  height: "42px",
                  borderRadius: "8px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isLocating ? "wait" : "pointer",
                  color: "#1d4ed8",
                }}
              >
                {isLocating ? (
                  <div
                    style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid #1d4ed8",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                  </svg>
                )}
              </button>
            </>
          )}

          {/* Deliverability badge overlay */}
          {showDeliverabilityBadge && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
                background: isCheckingDeliverability
                  ? "#f8fafc"
                  : isDeliverable
                  ? "#f0fdf4"
                  : "#fef2f2",
                border: `1px solid ${
                  isCheckingDeliverability ? "#e2e8f0" : isDeliverable ? "#bbf7d0" : "#fecaca"
                }`,
                borderRadius: "999px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                color: isCheckingDeliverability
                  ? "#64748b"
                  : isDeliverable
                  ? "#15803d"
                  : "#dc2626",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
                whiteSpace: "nowrap",
              }}
            >
              {isCheckingDeliverability ? (
                <>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      border: "1.5px solid #94a3b8",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span>Checking serviceability...</span>
                </>
              ) : isDeliverable ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Delivery available to this location</span>
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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

        {/* Bottom: Reversed address preview + confirm */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            flexShrink: 0,
          }}
        >
          {locationError && (
            <div
              style={{
                marginBottom: "8px",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{locationError}</span>
            </div>
          )}
          {currentLat !== null && (
            <div style={{ marginBottom: "10px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                DETECTED ADDRESS
              </p>
              {isGeocoding ? (
                <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>Detecting address...</p>
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "#0f172a", fontWeight: 500, lineHeight: 1.5 }}>
                  {[reversedAddress.addressLine, reversedAddress.city, reversedAddress.pincode]
                    .filter(Boolean)
                    .join(", ") || "Address detected — any missing details can be filled manually"}
                </p>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: "0 0 auto",
                height: "40px",
                padding: "0 16px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                background: "#ffffff",
                color: "#475569",
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
                height: "40px",
                border: "none",
                borderRadius: "8px",
                background:
                  !currentLat || isConfirming
                    ? "#cbd5e1"
                    : accentColor,
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: !currentLat || isConfirming ? "not-allowed" : "pointer",
              }}
            >
              {isConfirming
                ? "Confirming..."
                : mode === "store"
                ? "✓ Confirm Warehouse Location"
                : "✓ Confirm This Location"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GoogleMapPicker;
