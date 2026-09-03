import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  theme?: "light" | "dark" | string | Record<string, any>;
  backgroundColor?: string;
  inputColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  borderColor?: string;
  deliveryMode?: string; // 'own_agent' | 'shiprocket' | 'hybrid' | 'manual'
  initialLat?: number;
  initialLng?: number;
  mode?: "customer" | "store"; // 'store' = configuring store/warehouse dispatch pin (skips deliverability validation)
  map_modal_title?: string;
  map_search_placeholder?: string;
  map_confirm_button_label?: string;
  map_helper_text?: string;
  map_modal_radius?: number;
  map_button_radius?: number;
  map_search_radius?: number;
  map_modal_bg?: string;
  map_header_text_color?: string;
  map_search_bg?: string;
  map_search_text_color?: string;
  map_confirm_btn_bg?: string;
  map_confirm_btn_text?: string;
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

export async function geocodeAddressText(
  addressText: string
): Promise<{ lat: number; lng: number } | null> {
  if (!addressText || !addressText.trim()) return null;
  if (!MAPS_API_KEY) return null;
  try {
    await loadGoogleMapsScript(MAPS_API_KEY);
    if (!window.google?.maps) return null;
    const geocoder = new google.maps.Geocoder();
    const res = await geocoder.geocode({
      address: addressText,
      componentRestrictions: { country: "in" },
    });
    if (res.results && res.results.length > 0) {
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

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1f2c" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#13232c" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#293548" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b4a6b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b1329" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
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
  map_modal_title,
  map_search_placeholder,
  map_confirm_button_label,
  map_helper_text,
  map_modal_radius,
  map_button_radius,
  map_search_radius,
  map_modal_bg,
  map_header_text_color,
  map_search_bg,
  map_search_text_color,
  map_confirm_btn_bg,
  map_confirm_btn_text,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [currentLat, setCurrentLat] = useState<number | null>(initialLat ?? null);
  const [currentLng, setCurrentLng] = useState<number | null>(initialLng ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showPredictionsDropdown, setShowPredictionsDropdown] = useState(false);

  const [reversedAddress, setReversedAddress] = useState<{
    addressLine: string;
    city: string;
    state?: string;
    pincode: string;
  }>({ addressLine: "", city: "", state: "", pincode: "" });

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [deliverability, setDeliverability] = useState<DeliverabilityResult | null>(null);
  const [isCheckingDeliverability, setIsCheckingDeliverability] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Responsive mobile detection
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
  const isDark =
    theme === "dark" ||
    (typeof theme === "object" && Boolean(theme?.mode === "dark" || theme?.isDark)) ||
    Boolean(backgroundColor && isColorDarkHex(backgroundColor));

  const resolvedAccent = accentColor || "#2563eb";
  const palette = {
    modalBg: map_modal_bg || (isDark ? backgroundColor || "#0f172a" : "#ffffff"),
    cardBg: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
    surfaceBg: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(241, 245, 249, 0.9)",
    inputBg: map_search_bg || (isDark ? inputColor || "#1e293b" : "#f8fafc"),
    text: map_search_text_color || (isDark ? textColor || "#f8fafc" : "#0f172a"),
    headerText: map_header_text_color || (isDark ? textColor || "#f8fafc" : "#0f172a"),
    textMuted: isDark ? mutedTextColor || "#94a3b8" : "#64748b",
    border: isDark ? borderColor || "#334155" : "#e2e8f0",
    accent: resolvedAccent,
    confirmBtnBg: map_confirm_btn_bg || resolvedAccent,
    confirmBtnText: map_confirm_btn_text || "#ffffff",
    dropdownBg: isDark ? "#1e293b" : "#ffffff",
    dropdownHover: isDark ? "rgba(51, 65, 85, 0.6)" : "#f1f5f9",
  };

  // Load Google Maps SDK
  useEffect(() => {
    if (!isOpen) return;
    if (!MAPS_API_KEY) {
      setLoadError(true);
      return;
    }
    loadGoogleMapsScript(MAPS_API_KEY)
      .then(() => {
        setMapsLoaded(true);
        if (window.google?.maps?.places) {
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        }
      })
      .catch(() => setLoadError(true));
  }, [isOpen]);

  // Live predictions
  useEffect(() => {
    if (!mapsLoaded || !searchQuery || searchQuery.trim().length < 2) {
      setPredictions([]);
      setShowPredictionsDropdown(false);
      return;
    }

    if (!autocompleteServiceRef.current && window.google?.maps?.places) {
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    }

    if (!autocompleteServiceRef.current) return;

    const timer = setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: searchQuery.trim(),
          componentRestrictions: { country: "in" },
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results);
            setShowPredictionsDropdown(true);
          } else {
            setPredictions([]);
          }
        }
      );
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, mapsLoaded]);

  // Reverse geocode
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

  // Move marker and sync address
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

  // Select a suggestion from custom dropdown
  const handleSelectPrediction = async (prediction: google.maps.places.AutocompletePrediction) => {
    setShowPredictionsDropdown(false);
    setSearchQuery(prediction.structured_formatting?.main_text || prediction.description);

    if (geocoderRef.current) {
      try {
        const response = await geocoderRef.current.geocode({ placeId: prediction.place_id });
        if (response.results && response.results[0]) {
          const loc = response.results[0].geometry.location;
          const lat = loc.lat();
          const lng = loc.lng();
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat, lng });
            mapInstanceRef.current.setZoom(17);
          }
          moveMarkerTo(lat, lng);
          return;
        }
      } catch (e) {
        console.warn("PlaceId lookup error:", e);
      }
    }

    const geo = await geocodeAddressText(prediction.description);
    if (geo) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: geo.lat, lng: geo.lng });
        mapInstanceRef.current.setZoom(17);
      }
      moveMarkerTo(geo.lat, geo.lng);
    }
  };

  // GPS Location detector
  const locateUser = useCallback(() => {
    if (!navigator.geolocation) return;

    setIsLocating(true);

    const onLocationSuccess = (pos: GeolocationPosition) => {
      setIsLocating(false);
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
        () => setIsLocating(false),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      () => tryLowAccuracy(),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  }, [moveMarkerTo]);

  // Handle direct text search submit
  const handleManualSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setShowPredictionsDropdown(false);
    const geo = await geocodeAddressText(query);
    if (geo) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: geo.lat, lng: geo.lng });
        mapInstanceRef.current.setZoom(17);
      }
      moveMarkerTo(geo.lat, geo.lng);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapsLoaded || !isOpen || !mapRef.current) return;
    if (mapInstanceRef.current) return;

    geocoderRef.current = new google.maps.Geocoder();

    const startCenter =
      initialLat && initialLng
        ? { lat: initialLat, lng: initialLng }
        : DEFAULT_CENTER;

    const map = new google.maps.Map(mapRef.current, {
      center: startCenter,
      zoom: initialLat ? 17 : 5,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
      styles: isDark ? DARK_MAP_STYLES : LIGHT_MAP_STYLES,
    });
    mapInstanceRef.current = map;

    // SVG Marker Pin
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
        strokeWeight: 2.5,
        scale: 2.2,
        anchor: new google.maps.Point(12, 22),
      },
    });
    markerRef.current = marker;

    marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      moveMarkerTo(e.latLng.lat(), e.latLng.lng());
    });

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
  }, [mapsLoaded, isOpen, initialLat, initialLng, palette.accent, isDark, moveMarkerTo, reverseGeocode, checkDeliverabilityForPin, mode, locateUser]);

  // Reset state on modal close
  useEffect(() => {
    if (!isOpen) {
      mapInstanceRef.current = null;
      markerRef.current = null;
      geocoderRef.current = null;
      autocompleteServiceRef.current = null;
      setCurrentLat(null);
      setCurrentLng(null);
      setSearchQuery("");
      setPredictions([]);
      setShowPredictionsDropdown(false);
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

  if (!isOpen || typeof document === "undefined") return null;

  const showDeliverability =
    mode !== "store" &&
    currentLat !== null &&
    (isCheckingDeliverability ||
      (deliverability && deliverability.check_required));
  const isDeliverable = deliverability?.deliverable ?? true;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999999,
        background: isDark ? "rgba(10, 15, 29, 0.72)" : "rgba(15, 23, 42, 0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "10px" : "20px",
        boxSizing: "border-box",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          height: isMobile ? "86vh" : "min(88vh, 680px)",
          background: palette.modalBg,
          borderRadius: map_modal_radius !== undefined ? `${map_modal_radius}px` : "18px",
          border: `1px solid ${palette.border}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: isDark
            ? "0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)"
            : "0 30px 80px rgba(15,23,42,0.22), 0 0 0 1px rgba(0,0,0,0.05)",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* Streamlined Combined Search & Header Bar (Only 54px high) */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${palette.border}`,
            background: palette.modalBg,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
            zIndex: 30,
            position: "relative",
          }}
        >
          {/* Search Input Box */}
          <form
            onSubmit={handleManualSearch}
            style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", position: "relative" }}
          >
            <span
              style={{
                position: "absolute",
                left: "12px",
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
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (predictions.length > 0) setShowPredictionsDropdown(true);
              }}
              placeholder={map_search_placeholder || "Search address, landmark, area..."}
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: "38px",
                padding: "0 32px 0 36px",
                fontSize: "13px",
                fontWeight: 500,
                border: `1px solid ${palette.border}`,
                borderRadius: map_search_radius !== undefined ? `${map_search_radius}px` : "10px",
                background: palette.inputBg,
                color: palette.text,
                outline: "none",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setPredictions([]);
                  setShowPredictionsDropdown(false);
                }}
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
          </form>

          {/* Quick GPS Button */}
          <button
            type="button"
            onClick={locateUser}
            disabled={isLocating}
            title="Use current GPS location"
            style={{
              height: "38px",
              padding: "0 10px",
              borderRadius: "10px",
              border: `1px solid ${palette.accent}35`,
              background: isDark ? `${palette.accent}1c` : `${palette.accent}10`,
              color: palette.accent,
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: isLocating ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {isLocating ? (
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  border: `2px solid ${palette.accent}`,
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            )}
            <span>GPS</span>
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
              borderRadius: "10px",
              width: "34px",
              height: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "14px",
              color: palette.text,
              flexShrink: 0,
            }}
          >
            ✕
          </button>

          {/* Place Suggestions Dropdown */}
          {showPredictionsDropdown && predictions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: "14px",
                right: "14px",
                background: palette.dropdownBg,
                border: `1px solid ${palette.border}`,
                borderRadius: "12px",
                boxShadow: "0 16px 36px rgba(0,0,0,0.28)",
                maxHeight: "240px",
                overflowY: "auto",
                zIndex: 50,
                marginTop: "4px",
              }}
            >
              {predictions.map((p) => (
                <div
                  key={p.place_id}
                  onClick={() => handleSelectPrediction(p)}
                  style={{
                    padding: "9px 12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    cursor: "pointer",
                    borderBottom: `1px solid ${palette.border}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = palette.dropdownHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ marginTop: "2px", color: palette.accent, flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: palette.text, lineHeight: 1.25 }}>
                      {p.structured_formatting?.main_text || p.description}
                    </p>
                    {p.structured_formatting?.secondary_text && (
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: palette.textMuted, lineHeight: 1.25 }}>
                        {p.structured_formatting.secondary_text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clean, Full-Visibility Map Viewport (Takes up maximum space) */}
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
                padding: "20px",
                textAlign: "center",
                background: palette.modalBg,
              }}
            >
              <span style={{ fontSize: "36px" }}>🗺️</span>
              <p style={{ margin: 0, fontWeight: 700, color: palette.text, fontSize: "15px" }}>
                Google Maps API Configuration Needed
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: palette.textMuted, maxWidth: "320px" }}>
                Please set <code>VITE_GOOGLE_MAPS_API_KEY</code> with Maps JavaScript, Places &amp; Geocoding APIs.
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

              {/* Floating Re-center FAB */}
              <button
                type="button"
                onClick={locateUser}
                disabled={isLocating}
                title="Locate me"
                style={{
                  position: "absolute",
                  bottom: "14px",
                  right: "14px",
                  zIndex: 15,
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: palette.cardBg,
                  border: `1px solid ${palette.border}`,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isLocating ? "wait" : "pointer",
                  color: palette.accent,
                  backdropFilter: "blur(6px)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
        </div>

        {/* Bottom Doorstep Preview & Confirm Card (With Integrated Deliverability Status) */}
        <div
          style={{
            padding: "12px 14px 14px",
            borderTop: `1px solid ${palette.border}`,
            background: palette.modalBg,
            flexShrink: 0,
            zIndex: 30,
          }}
        >
          {currentLat !== null && (
            <div
              style={{
                marginBottom: "10px",
                padding: "8px 12px",
                borderRadius: "10px",
                background: palette.surfaceBg,
                border: `1px solid ${palette.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", marginBottom: "3px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: palette.accent,
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 700,
                      color: palette.textMuted,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    {mode === "store" ? "Origin Warehouse Pin" : "Doorstep Location"}
                  </span>
                </div>

                {/* Inline Deliverability Badge in the Card (Unobtrusive) */}
                {showDeliverability && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: isCheckingDeliverability
                        ? isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"
                        : isDeliverable
                        ? isDark ? "rgba(22,101,52,0.3)" : "#dcfce7"
                        : isDark ? "rgba(153,27,27,0.3)" : "#fee2e2",
                      color: isCheckingDeliverability
                        ? palette.textMuted
                        : isDeliverable
                        ? isDark ? "#86efac" : "#15803d"
                        : isDark ? "#fca5a5" : "#b91c1c",
                      border: `1px solid ${
                        isCheckingDeliverability
                          ? palette.border
                          : isDeliverable
                          ? isDark ? "#166534" : "#bbf7d0"
                          : isDark ? "#991b1b" : "#fecaca"
                      }`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {isCheckingDeliverability
                      ? "Checking..."
                      : isDeliverable
                      ? "✓ Serviceable"
                      : "✕ Outside Radius"}
                  </span>
                )}
              </div>

              {isGeocoding ? (
                <p style={{ margin: 0, fontSize: "12px", color: palette.textMuted }}>Detecting exact address details...</p>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: palette.text,
                    fontWeight: 600,
                    lineHeight: 1.35,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {[reversedAddress.addressLine, reversedAddress.city, reversedAddress.pincode]
                    .filter(Boolean)
                    .join(", ") || "Location selected on map"}
                </p>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: "0 0 90px",
                height: "42px",
                border: `1px solid ${palette.border}`,
                borderRadius: "10px",
                background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
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
                height: "42px",
                border: "none",
                borderRadius: map_button_radius !== undefined ? `${map_button_radius}px` : "10px",
                background:
                  !currentLat || isConfirming
                    ? isDark ? "#334155" : "#cbd5e1"
                    : palette.confirmBtnBg,
                color: palette.confirmBtnText,
                fontSize: "13.5px",
                fontWeight: 700,
                cursor: !currentLat || isConfirming ? "not-allowed" : "pointer",
                boxShadow: !currentLat || isConfirming ? "none" : `0 4px 14px ${palette.confirmBtnBg}40`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              {isConfirming
                ? "Confirming..."
                : map_confirm_button_label ||
                  (mode === "store"
                    ? "✓ Confirm Origin Pin"
                    : "✓ Confirm This Location")}
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

  return createPortal(modalContent, document.body);
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
