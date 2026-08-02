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
};

const API_BASE_URL = "http://localhost:8000";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || "Request failed");
  }

  return data as T;
}

export async function getCheckoutAddresses(siteId: string): Promise<SavedAddress[]> {
  const response = await fetch(`${API_BASE_URL}/checkout/addresses/${siteId}`, {
    method: "GET",
    credentials: "include",
  });

  const data = await parseJsonResponse<{ addresses: SavedAddress[] }>(response);
  return data.addresses || [];
}

export async function createCheckoutAddress(
  siteId: string,
  payload: SaveAddressPayload
): Promise<SavedAddress> {
  const response = await fetch(`${API_BASE_URL}/checkout/addresses/${siteId}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
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
      headers: {
        "Content-Type": "application/json",
      },
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
    }
  );

  return parseJsonResponse<SavedAddress>(response);
}