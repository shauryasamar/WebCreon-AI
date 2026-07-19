from typing import Any, Dict, List


MODEL_TABLE_OVERRIDES = {
    "Product": "products",
    "Inventory": "inventory",
    "Order": "orders",
    "User": "users",
    "PaymentConfig": "payment_configs",
    "Category": "categories",
    "Offer": "offers",
    "Review": "reviews",
    "Address": "addresses",
    "Shipment": "shipments",
    "Banner": "banners",
}


def _table_name(model_name: str) -> str:
    return MODEL_TABLE_OVERRIDES.get(model_name, f"{model_name.lower()}s")


def _build_data_models_config(data_models: List[str]) -> Dict[str, Any]:
    config: Dict[str, Any] = {}

    for model in data_models:
        config[model] = {
            "table": _table_name(model),
            "primary_key": "id",
        }

    if "Product" in config:
        config["Product"]["fields"] = [
            "id",
            "title",
            "slug",
            "description",
            "price",
            "currency",
            "status",
            "category_id",
            "image_url",
            "created_at",
            "updated_at",
        ]

    if "Inventory" in config:
        config["Inventory"]["fields"] = [
            "id",
            "product_id",
            "sku",
            "stock",
            "availability",
            "updated_at",
        ]

    if "Order" in config:
        config["Order"]["fields"] = [
            "id",
            "user_id",
            "status",
            "subtotal",
            "total",
            "payment_status",
            "created_at",
        ]

    if "User" in config:
        config["User"]["fields"] = [
            "id",
            "name",
            "email",
            "phone",
            "role",
            "created_at",
        ]

    if "PaymentConfig" in config:
        config["PaymentConfig"]["fields"] = [
            "id",
            "provider",
            "mode",
            "is_active",
        ]

    if "Category" in config:
        config["Category"]["fields"] = ["id", "name", "slug", "image_url"]

    if "Offer" in config:
        config["Offer"]["fields"] = ["id", "title", "discount_type", "discount_value", "is_active"]

    if "Review" in config:
        config["Review"]["fields"] = ["id", "product_id", "user_id", "rating", "comment", "created_at"]

    if "Address" in config:
        config["Address"]["fields"] = ["id", "user_id", "line1", "city", "postal_code", "country"]

    if "Shipment" in config:
        config["Shipment"]["fields"] = ["id", "order_id", "provider", "tracking_id", "status"]

    return config


def _build_service_config(
    service_name: str,
    integrations: List[str],
    admin_features: List[str],
) -> Dict[str, Any]:
    if service_name == "CatalogService":
        return {
            "routes": ["/products", "/products/{id}", "/categories"],
            "models": ["Product", "Category"],
            "capabilities": ["list_products", "get_product", "list_categories", "search_products"],
        }

    if service_name == "CartService":
        return {
            "routes": ["/cart", "/cart/items", "/cart/items/{id}"],
            "models": ["Product"],
            "capabilities": ["get_cart", "add_to_cart", "update_cart_item", "remove_cart_item"],
        }

    if service_name == "CheckoutService":
        return {
            "routes": ["/checkout", "/checkout/summary"],
            "models": ["Order", "PaymentConfig", "Address"],
            "capabilities": ["start_checkout", "validate_checkout", "create_order_summary"],
        }

    if service_name == "PaymentService":
        return {
            "routes": ["/payments/initiate", "/payments/verify", "/payments/webhook"],
            "models": ["PaymentConfig", "Order"],
            "integrations": integrations,
            "capabilities": ["initiate_payment", "verify_payment", "handle_webhook"],
        }

    if service_name == "OrderService":
        return {
            "routes": ["/orders", "/orders/{id}"],
            "models": ["Order"],
            "capabilities": ["list_orders", "get_order", "update_order_status"],
        }

    if service_name == "InventoryService":
        return {
            "routes": ["/inventory", "/inventory/{product_id}"],
            "models": ["Inventory", "Product"],
            "capabilities": ["get_inventory", "update_inventory", "low_stock_alerts"],
        }

    if service_name == "AdminService":
        return {
            "routes": [
                "/admin/products",
                "/admin/orders",
                "/admin/users",
                "/admin/inventory",
                "/admin/offers",
            ],
            "models": ["Product", "Order", "User", "Inventory", "Offer"],
            "features": admin_features,
            "capabilities": ["admin_dashboard", "crud_management", "status_updates"],
        }

    return {
        "routes": [],
        "models": [],
        "capabilities": [],
    }


def _build_services_config(
    services_list: List[str],
    integrations: List[str],
    admin_features: List[str],
) -> Dict[str, Any]:
    services_config: Dict[str, Any] = {}

    for service_name in services_list:
        services_config[service_name] = _build_service_config(
            service_name=service_name,
            integrations=integrations,
            admin_features=admin_features,
        )

    return services_config


def _build_api_routes(services_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    route_registry: List[Dict[str, Any]] = []

    method_defaults = {
        "/products": ["GET"],
        "/products/{id}": ["GET"],
        "/categories": ["GET"],
        "/cart": ["GET"],
        "/cart/items": ["GET", "POST"],
        "/cart/items/{id}": ["PATCH", "DELETE"],
        "/checkout": ["POST"],
        "/checkout/summary": ["GET"],
        "/payments/initiate": ["POST"],
        "/payments/verify": ["POST"],
        "/payments/webhook": ["POST"],
        "/orders": ["GET"],
        "/orders/{id}": ["GET", "PATCH"],
        "/inventory": ["GET"],
        "/inventory/{product_id}": ["GET", "PATCH"],
        "/admin/products": ["GET", "POST", "PATCH", "DELETE"],
        "/admin/orders": ["GET", "PATCH"],
        "/admin/users": ["GET", "PATCH"],
        "/admin/inventory": ["GET", "PATCH"],
        "/admin/offers": ["GET", "POST", "PATCH", "DELETE"],
    }

    for service_name, config in services_config.items():
        for route in config.get("routes", []):
            route_registry.append(
                {
                    "path": route,
                    "methods": method_defaults.get(route, ["GET"]),
                    "service": service_name,
                }
            )

    return route_registry


def _build_admin_config(admin_features: List[str], services_list: List[str]) -> Dict[str, Any]:
    enabled = "AdminService" in services_list

    return {
        "enabled": enabled,
        "features": admin_features if enabled else [],
        "default_route": "/admin" if enabled else None,
    }


def build_backend_config(backend_plan: Dict) -> Dict:
    data_models: List[str] = backend_plan.get("data_models", [])
    services_list: List[str] = backend_plan.get("services", [])
    integrations: List[str] = backend_plan.get("integrations", [])
    admin_features: List[str] = backend_plan.get("admin_features", [])

    data_models_config = _build_data_models_config(data_models)
    services_config = _build_services_config(
        services_list=services_list,
        integrations=integrations,
        admin_features=admin_features,
    )
    route_registry = _build_api_routes(services_config)
    admin_config = _build_admin_config(admin_features, services_list)

    return {
        "data_models": data_models_config,
        "services": services_config,
        "routes": route_registry,
        "integrations": integrations,
        "admin": admin_config,
    }