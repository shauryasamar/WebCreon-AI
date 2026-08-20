"""
Shiprocket REST API client.

Wraps the Shiprocket v1 external API:
  - Token management (auto-refresh, 10-day TTL)
  - Order creation
  - AWB assignment
  - Label PDF URL retrieval
  - Serviceability check

All methods raise ShiprocketError on failure so callers can handle gracefully.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external"


class ShiprocketError(Exception):
    """Raised when Shiprocket API returns a non-2xx response or unexpected payload."""


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ShiprocketOrderResult:
    order_id: int
    shipment_id: int
    courier_company_id: Optional[int] = None
    awb_number: Optional[str] = None
    label_url: Optional[str] = None
    tracking_url: Optional[str] = None


@dataclass
class CourierOption:
    courier_company_id: int
    courier_name: str
    rate: float
    estimated_delivery_days: Optional[int]


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class ShiprocketClient:
    """Stateless Shiprocket API client. Pass a fresh token for each call."""

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    @staticmethod
    def get_token(email: str, password: str) -> str:
        """
        Authenticate with Shiprocket API and return JWT token string.
        Endpoint: POST https://apiv2.shiprocket.in/v1/external/auth/login
        """
        resp = requests.post(
            f"{SHIPROCKET_BASE}/auth/login",
            json={"email": email, "password": password},
            timeout=15,
        )
        if not resp.ok:
            raise ShiprocketError(
                f"Shiprocket login failed [{resp.status_code}]: {resp.text[:300]}"
            )
        data = resp.json()
        token = data.get("token")
        if not token:
            raise ShiprocketError("Shiprocket login returned no token")
        return token

    # ------------------------------------------------------------------
    # Serviceability
    # ------------------------------------------------------------------

    @staticmethod
    def check_serviceability(
        token: str,
        pickup_pincode: str,
        delivery_pincode: str,
        weight_kg: float,
        cod: bool = False,
    ) -> list[CourierOption]:
        """
        Returns a list of available couriers for the given route,
        sorted by rate ascending (cheapest first).
        Endpoint: GET https://apiv2.shiprocket.in/v1/external/courier/serviceability
        """
        params = {
            "pickup_postcode": pickup_pincode,
            "delivery_postcode": delivery_pincode,
            "weight": weight_kg,
            "cod": 1 if cod else 0,
        }
        resp = requests.get(
            f"{SHIPROCKET_BASE}/courier/serviceability",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=15,
        )
        if not resp.ok:
            raise ShiprocketError(
                f"Serviceability check failed [{resp.status_code}]: {resp.text[:300]}"
            )
        data = resp.json()
        available = (
            data.get("data", {})
            .get("available_courier_companies", [])
        )
        options: list[CourierOption] = []
        for c in available:
            options.append(
                CourierOption(
                    courier_company_id=c.get("courier_company_id", 0),
                    courier_name=c.get("courier_name", "Unknown"),
                    rate=float(c.get("rate", 0)),
                    estimated_delivery_days=c.get("estimated_delivery_days"),
                )
            )
        options.sort(key=lambda x: x.rate)
        return options

    # ------------------------------------------------------------------
    # Pickup Locations
    # ------------------------------------------------------------------

    @staticmethod
    def get_pickup_locations(token: str) -> list[dict[str, Any]]:
        """
        Fetch merchant's registered pickup locations from Shiprocket.
        Endpoint: GET https://apiv2.shiprocket.in/v1/external/settings/company/pickup
        """
        resp = requests.get(
            f"{SHIPROCKET_BASE}/settings/company/pickup",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        if not resp.ok:
            return []
        data = resp.json()
        addresses = data.get("data", {}).get("shipping_address", [])
        return addresses

    # ------------------------------------------------------------------
    # Order creation
    # ------------------------------------------------------------------

    @staticmethod
    def create_order(
        token: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Create a Shiprocket order.
        Endpoint: POST https://apiv2.shiprocket.in/v1/external/orders/create/adhoc
        """
        resp = requests.post(
            f"{SHIPROCKET_BASE}/orders/create/adhoc",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=20,
        )
        if not resp.ok:
            raise ShiprocketError(
                f"Order creation failed [{resp.status_code}]: {resp.text[:500]}"
            )
        data = resp.json()
        if not data.get("order_id"):
            raise ShiprocketError(f"Shiprocket order_id missing in response: {data}")
        return data

    # ------------------------------------------------------------------
    # Reverse Return Order creation
    # ------------------------------------------------------------------

    @staticmethod
    def create_return_order(
        token: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Create a Shiprocket reverse return order.
        Endpoint: POST https://apiv2.shiprocket.in/v1/external/orders/create/return
        """
        resp = requests.post(
            f"{SHIPROCKET_BASE}/orders/create/return",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=20,
        )
        if not resp.ok:
            raise ShiprocketError(
                f"Shiprocket return order creation failed [{resp.status_code}]: {resp.text[:500]}"
            )
        data = resp.json()
        if not data.get("order_id") and not data.get("shipment_id"):
            raise ShiprocketError(f"Shiprocket return response missing order_id/shipment_id: {data}")
        return data

    # ------------------------------------------------------------------
    # AWB assignment
    # ------------------------------------------------------------------

    @staticmethod
    def assign_awb(
        token: str,
        shipment_id: int,
        courier_id: Optional[int] = None,
        is_return: bool = False,
    ) -> dict[str, Any]:
        """
        Assign an AWB to a shipment.
        Returns dict with 'awb' and 'courier_name' keys.
        Endpoint: POST https://apiv2.shiprocket.in/v1/external/courier/assign/awb
        """
        body: dict[str, Any] = {"shipment_id": str(shipment_id)}
        if courier_id:
            body["courier_id"] = str(courier_id)
        if is_return:
            body["is_return"] = 1

        resp = requests.post(
            f"{SHIPROCKET_BASE}/courier/assign/awb",
            headers={"Authorization": f"Bearer {token}"},
            json=body,
            timeout=15,
        )
        if not resp.ok:
            raise ShiprocketError(
                f"AWB assignment failed [{resp.status_code}]: {resp.text[:300]}"
            )
        data = resp.json()
        response_data = data.get("response", {}).get("data", {})
        awb = response_data.get("awb_code")
        if not awb:
            awb = data.get("awb_code") or data.get("awb")
        if not awb:
            raise ShiprocketError(f"AWB not found in response: {data}")
        courier_name = (
            response_data.get("courier_name")
            or response_data.get("courier_company_name")
            or data.get("courier_name")
        )
        return {
            "awb": str(awb),
            "courier_name": courier_name or None,
        }

    # ------------------------------------------------------------------
    # Label generation
    # ------------------------------------------------------------------

    @staticmethod
    def get_label_url(token: str, shipment_id: int) -> Optional[str]:
        """
        Request a PDF shipping label for the given shipment.
        Endpoint: POST https://apiv2.shiprocket.in/v1/external/courier/generate/label
        """
        resp = requests.post(
            f"{SHIPROCKET_BASE}/courier/generate/label",
            headers={"Authorization": f"Bearer {token}"},
            json={"shipment_id": [shipment_id]},
            timeout=15,
        )
        if not resp.ok:
            logger.warning("Label generation failed: %s", resp.text[:300])
            return None
        data = resp.json()
        return data.get("label_url") or data.get("response", {}).get("label_url")

    # ------------------------------------------------------------------
    # Shipment status
    # ------------------------------------------------------------------

    @staticmethod
    def get_shipment_status(token: str, awb: str) -> Optional[str]:
        """
        Track a shipment by AWB.
        Endpoint: GET https://apiv2.shiprocket.in/v1/external/courier/track/awb/{awb}
        """
        resp = requests.get(
            f"{SHIPROCKET_BASE}/courier/track/awb/{awb}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        if not resp.ok:
            return None
        data = resp.json()
        return (
            data.get("tracking_data", {})
            .get("shipment_track", [{}])[0]
            .get("current_status")
        )

    @staticmethod
    def get_tracking_details(token: str, awb: str) -> dict[str, Any]:
        """
        Track a shipment by AWB and return full tracking details including scans/checkpoints.
        Endpoint: GET https://apiv2.shiprocket.in/v1/external/courier/track/awb/{awb}
        """
        try:
            resp = requests.get(
                f"{SHIPROCKET_BASE}/courier/track/awb/{awb}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            if not resp.ok:
                return {"scans": [], "current_status": None, "courier_name": None}
            data = resp.json()
            tracking_data = data.get("tracking_data", {})
            shipment_track = tracking_data.get("shipment_track", [{}])[0] if tracking_data.get("shipment_track") else {}
            activities = tracking_data.get("shipment_track_activities", [])
            
            scans = []
            for act in activities:
                scans.append({
                    "date": act.get("date"),
                    "status": act.get("status") or act.get("sr-status"),
                    "activity": act.get("activity"),
                    "location": act.get("location"),
                })
                
            return {
                "current_status": shipment_track.get("current_status"),
                "courier_name": shipment_track.get("courier_name"),
                "edd": shipment_track.get("edd"),
                "scans": scans,
            }
        except Exception as err:
            logger.warning("Error fetching Shiprocket tracking details: %s", err)
            return {"scans": [], "current_status": None, "courier_name": None}

    # ------------------------------------------------------------------
    # Cancellation & RTO
    # ------------------------------------------------------------------

    @staticmethod
    def cancel_order(token: str, order_ids: list[int | str]) -> dict[str, Any]:
        """
        Cancel one or more custom orders in Shiprocket.
        Endpoint: POST https://apiv2.shiprocket.in/v1/external/orders/cancel
        """
        try:
            int_ids = [int(oid) for oid in order_ids if str(oid).isdigit()]
            if not int_ids:
                return {"message": "No numeric Shiprocket order IDs provided"}
            resp = requests.post(
                f"{SHIPROCKET_BASE}/orders/cancel",
                json={"ids": int_ids},
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            if not resp.ok:
                logger.warning("Shiprocket cancel order failed [%s]: %s", resp.status_code, resp.text[:300])
                return {"success": False, "error": resp.text[:300]}
            return resp.json()
        except Exception as err:
            logger.warning("Shiprocket cancel_order error: %s", err)
            return {"success": False, "error": str(err)}

    @staticmethod
    def cancel_shipment_by_awb(token: str, awbs: list[str]) -> dict[str, Any]:
        """
        Cancel an active shipment by AWB in Shiprocket (initiates RTO if in transit).
        Endpoint: POST https://apiv2.shiprocket.in/v1/external/orders/cancel/shipment/awbs
        """
        try:
            resp = requests.post(
                f"{SHIPROCKET_BASE}/orders/cancel/shipment/awbs",
                json={"awbs": awbs},
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            if not resp.ok:
                logger.warning("Shiprocket cancel AWB failed [%s]: %s", resp.status_code, resp.text[:300])
                return {"success": False, "error": resp.text[:300]}
            return resp.json()
        except Exception as err:
            logger.warning("Shiprocket cancel_shipment_by_awb error: %s", err)
            return {"success": False, "error": str(err)}

    # ------------------------------------------------------------------
    # Convenience: build order payload
    # ------------------------------------------------------------------

    @staticmethod
    def build_order_payload(
        *,
        order_id: str,
        order_date: str,          # "YYYY-MM-DD HH:MM"
        billing: dict[str, Any],  # name, last_name, address, city, pincode, state, country, email, phone
        shipping: dict[str, Any], # same structure
        items: list[dict[str, Any]],  # name, sku, units, selling_price
        payment_method: str = "Prepaid",
        sub_total: float = 0.0,
        length: float = 10.0,    # cm
        breadth: float = 10.0,   # cm
        height: float = 10.0,    # cm
        weight: float = 0.5,     # kg
        pickup_location: str = "Primary",
        channel_id: str = "",
    ) -> dict[str, Any]:
        return {
            "order_id": order_id,
            "order_date": order_date,
            "pickup_location": pickup_location,
            "channel_id": channel_id,
            "billing_customer_name": billing.get("name", ""),
            "billing_last_name": billing.get("last_name", ""),
            "billing_address": billing.get("address", ""),
            "billing_city": billing.get("city", ""),
            "billing_pincode": billing.get("pincode", ""),
            "billing_state": billing.get("state", ""),
            "billing_country": billing.get("country", "India"),
            "billing_email": billing.get("email", ""),
            "billing_phone": billing.get("phone", ""),
            "shipping_is_billing": billing.get("pincode") == shipping.get("pincode"),
            "shipping_customer_name": shipping.get("name", ""),
            "shipping_last_name": shipping.get("last_name", ""),
            "shipping_address": shipping.get("address", ""),
            "shipping_city": shipping.get("city", ""),
            "shipping_pincode": shipping.get("pincode", ""),
            "shipping_state": shipping.get("state", ""),
            "shipping_country": shipping.get("country", "India"),
            "shipping_email": shipping.get("email", ""),
            "shipping_phone": shipping.get("phone", ""),
            "order_items": items,
            "payment_method": payment_method,
            "sub_total": sub_total,
            "length": length,
            "breadth": breadth,
            "height": height,
            "weight": weight,
        }

    @staticmethod
    def build_return_order_payload(
        *,
        order_id: str,
        order_date: str,           # "YYYY-MM-DD HH:MM"
        pickup_customer: dict[str, Any],   # name, address, city, pincode, state, country, email, phone
        shipping_merchant: dict[str, Any], # name, address, city, pincode, state, country, email, phone
        items: list[dict[str, Any]],       # name, sku, units, selling_price, discount, qc_enable
        payment_method: str = "PREPAID",
        sub_total: float = 0.0,
        length: float = 10.0,
        breadth: float = 10.0,
        height: float = 10.0,
        weight: float = 0.5,
        channel_id: str = "",
    ) -> dict[str, Any]:
        return {
            "order_id": order_id,
            "order_date": order_date,
            "channel_id": channel_id,
            "pickup_customer_name": pickup_customer.get("name") or pickup_customer.get("full_name") or "Customer",
            "pickup_last_name": pickup_customer.get("last_name", ""),
            "pickup_address": pickup_customer.get("address") or pickup_customer.get("address_line1") or "",
            "pickup_address_2": pickup_customer.get("address_2", ""),
            "pickup_city": pickup_customer.get("city", ""),
            "pickup_state": pickup_customer.get("state") or pickup_customer.get("city") or "State",
            "pickup_country": pickup_customer.get("country", "India"),
            "pickup_pincode": str(pickup_customer.get("pincode") or pickup_customer.get("postal_code") or "560001"),
            "pickup_email": pickup_customer.get("email", ""),
            "pickup_phone": str(pickup_customer.get("phone") or pickup_customer.get("mobile_number") or ""),
            "shipping_customer_name": shipping_merchant.get("name") or "Store Merchant",
            "shipping_last_name": shipping_merchant.get("last_name", ""),
            "shipping_address": shipping_merchant.get("address") or shipping_merchant.get("sender_address") or "",
            "shipping_address_2": shipping_merchant.get("address_2", ""),
            "shipping_city": shipping_merchant.get("city") or shipping_merchant.get("sender_city") or "",
            "shipping_state": shipping_merchant.get("state") or shipping_merchant.get("sender_state") or "State",
            "shipping_country": shipping_merchant.get("country", "India"),
            "shipping_pincode": str(shipping_merchant.get("pincode") or shipping_merchant.get("sender_pincode") or "560001"),
            "shipping_email": shipping_merchant.get("email") or shipping_merchant.get("shiprocket_email") or "",
            "shipping_phone": str(shipping_merchant.get("phone") or shipping_merchant.get("sender_phone") or ""),
            "order_items": items,
            "payment_method": payment_method,
            "total_discount": "0",
            "sub_total": sub_total,
            "length": length,
            "breadth": breadth,
            "height": height,
            "weight": weight,
        }
