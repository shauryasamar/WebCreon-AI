from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from typing import Any, Dict

logger = logging.getLogger(__name__)


class DomainProviderError(Exception):
    """Base exception for external domain edge provider operations."""
    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class DomainProviderInterface(ABC):
    """
    Abstract interface decoupling Webcreon from specific cloud or edge CDN providers
    (e.g., Cloudflare SSL for SaaS, AWS CloudFront, Fastly, or local mock).
    """

    @abstractmethod
    def register_custom_domain(self, domain: str, site_id: str) -> Dict[str, Any]:
        """
        Registers a custom domain with the edge provider.
        Provisions edge routing rules and triggers automated SSL certificate ordering.
        """
        pass

    @abstractmethod
    def remove_custom_domain(self, domain: str) -> Dict[str, Any]:
        """
        Deprovisions custom domain hostname and edge certificates from the edge CDN.
        """
        pass

    @abstractmethod
    def get_domain_routing_status(self, domain: str) -> str:
        """
        Polls the edge routing status for the domain.
        Returns: 'active', 'pending', 'failed', or 'unknown'.
        """
        pass

    @abstractmethod
    def get_ssl_status(self, domain: str) -> str:
        """
        Polls the SSL certificate status for the domain.
        Returns: 'ssl_active', 'ssl_pending', 'ssl_failed', or 'ssl_unknown'.
        """
        pass

    @abstractmethod
    def purge_edge_cache(self, domain: str) -> Dict[str, Any]:
        """
        Purges edge cache for the custom hostname upon publishing or unpublishing.
        """
        pass


class MockDomainProvider(DomainProviderInterface):
    """
    Local development and testing domain provider implementation.
    Simulates instantaneous or deterministic edge deployment and SSL certification.
    """

    def __init__(self):
        self._registered_domains: Dict[str, Dict[str, Any]] = {}

    def register_custom_domain(self, domain: str, site_id: str) -> Dict[str, Any]:
        logger.info(f"[MockDomainProvider] Registering custom domain '{domain}' for site {site_id}")
        record = {
            "domain": domain,
            "site_id": site_id,
            "routing_status": "active",
            "ssl_status": "ssl_active",
            "provider_reference": f"mock_edge_{domain.replace('.', '_')}",
        }
        self._registered_domains[domain] = record
        return {
            "success": True,
            "provider_reference": record["provider_reference"],
            "routing_status": "active",
            "ssl_status": "ssl_active",
        }

    def remove_custom_domain(self, domain: str) -> Dict[str, Any]:
        logger.info(f"[MockDomainProvider] Removing custom domain '{domain}'")
        self._registered_domains.pop(domain, None)
        return {
            "success": True,
            "status": "removed",
        }

    def get_domain_routing_status(self, domain: str) -> str:
        record = self._registered_domains.get(domain)
        if not record:
            # Deterministic default for mock
            return "active"
        return record.get("routing_status", "active")

    def get_ssl_status(self, domain: str) -> str:
        record = self._registered_domains.get(domain)
        if not record:
            return "ssl_active"
        return record.get("ssl_status", "ssl_active")

    def purge_edge_cache(self, domain: str) -> Dict[str, Any]:
        logger.info(f"[MockDomainProvider] Purging edge cache for '{domain}'")
        return {
            "success": True,
            "purged": True,
            "domain": domain,
        }


# Singleton provider instance
_provider_instance: DomainProviderInterface | None = None


def get_domain_provider() -> DomainProviderInterface:
    global _provider_instance
    if _provider_instance is None:
        provider_name = os.getenv("DOMAIN_PROVIDER", "mock").lower()
        if provider_name == "mock":
            _provider_instance = MockDomainProvider()
        else:
            # Extensible for cloud providers, fallback to mock
            logger.info(f"Using mock provider for '{provider_name}'")
            _provider_instance = MockDomainProvider()
    return _provider_instance
