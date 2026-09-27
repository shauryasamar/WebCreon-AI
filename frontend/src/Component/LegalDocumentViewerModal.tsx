import React, { useState } from "react";

export type LegalDocType = "privacy" | "terms" | "refund" | "about";

interface LegalDocumentViewerModalProps {
  isOpen: boolean;
  initialDoc?: LegalDocType;
  onClose: () => void;
}

export const LegalDocumentViewerModal: React.FC<LegalDocumentViewerModalProps> = ({
  isOpen,
  initialDoc = "privacy",
  onClose,
}) => {
  const [activeDoc, setActiveDoc] = useState<LegalDocType>(initialDoc);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + "#" + activeDoc);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "920px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fafbfd",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  WebCreon Legal & Compliance Center
                </h3>
                <span
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    background: "#ecfdf5",
                    color: "#059669",
                    border: "1px solid #a7f3d0",
                  }}
                >
                  Official Directive
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                WebCreon Technologies Private Limited &bull; Ref: POL-WCRN-PRIV-2026.04
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy link"
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>{copied ? "Copied!" : "Copy Link"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Print document"
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "50%",
                width: "30px",
                height: "30px",
                display: "grid",
                placeItems: "center",
                fontSize: "14px",
                fontWeight: 700,
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* DOCUMENT NAVIGATION TABS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 24px",
            borderBottom: "1px solid #f1f5f9",
            background: "#ffffff",
          }}
        >
          {[
            { id: "privacy", label: "Privacy Policy" },
            { id: "terms", label: "Terms of Service" },
            { id: "refund", label: "Refund & Cancellation" },
            { id: "about", label: "About WebCreon" },
          ].map((tab) => {
            const isActive = activeDoc === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDoc(tab.id as LegalDocType)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: "none",
                  background: isActive ? "#0f172a" : "transparent",
                  color: isActive ? "#ffffff" : "#64748b",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SCROLLABLE DOCUMENT BODY */}
        <div
          style={{
            padding: "24px 32px",
            overflowY: "auto",
            color: "#1e293b",
            fontSize: "13.5px",
            lineHeight: 1.65,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          {activeDoc === "privacy" && <PrivacyPolicyContent />}
          {activeDoc === "terms" && <TermsOfServiceContent />}
          {activeDoc === "refund" && <RefundPolicyContent />}
          {activeDoc === "about" && <AboutWebCreonContent />}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #f1f5f9",
            background: "#fafbfd",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Need statutory assistance? Email{" "}
            <a href="mailto:privacy@webcreon.com" style={{ color: "#2563eb", fontWeight: 600 }}>
              privacy@webcreon.com
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 18px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// FULL PROFESSIONAL PRIVACY POLICY COMPONENT
// ===========================================================================
function PrivacyPolicyContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
          Privacy Policy & Data Governance Directive
        </h1>
        <div style={{ display: "flex", gap: "14px", fontSize: "12px", color: "#64748b", flexWrap: "wrap" }}>
          <span><strong>Effective Date:</strong> September 24, 2026</span>
          <span>&bull;</span>
          <span><strong>Entity:</strong> WebCreon Technologies Private Limited</span>
          <span>&bull;</span>
          <span><strong>Ref:</strong> POL-WCRN-PRIV-2026.04</span>
        </div>
      </div>

      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 18px", fontSize: "13px", color: "#334155" }}>
        <strong>Overview:</strong> This Privacy Policy outlines how WebCreon Technologies Private Limited collects, safeguards, processes, and cryptographically purges personal and enterprise data across our autonomous AI storefront compiler, visual canvas, and commerce infrastructure. We comply with GDPR, CCPA/CPRA, and the Digital Personal Data Protection Act (DPDP), 2023.
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
          1. Data Ingestion & Classification Taxonomy
        </h3>
        <p style={{ margin: "0 0 10px 0" }}>
          We collect and process data across four technical categories depending on whether you interact as a <strong>Store Owner (Merchant)</strong> or <strong>Customer (Buyer)</strong>:
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Authentication & Identity:</strong> Full legal name, email address, salted password hashes, phone numbers, and federated Google OAuth 2.0 PKCE tokens.
          </li>
          <li>
            <strong>Commercial & Financial Records:</strong> Encrypted bank account details (AES-256), IFSC routing codes, PAN/GSTIN identifiers, and tokenized payment identifiers via PCI-DSS Level 1 gateways (Razorpay/Stripe).
          </li>
          <li>
            <strong>Storefront Schemas & Design Tokens:</strong> Visual component block trees, product catalogs, pricing rules, uploaded media assets, and connected DNS domain configurations.
          </li>
          <li>
            <strong>Customer Fulfillment Records:</strong> Delivery addresses, pinned GPS coordinates, order lines, return notes, and customer support communications.
          </li>
        </ul>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
          2. Enterprise Zero-Retention Artificial Intelligence Policy
        </h3>
        <p style={{ margin: "0 0 8px 0" }}>
          WebCreon incorporates generative AI models (Vertex AI, Anthropic, OpenAI) for autonomous layout synthesis and conversational database analytics. We enforce strict contractual safeguards:
        </p>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "12px 16px", color: "#1e40af", fontSize: "13px" }}>
          🔒 <strong>Enterprise Training Exclusion:</strong> Your proprietary store data, inventory catalogs, creative prompts, customer databases, and sales metrics are <strong>NEVER used to train, retrain, or fine-tune public foundation AI models</strong>.
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
          3. Multi-Tenant Logical Isolation & Security Controls
        </h3>
        <p style={{ margin: "0 0 8px 0" }}>
          WebCreon operates a hardened multi-tenant architecture with row-level scope enforcement (`site_id`):
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li><strong>Data at Rest:</strong> AES-256 database volume encryption and column-level encryption for sensitive financial credentials.</li>
          <li><strong>Data in Transit:</strong> Mandatory TLS 1.3 encryption across all public and internal microservice communication.</li>
          <li><strong>Tenant Cookies:</strong> `admin_token` (HTTP-only, SameSite) and tenant-scoped `customer_token_&lt;site&gt;` ensuring zero cross-store session leakage.</li>
        </ul>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
          4. Data Erasure & One-Click Account Termination
        </h3>
        <p style={{ margin: "0 0 8px 0" }}>
          Under GDPR Art. 17 and DPDP Section 12, users can execute complete account deletion directly in their profile settings:
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Merchant Deletion:</strong> Instantly takes storefronts offline (`is_online = false`), releases custom domains from DNS routing, permanently purges bank account records (`TenantBankAccount`), cancels active subscriptions, and destroys staff access.
          </li>
          <li>
            <strong>Customer Deletion:</strong> Permanently deletes saved addresses, active shopping carts, and notifications. For users with past legal invoices, personal identity is cryptographically scrubbed and marked <em>"Deleted Customer"</em> to preserve statutory tax records.
          </li>
          <li>
            <strong>Re-registration Standard:</strong> Re-registering with the same email creates a completely new cryptographic identifier with <strong>0 restored websites and 0 past data</strong>.
          </li>
        </ul>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
          5. Data Protection Officer & Regulatory Contacts
        </h3>
        <p style={{ margin: "0 0 4px 0" }}>
          For inquiries, statutory data subject requests, or data export copies:
        </p>
        <p style={{ margin: 0, color: "#64748b" }}>
          <strong>DPO Email:</strong> <a href="mailto:privacy@webcreon.com" style={{ color: "#2563eb" }}>privacy@webcreon.com</a> | <strong>General Support:</strong> support@webcreon.com<br />
          <strong>Corporate Address:</strong> WebCreon Technologies Private Limited, Maharashtra, India.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// TERMS OF SERVICE COMPONENT
// ===========================================================================
function TermsOfServiceContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
          Terms of Service & Merchant Agreement
        </h1>
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          Effective: September 24, 2026 &bull; WebCreon Technologies Private Limited
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>1. Account Registration & Permitted Use</h3>
        <p style={{ margin: 0 }}>
          Merchants must provide truthful corporate and tax information. Prohibited activities include hosting phishing storefronts, selling illegal or restricted goods, distribution of malware, or attempting to compromise multi-tenant database boundaries.
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>2. Intellectual Property & AI Assets</h3>
        <p style={{ margin: 0 }}>
          Merchants retain 100% full ownership of their uploaded brand assets, product catalogs, and creative copy. WebCreon retains all proprietary rights, source code, visual canvas compilers, and underlying algorithms powering the SaaS engine.
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>3. Subscriptions, Token Quotas & Auto-Renewals</h3>
        <p style={{ margin: 0 }}>
          Paid subscriptions (Starter, Pro) operate on strict 30-day billing intervals. Recurring cycles automatically renew unless cancelled via Billing Settings. AI tokens are allocated per cycle on a FIFO basis and do not roll over past the active billing cycle.
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>4. Service Level & Limitation of Liability</h3>
        <p style={{ margin: 0 }}>
          WebCreon provides services on an enterprise high-availability infrastructure with automated CDN edge routing. WebCreon is not liable for indirect damages, lost profits, third-party gateway downtime, or external logistics disruptions.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// REFUND & CANCELLATION COMPONENT
// ===========================================================================
function RefundPolicyContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
          Refund & Subscription Cancellation Policy
        </h1>
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          Effective: September 24, 2026 &bull; WebCreon Technologies Private Limited
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>1. 7-Day SaaS Subscription Money-Back Guarantee</h3>
        <p style={{ margin: 0 }}>
          If you upgrade to a paid subscription plan (Starter or Pro) and are not completely satisfied, you may request a 100% full refund within <strong>7 calendar days</strong> of the initial purchase date by contacting <a href="mailto:billing@webcreon.com" style={{ color: "#2563eb" }}>billing@webcreon.com</a>.
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>2. Non-Refundable Items</h3>
        <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
          <li>Custom top-level domain registrations purchased through external registrars.</li>
          <li>Ad-hoc consumed one-time AI credit add-ons that have already been expended on canvas synthesis.</li>
        </ul>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>3. Immediate Cancellation & Expiration Policy</h3>
        <p style={{ margin: 0 }}>
          You can cancel your subscription renewal anytime directly in the <strong>Admin &gt; Billing Settings</strong> portal. Upon cancellation or expiry, your workspace transitions directly to the Free tier with all catalog data safely preserved.
        </p>
      </div>

      <div>
        <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>4. Refund Processing Timelines</h3>
        <p style={{ margin: 0 }}>
          Approved refunds are processed back to the original payment source (Credit/Debit Card, UPI, Net Banking) within <strong>5–7 business days</strong> via our banking gateway partners.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// ABOUT WEBCREON COMPONENT
// ===========================================================================
function AboutWebCreonContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        <h1 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
          About WebCreon AI
        </h1>
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          Autonomous Storefront & Website Creation Engine &bull; Version 2.4.0
        </div>
      </div>

      <p style={{ margin: 0 }}>
        <strong>WebCreon</strong> is a next-generation autonomous e-commerce engine designed to bridge artificial intelligence with enterprise-grade storefront engineering.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        <div style={{ padding: "14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>🎨 Visual Design Canvas</div>
          <div style={{ fontSize: "12.5px", color: "#64748b" }}>Real-time generative visual design editor with instant multi-device preview.</div>
        </div>

        <div style={{ padding: "14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>⚡ High-Velocity Commerce</div>
          <div style={{ fontSize: "12.5px", color: "#64748b" }}>Blazing fast checkout, automated tax calculations (GST/TCS), and split disbursements.</div>
        </div>

        <div style={{ padding: "14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>🤖 Co-Pilot Assistant</div>
          <div style={{ fontSize: "12.5px", color: "#64748b" }}>Conversational database analytics, automated SEO generation, and store optimization.</div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", borderRadius: "8px", background: "#f1f5f9", fontSize: "12.5px", color: "#475569" }}>
        <strong>Enterprise Inquiries:</strong> Contact our team at <a href="mailto:support@webcreon.com" style={{ color: "#2563eb", fontWeight: 600 }}>support@webcreon.com</a>.
      </div>
    </div>
  );
}

export default LegalDocumentViewerModal;
