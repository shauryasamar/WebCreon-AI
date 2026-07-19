from typing import Dict, Any, List

from fastapi import FastAPI, Request


def _normalize_methods(methods: List[str] | None) -> List[str]:
    if not methods:
        return ["GET"]
    return [method.upper() for method in methods]


def _route_exists(app: FastAPI, path: str, methods: List[str]) -> bool:
    expected = set(methods)
    for route in app.router.routes:
        route_path = getattr(route, "path", None)
        route_methods = set(getattr(route, "methods", []) or [])
        if route_path == path and expected.issubset(route_methods):
            return True
    return False


def _build_response_payload(
    service_name: str,
    route_config: Dict[str, Any],
    request: Request,
    backend_config: Dict[str, Any],
) -> Dict[str, Any]:
    path = route_config.get("path")
    methods = route_config.get("methods", ["GET"])

    service_config = backend_config.get("services", {}).get(service_name, {})
    integrations = backend_config.get("integrations", [])
    admin_config = backend_config.get("admin", {})

    return {
        "service": service_name,
        "path": path,
        "method": request.method,
        "allowed_methods": methods,
        "message": "Auto-generated endpoint from backend_config",
        "capabilities": service_config.get("capabilities", []),
        "models": service_config.get("models", []),
        "integrations": integrations if service_name == "PaymentService" else [],
        "admin_enabled": admin_config.get("enabled", False),
    }


def _make_handler(
    service_name: str,
    route_config: Dict[str, Any],
    backend_config: Dict[str, Any],
):
    async def handler(request: Request):
        return _build_response_payload(
            service_name=service_name,
            route_config=route_config,
            request=request,
            backend_config=backend_config,
        )

    return handler


def register_backend_routes(app: FastAPI, backend_config: Dict[str, Any]) -> None:
    """
    Backend Runtime Agent:
    Register FastAPI routes dynamically from backend_config["routes"].
    Handlers remain stubs, but expose enough information for testing.
    """
    route_registry: List[Dict[str, Any]] = backend_config.get("routes", [])

    for route_config in route_registry:
        path = route_config.get("path")
        service_name = route_config.get("service", "GeneratedService")
        methods = _normalize_methods(route_config.get("methods"))

        if not path:
            continue

        if _route_exists(app, path, methods):
            continue

        handler = _make_handler(
            service_name=service_name,
            route_config=route_config,
            backend_config=backend_config,
        )

        app.add_api_route(
            path=path,
            endpoint=handler,
            methods=methods,
            tags=[service_name],
            name=f"{service_name}:{path}",
            summary=f"Auto-generated {service_name} endpoint",
        )