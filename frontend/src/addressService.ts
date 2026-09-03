import { API_BASE_URL } from "./config/api";
import { getCustomerAuthHeaders } from "./utils/customerAuthFetch";

export type SavedAddress = {
  id: string;
  siteId: string;
  userId: string;
  fullName: string;
  mobileNumber: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  email: string | null;
  addressType: string;
  isDefault: boolean;
  latitude?: number | null;
  longitude?: number | null;
  geoAccuracy?: string | null; // 'pinned' | 'geocoded'
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SaveAddressPayload = {
  full_name: string;
  mobile_number: string;
  address_line1: string;
  city: string;
  postal_code: string;
  email?: string | null;
  address_type: string;
  is_default?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  geo_accuracy?: string | null;
};

export type DeliverabilityResult = {
  deliverable: boolean;
  check_required: boolean;
  delivery_mode?: string;
  distance_km?: number;
  radius_km?: number;
  reason?: string;
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let msg = "Request failed";
    if (typeof data?.detail === "string") {
      msg = data.detail;
    } else if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      msg = data.detail.map((e: any) => e.msg).join(", ");
    }
    throw new Error(msg);
  }

  return data as T;
}


export async function getCheckoutAddresses(siteId: string): Promise<SavedAddress[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/checkout/addresses/${siteId}`, {
      method: "GET",
      credentials: "include",
      headers: getCustomerAuthHeaders(siteId),
    });

    if (response.status === 401 || response.status === 403) {
      return [];
    }

    const data = await parseJsonResponse<{ addresses: SavedAddress[] }>(response);
    return data?.addresses || [];
  } catch {
    return [];
  }
}

export async function createCheckoutAddress(
  siteId: string,
  payload: SaveAddressPayload
): Promise<SavedAddress> {
  const response = await fetch(`${API_BASE_URL}/checkout/addresses/${siteId}`, {
    method: "POST",
    credentials: "include",
    headers: getCustomerAuthHeaders(siteId, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<SavedAddress>(response);
}

export async function updateCheckoutAddress(
  siteId: string,
  addressId: string,
  payload: SaveAddressPayload
): Promise<SavedAddress> {
  const response = await fetch(
    `${API_BASE_URL}/checkout/addresses/${siteId}/${addressId}`,
    {
      method: "PUT",
      credentials: "include",
      headers: getCustomerAuthHeaders(siteId, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    }
  );

  return parseJsonResponse<SavedAddress>(response);
}

export async function deleteCheckoutAddress(
  siteId: string,
  addressId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/checkout/addresses/${siteId}/${addressId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: getCustomerAuthHeaders(siteId),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "Failed to delete address");
  }
}

export async function setDefaultCheckoutAddress(
  siteId: string,
  addressId: string
): Promise<SavedAddress> {
  const response = await fetch(
    `${API_BASE_URL}/checkout/addresses/${siteId}/${addressId}/default`,
    {
      method: "POST",
      credentials: "include",
      headers: getCustomerAuthHeaders(siteId),
    }
  );

  return parseJsonResponse<SavedAddress>(response);
}

export async function checkDeliverability(
  siteId: string,
  lat: number,
  lng: number
): Promise<DeliverabilityResult> {
  const response = await fetch(
    `${API_BASE_URL}/checkout/deliverability/${siteId}?lat=${lat}&lng=${lng}`,
    {
      method: "GET",
      credentials: "include",
      headers: getCustomerAuthHeaders(siteId),
    }
  );

  if (!response.ok) {
    // On error, default to allowing — don't block checkout
    return { deliverable: true, check_required: false };
  }

  return response.json();
}