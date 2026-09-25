import React from "react";

export type LegalDocType = "privacy" | "terms" | "refund" | "about" | "contact";

interface AdminLegalFullViewProps {
  initialDoc?: LegalDocType;
  onBack: () => void;
}

export const AdminLegalFullView: React.FC<AdminLegalFullViewProps> = ({
  initialDoc = "privacy",
  onBack,
}) => {
  return (
    <div
      style={{
        width: "100%",
        color: "#0f172a",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Top Single Navigation Button */}
      <div
        style={{
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            color: "#334155",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f8fafc";
            e.currentTarget.style.borderColor = "#cbd5e1";
            e.currentTarget.style.color = "#0f172a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.color = "#334155";
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to Help & Support</span>
        </button>
      </div>

      {/* Main Document Content Container */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "32px 36px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          color: "#1e293b",
          fontSize: "14px",
          lineHeight: 1.7,
        }}
      >
        {initialDoc === "privacy" && <PrivacyPolicyDocument />}
        {initialDoc === "terms" && <TermsOfServiceDocument />}
        {initialDoc === "refund" && <RefundPolicyDocument />}
        {initialDoc === "about" && <AboutWebCreonDocument />}
        {initialDoc === "contact" && <ContactUsDocument />}
      </div>
    </div>
  );
};

// ===========================================================================
// PRIVACY POLICY (RAZORPAY & DPDP / GDPR COMPLIANT)
// ===========================================================================
function PrivacyPolicyDocument() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "18px" }}>
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "22px",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Effective Date: September 25, 2026 &bull; WebCreon Technologies Private Limited
        </p>
      </div>

      {/* Overview */}
      <div>
        <p style={{ margin: 0 }}>
          WebCreon Technologies Private Limited (&ldquo;WebCreon&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the WebCreon AI Autonomous Website Builder, e-commerce storefront infrastructure, payment routing, and customer management platform. This Privacy Policy sets out how we collect, store, process, protect, and delete information across merchant workspaces, custom storefront domains, and customer checkout sessions.
        </p>
      </div>

      {/* 1. Information Ingestion */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          1. Information We Collect & Process
        </h2>
        <p style={{ margin: "0 0 8px 0" }}>
          We collect only data necessary to operate storefronts, process payments, and ensure platform security:
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Merchant (Admin) Credentials:</strong> Full name, business email, phone number, gender, avatar, encrypted password hash (bcrypt/Argon2), role permissions, and OAuth profile tokens when logging in via Google.
          </li>
          <li>
            <strong>Staff & Team Invitations:</strong> Team member emails, assigned permission scopes (product management, orders, billing, domain routing), and invitation tokens.
          </li>
          <li>
            <strong>Merchant Banking & Tax Identifiers:</strong> Bank account numbers, IFSC codes, account holder names, PAN, and GSTIN identifiers. These are stored with AES-256 field-level encryption for payout settlements.
          </li>
          <li>
            <strong>Storefront Content & Schemas:</strong> JSON visual layout definitions, custom domains (CNAME/A records), product catalogs, pricing tiers, discounts, coupons, inventory counts, and uploaded media assets.
          </li>
          <li>
            <strong>Customer Orders & Delivery Details:</strong> Customer name, email, phone number, delivery addresses, pinned GPS coordinates, order items, invoice totals, payment identifiers, return requests, and support communications.
          </li>
          <li>
            <strong>Technical & Session Data:</strong> IP address, browser user-agent, session timestamps, and encrypted <code>httpOnly</code> authentication cookies.
          </li>
        </ul>
      </div>

      {/* 2. AI Zero-Retention Policy */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          2. Artificial Intelligence & Data Protection Safeguards
        </h2>
        <p style={{ margin: "0 0 8px 0" }}>
          WebCreon incorporates generative AI models for webpage generation, layout design, copywriting, and Co-Pilot conversational assistance. We enforce strict enterprise privacy standards:
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Zero Public Model Training:</strong> Your store catalogs, private customer records, sales numbers, and layout prompts are never used to train, retrain, or improve public AI models (such as Google Vertex AI, Anthropic, or OpenAI).
          </li>
          <li>
            <strong>Ephemeral Processing:</strong> AI prompts and design requests are processed in memory during the generation request and discarded immediately after response delivery.
          </li>
          <li>
            <strong>FIFO Credit Batch Isolation:</strong> AI credits are managed through isolated quota batches per subscription and are never shared across tenants.
          </li>
        </ul>
      </div>

      {/* 3. Multi-Tenant Isolation & Security */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          3. Multi-Tenant Architecture & Data Security
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Row-Level Tenant Isolation:</strong> Every database query is strictly scoped to the store&rsquo;s unique <code>site_id</code>. Merchants cannot view or access another merchant&rsquo;s data, sales, or customer records.
          </li>
          <li>
            <strong>Cookie & Token Partitioning:</strong> Customer session cookies are isolated per storefront (<code>customer_token_&#123;website_name&#125;</code>) to prevent session overlap across different stores.
          </li>
          <li>
            <strong>Data in Transit & Rest:</strong> Mandatory TLS 1.3 encryption across all public endpoints, custom domains, and internal microservices. Sensitive database fields are encrypted with AES-256.
          </li>
          <li>
            <strong>24-Hour Bank Edit Quarantine:</strong> To protect merchants against unauthorized account takeover, editing bank payout details automatically imposes a 24-hour payout hold.
          </li>
        </ul>
      </div>

      {/* 4. Payment Processing (PCI-DSS & Razorpay Compliance) */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          4. Payment Processing & Financial Security
        </h2>
        <p style={{ margin: 0 }}>
          All online financial transactions are processed securely through PCI-DSS Level 1 certified payment aggregators (<strong>Razorpay</strong>). <strong>WebCreon never captures, stores, or processes raw credit/debit card numbers, CVVs, or net banking passwords</strong> on its servers. Payment credentials are encrypted directly between the buyer&rsquo;s browser and the payment gateway. Payment webhook notifications received from aggregators are cryptographically validated using HMAC SHA-256 signatures prior to order status confirmation.
        </p>
      </div>

      {/* 5. Account Deletion & Right to Erasure */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          5. Account Deletion & Right to Erasure
        </h2>
        <p style={{ margin: "0 0 8px 0" }}>
          WebCreon provides direct self-service account deletion for both store merchants and store customers:
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Store Merchant Account Deletion:</strong>
            <ul style={{ marginTop: "4px", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li><strong>Anti-Fraud Order Clearance Requirement:</strong> Deletion is strictly blocked if any owned store has open, unfulfilled orders or pending return requests. Merchants must fulfill, deliver, cancel, or refund all pending customer orders prior to deleting their account.</li>
              <li>Only the workspace Owner can delete the merchant account (invited staff members are restricted).</li>
              <li>Immediately unpublishes all owned websites (sets <code>is_online = false</code>).</li>
              <li>Releases custom domain routing bindings from DNS gateways.</li>
              <li>Purges sensitive bank account credentials and tax IDs from storage.</li>
              <li>Cancels active recurring subscriptions and expires unused AI credit allocations.</li>
              <li>Unlinks staff permissions, wipes store email credentials, and destroys session cookies.</li>
            </ul>
          </li>
          <li>
            <strong>Store Customer Account Deletion:</strong>
            <ul style={{ marginTop: "4px", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>Permanently deletes saved delivery addresses, pinned GPS coordinates, shopping carts, and in-app notifications.</li>
              <li>If the customer has prior completed orders, the profile is permanently anonymized to <em>&ldquo;Deleted Customer&rdquo;</em> with a scrambled hash email to maintain required statutory financial ledgers without retaining personal identity.</li>
            </ul>
          </li>
          <li>
            <strong>Clean Re-Registration:</strong> Creating a new account with the same email in the future generates a completely new UUID with <strong>zero previous websites, products, or records restored</strong>.
          </li>
        </ul>
      </div>

      {/* 6. Statutory Record Retention */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          6. Statutory Tax & Compliance Retention
        </h2>
        <p style={{ margin: 0 }}>
          Under applicable commercial, GST, and tax regulations (such as Section 194-O of the Income Tax Act), financial ledger entries, tax invoices, and transaction totals are maintained for the statutory minimum audit period (up to 7 years) in an anonymized or secured ledger.
        </p>
      </div>

      {/* 7. Grievance Officer & Contact Information */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "18px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>
          7. Grievance Officer & Contact Details
        </h2>
        <p style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#475569" }}>
          In accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023, the details of the Grievance Officer are provided below:
        </p>
        <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.6 }}>
          <strong>Name:</strong> Grievance Redressal Officer<br />
          <strong>Company:</strong> WebCreon Technologies Private Limited<br />
          <strong>Email:</strong> <a href="mailto:grievance@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>grievance@webcreon.com</a> | <a href="mailto:privacy@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>privacy@webcreon.com</a><br />
          <strong>Corporate Address:</strong> WebCreon Technologies Private Limited, Mumbai, Maharashtra 400001, India.
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TERMS OF SERVICE (100% AUDITED SAAS & COMMERCE DIRECTIVE)
// ===========================================================================
function TermsOfServiceDocument() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "18px" }}>
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "22px",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Terms of Service & Merchant Agreement
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Effective Date: September 25, 2026 &bull; WebCreon Technologies Private Limited
        </p>
      </div>

      <div>
        <p style={{ margin: 0 }}>
          These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you (&ldquo;Merchant&rdquo;, &ldquo;User&rdquo;, or &ldquo;You&rdquo;) and WebCreon Technologies Private Limited (&ldquo;WebCreon&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). These Terms govern your access to and use of WebCreon&rsquo;s autonomous website builder, visual design canvas, generative AI tools, cloud storefront hosting, and merchant management infrastructure. By creating an account, subscribing to a plan, or publishing a website on WebCreon, you agree to comply with and be bound by these Terms.
        </p>
      </div>

      {/* 1. Account Governance & Workspace Roles */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          1. Account Governance & Workspace Roles
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Eligibility:</strong> You must be at least 18 years of age or an authorized representative of a legally registered business entity to create an account and operate a storefront on WebCreon.
          </li>
          <li>
            <strong>Workspace Owner Authority:</strong> The primary merchant account that creates a store is designated as the workspace <strong>Owner</strong>. The Owner possesses exclusive authority over billing subscriptions, payout bank accounts, custom domain routing, and account termination.
          </li>
          <li>
            <strong>Invited Staff Members:</strong> Workspace Owners may invite staff members and assign specific role-based permissions (e.g., product catalog editing, order fulfillment, delivery tracking). Invited staff accounts are prohibited from deleting the merchant workspace, altering primary banking credentials, or transferring ownership.
          </li>
          <li>
            <strong>Credential Security:</strong> You are responsible for maintaining the confidentiality of your login credentials and for all activities conducted under your workspace. You must notify us immediately of any unauthorized access.
          </li>
        </ul>
      </div>

      {/* 2. Acceptable Use Policy */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          2. Acceptable Use & Storefront Commerce Policy
        </h2>
        <p style={{ margin: "0 0 8px 0" }}>Merchants must not use WebCreon to:</p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>Sell illegal, prohibited, counterfeit, fraudulent, or hazardous products or services.</li>
          <li>Host deceptive content, phishing web pages, ransomware, or malicious scripts.</li>
          <li>Attempt unauthorized access across multi-tenant database boundaries or compromise platform infrastructure.</li>
          <li>Reverse-engineer, decompile, or copy WebCreon&rsquo;s proprietary visual canvas compilers, layout algorithms, or source code.</li>
          <li>Transmit unsolicited spam or violate trademark, copyright, or privacy rights of any third party.</li>
        </ul>
      </div>

      {/* 3. Intellectual Property Ownership */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          3. Intellectual Property Allocation
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Merchant Content:</strong> You retain 100% full intellectual property ownership of your brand name, trademarks, logos, product catalogs, product photography, and custom copy uploaded to WebCreon.
          </li>
          <li>
            <strong>WebCreon Technology:</strong> WebCreon retains all proprietary rights, copyright, and trade secrets in the platform software, visual design editor, database architectures, layout compilers, and generative AI engines.
          </li>
        </ul>
      </div>

      {/* 4. Autonomous AI & Co-Pilot Terms */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          4. Autonomous AI & Co-Pilot Terms
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Generation & Verification:</strong> AI generation tools (including webpage layout generation, product description auto-writing, and Co-Pilot conversational assistance) are provided as creative aids. Merchants are solely responsible for reviewing, editing, and verifying all AI-generated text, pricing, and visual layouts before publishing them live to consumers.
          </li>
          <li>
            <strong>Zero Training Protection:</strong> Under enterprise agreements with our AI infrastructure partners, your proprietary store data, sales numbers, customer records, and private prompts are never used to train or fine-tune public foundation AI models.
          </li>
          <li>
            <strong>AI Credits Quota:</strong> AI tokens are allocated based on your subscription plan tier. Unused AI credits expire upon subscription plan cancellation and are non-refundable.
          </li>
        </ul>
      </div>

      {/* 5. Merchant E-Commerce Obligations (Seller of Record) */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          5. Merchant E-Commerce Operations & Seller Responsibility
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Seller of Record:</strong> Each merchant operates an independent business. <strong>WebCreon provides the hosting software and tools, but is not the seller of your goods</strong>. The contract for sale of goods is strictly between you and your customer.
          </li>
          <li>
            <strong>Fulfillment, Shipping & Returns:</strong> You are solely responsible for inventory accuracy, packaging, order delivery fulfillment (via self-delivery agents or third-party carriers like Shiprocket), and resolving customer return requests, replacements, and refund claims.
          </li>
          <li>
            <strong>Shipping Charges & Carrier Logistics:</strong> When utilizing integrated delivery carriers (such as Shiprocket) or in-house couriers, merchants determine the shipping charges collected from buyers. Courier freight charges incurred with carriers are non-refundable once orders are dispatched, and merchants retain sole discretion on whether original shipping fees are refunded to customers upon return.
          </li>
          <li>
            <strong>Tax & GST Compliance:</strong> You are responsible for configuring accurate GST rates, issuing compliant tax invoices to your customers, and remitting applicable indirect taxes to government authorities.
          </li>
        </ul>
      </div>

      {/* 6. Subscriptions, Pricing, Platform Fees & Statutory Taxes */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          6. Subscriptions, Platform Fees, AI Credits &amp; Statutory Taxes
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li>
            <strong>Transparent Subscription Tiers:</strong>
            <ul style={{ marginTop: "4px", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li><strong>Free Plan:</strong> &#8377;0/month &bull; Up to 200 catalog products (shared pool), WebCreon subdomain, 300 AI credits/mo, 1 staff account.</li>
              <li><strong>Starter Plan:</strong> &#8377;199/month (&#8377;549 / 3 months, &#8377;1,999 / year) &bull; Up to 1,000 dedicated products, custom domain connection with free automated SSL, 1,000 AI credits/mo.</li>
              <li><strong>Growth Pro Plan:</strong> &#8377;499/month (&#8377;1,299 / 3 months, &#8377;4,999 / year) &bull; Unlimited products, custom domain + SSL, up to 10 multi-user staff roles, 2,000 AI credits/mo, priority CDN, zero platform watermark.</li>
            </ul>
          </li>
          <li>
            <strong>Instant Digital Delivery:</strong> All paid subscription plans and AI credit top-ups are activated digitally in real time (within 0–5 minutes) upon Razorpay payment confirmation.
          </li>
          <li>
            <strong>AI Credits Top-Up Packs:</strong> Additional AI generation credits can be acquired at the rate of &#8377;1 per 100 AI credits. All credit packs operate in dedicated 30-day validity batches.
          </li>
          <li>
            <strong>Platform E-Commerce Facilitation Fee:</strong> For processing online storefront transactions and automated escrow settlements, WebCreon deducts a standard platform facilitation service fee (3.00% base + 18% GST under SAC 998313). Official GST tax invoices for platform service fees are issued to merchants.
          </li>
          <li>
            <strong>Statutory Tax Withholding (Section 194-O TDS):</strong> As an Electronic Commerce Operator under the Indian Income Tax Act, 1961, WebCreon deducts applicable statutory Tax Deducted at Source (Section 194-O TDS at 0.1% or prevailing statutory rate) against the merchant&rsquo;s PAN and deposits it with the Government treasury.
          </li>
          <li>
            <strong>Automatic Renewals:</strong> Subscriptions renew automatically at the end of each billing cycle (monthly, quarterly, or annual) unless cancelled by the merchant prior to the renewal date via Billing Settings.
          </li>
        </ul>
      </div>

      {/* 7. Account Termination & Anti-Fraud Order Clearance */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          7. Account Termination & Anti-Fraud Order Clearance
        </h2>
        <p style={{ margin: "0 0 8px 0" }}>
          Merchants may terminate their account at any time via Profile Settings, subject to fulfillment obligations:
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Open Order Prohibition:</strong> You cannot delete your merchant account if you have open, processing, or undelivered customer orders, or pending return requests. You must fulfill, deliver, cancel, or refund all pending orders before account closure.
          </li>
          <li>
            <strong>Staff Restriction:</strong> Only the workspace Owner can initiate account closure. Invited team members cannot close or delete the workspace.
          </li>
          <li>
            <strong>Immediate Unpublishing:</strong> Deleting an account immediately takes all owned storefronts offline, unlinks team permissions, purges bank credentials, and releases custom domains.
          </li>
        </ul>
      </div>

      {/* 8. Limitation of Liability & Indemnification */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          8. Limitation of Liability & Indemnification
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>&ldquo;As-Is&rdquo; Warranty Disclaimer:</strong> Services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. WebCreon disclaims all warranties, express or implied, regarding uninterrupted uptime, third-party gateway availability, or internet routing failures.
          </li>
          <li>
            <strong>Liability Cap:</strong> To the maximum extent permitted by applicable law, WebCreon&rsquo;s total aggregate liability for all claims arising out of or relating to these Terms shall not exceed the total fees paid by you to WebCreon in the <strong>twelve (12) months</strong> preceding the event giving rise to the claim.
          </li>
          <li>
            <strong>Indemnification:</strong> You agree to defend, indemnify, and hold harmless WebCreon, its directors, employees, and agents from any third-party claims, damages, liabilities, or expenses arising from your storefront products, breach of these Terms, or violation of applicable laws.
          </li>
        </ul>
      </div>

      {/* 9. Governing Law & Dispute Resolution */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          9. Governing Law & Dispute Resolution
        </h2>
        <p style={{ margin: 0 }}>
          These Terms and any dispute or claim arising out of or in connection with them shall be governed by and construed in accordance with the laws of India. Any legal actions or proceedings shall be subject to the exclusive jurisdiction of the competent courts located in <strong>Mumbai, Maharashtra, India</strong>.
        </p>
      </div>

      {/* 10. Legal Contact */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "18px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px 0" }}>
          10. Legal & Support Contacts
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          For inquiries regarding these Terms, contact{" "}
          <a href="mailto:legal@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
            legal@webcreon.com
          </a>{" "}
          or write to WebCreon Technologies Private Limited, Mumbai, Maharashtra 400001, India.
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// REFUND, CANCELLATION & SETTLEMENT POLICY (100% AUDITED DUAL-TIER DIRECTIVE)
// ===========================================================================
function RefundPolicyDocument() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "18px" }}>
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "22px",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Refund, Cancellation & Settlement Policy
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Effective Date: September 25, 2026 &bull; WebCreon Technologies Private Limited
        </p>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* PART A: WEBCREON SAAS SUBSCRIPTIONS & PLATFORM SERVICES             */}
      {/* ------------------------------------------------------------------- */}
      <div style={{ borderBottom: "2px solid #f1f5f9", paddingBottom: "20px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: "6px",
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "12px",
          }}
        >
          Part A: WebCreon Platform Subscriptions (WebCreon &rarr; Merchant)
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              1. Digital Service Fulfillment & Delivery Policy
            </h2>
            <p style={{ margin: 0 }}>
              WebCreon is a Cloud SaaS (Software-as-a-Service) platform. <strong>No physical goods are shipped by WebCreon for software subscriptions</strong>. Upon successful payment verification via Razorpay, your subscription tier, hosting infrastructure, and AI generation credits are provisioned and activated <strong>instantly (within 0–5 minutes)</strong> into your merchant account. A digital invoice and confirmation email are dispatched immediately to your registered email address.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              2. 7-Day Money-Back Guarantee for Plan Upgrades
            </h2>
            <p style={{ margin: 0 }}>
              We provide a <strong>7-day money-back guarantee</strong> on all first-time paid subscription plan upgrades (Starter, Pro, and Enterprise). If you are not satisfied with WebCreon for any reason, you may request a 100% refund of your subscription fee within <strong>7 calendar days</strong> of the initial upgrade.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              3. Platform Non-Refundable Items & Exceptions
            </h2>
            <p style={{ margin: "0 0 6px 0" }}>The following platform purchases are strictly non-refundable:</p>
            <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <li><strong>Custom Domain Registrations:</strong> Top-level domain registrations (e.g., .com, .in, .store) are registered with third-party domain registries immediately upon request and are non-reversible.</li>
              <li><strong>Consumed AI Generation Credits:</strong> One-time AI credit packs that have already been utilized for layout compilation, product description generation, or Co-Pilot conversational assistance cannot be refunded.</li>
              <li><strong>Subscription Renewals Outside the 7-Day Window:</strong> Monthly or annual recurring renewals requested after the initial 7-day guarantee window.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              4. Subscription Refund Turnaround & Method
            </h2>
            <p style={{ margin: 0 }}>
              Approved subscription refunds are credited back to the merchant&rsquo;s original payment method (Credit/Debit Card, UPI, Net Banking) via Razorpay within <strong>5 to 7 business days</strong>.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              5. How to Request a Platform Subscription Refund
            </h2>
            <p style={{ margin: 0 }}>
              To initiate a refund request, raise a support ticket under the <strong>&ldquo;Billing &amp; Plans&rdquo;</strong> category in your Help &amp; Support dashboard, or email{" "}
              <a href="mailto:billing@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
                billing@webcreon.com
              </a>{" "}
              from your registered admin email with your workspace name and invoice reference number.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* PART B: STOREFRONT E-COMMERCE & SETTLEMENTS (MERCHANT TO CUSTOMER)  */}
      {/* ------------------------------------------------------------------- */}
      <div>
        <div
          style={{
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: "6px",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "12px",
          }}
        >
          Part B: Storefront Orders, Returns &amp; Settlement Directives (Merchant &rarr; Customer)
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              6. Storefront Return Windows &amp; Inspection
            </h2>
            <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <li>
                <strong>Configurable Return Windows:</strong> Each merchant defines their store&rsquo;s return policy window (default is 7 days from verified order delivery). Customers can submit return requests directly from their customer order history within this active window.
              </li>
              <li>
                <strong>Condition Inspection &amp; Stock Replenishment:</strong> Refunds or replacements are approved after physical inspection by delivery agents or merchant staff. Approved returned items automatically replenish store inventory stock.
              </li>
              <li>
                <strong>Prorated Line Item Refunds:</strong> For multi-item orders, WebCreon automatically computes the exact prorated refundable line total, accounting for promotional coupon discounts applied during checkout.
              </li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              7. Settlement Finality &amp; Post-Return Window Merchant Liability
            </h2>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 18px", color: "#334155" }}>
              <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>
                Post-Settlement Responsibility Rule:
              </p>
              <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.6 }}>
                Once an order&rsquo;s return window has expired and net sales proceeds are settled to the merchant&rsquo;s bank account (<code>TenantBankAccount</code>), the settlement is <strong>final on the WebCreon platform</strong>. Any subsequent dispute, out-of-policy return, or manual refund requested by a customer after the settlement has been disbursed must be <strong>funded and handled directly by the merchant themselves</strong>. WebCreon will not claw back or reverse settled bank disbursements for expired return claims.
              </p>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              8. Payment Gateway Processing Fees (Non-Refundable MDR)
            </h2>
            <p style={{ margin: 0 }}>
              Payment gateway processing fees (Razorpay MDR charges of ~2% + 18% GST) and technical platform processing fees deducted by banking aggregators at the time of online transaction are <strong>non-refundable by banking networks</strong>. When a merchant issues an order refund to a customer, the banking gateway processing fees incurred during initial payment capture cannot be refunded.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              9. Statutory GST Rule 54 Tax Credit Notes
            </h2>
            <p style={{ margin: 0 }}>
              When a merchant approves an order return or refund on WebCreon, the platform automatically generates an official <strong>GST Rule 54 compliant Tax Credit Note PDF</strong> (<code>TaxCreditNote</code>). This document records the reduction in taxable value, CGST/SGST/IGST breakdown, and adjusts the merchant&rsquo;s monthly tax liability in accordance with statutory requirements under the Central Goods and Services Tax Act.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              10. Shiprocket &amp; Third-Party Shipping Logistics &amp; Fee Policy
            </h2>
            <p style={{ margin: "0 0 8px 0" }}>
              When a merchant utilizes <strong>Shiprocket</strong> or other integrated courier partners for parcel delivery, the following financial and operational rules apply:
            </p>
            <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <li>
                <strong>Merchant Freight Liability:</strong> The merchant is directly responsible for bearing and paying all shipment, freight, and courier charges billed by Shiprocket or third-party logistics carriers for generating shipping labels, parcel pickups, and delivery transit.
              </li>
              <li>
                <strong>Collecting Shipping Fees from Buyers:</strong> The merchant may charge and collect delivery/shipping fees from the end-customer (buyer) at storefront checkout.
              </li>
              <li>
                <strong>Merchant Discretion on Shipping Fee Refunds:</strong> Because logistics carriers charge non-refundable freight for completed or attempted transits, courier freight costs are consumed once an order is dispatched. <strong>It is entirely at the merchant&rsquo;s sole discretion whether to refund the shipping fee to the customer or deduct it from the customer&rsquo;s refund total</strong> upon an order return or cancellation.
              </li>
              <li>
                <strong>Reverse Pickup &amp; Return Freight:</strong> The merchant&rsquo;s published store policy governs whether return pickup courier charges are deducted from the customer&rsquo;s refund payout or absorbed as a cost of business by the merchant. WebCreon does not fund or reimburse logistics carrier costs.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// ABOUT WEBCREON & CONTACT US (RAZORPAY COMPLIANT)
// ===========================================================================
function AboutWebCreonDocument() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "18px" }}>
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "22px",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          About WebCreon &amp; Corporate Information
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Autonomous Website &amp; E-Commerce Creation Platform &bull; WebCreon Technologies Private Limited
        </p>
      </div>

      {/* 1. Mission & Vision */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          1. Our Mission &amp; Vision
        </h2>
        <p style={{ margin: "0 0 8px 0" }}>
          <strong>WebCreon</strong> is an autonomous e-commerce engine and visual website creation platform developed by <strong>WebCreon Technologies Private Limited</strong>. Our mission is to democratize online retail by empowering entrepreneurs, brands, and local businesses to design, publish, and scale modern online storefronts with visual precision and generative AI assistance—without requiring coding skills or expensive developer agencies.
        </p>
        <p style={{ margin: 0 }}>
          We replace weeks of fragmented setup with instant generative AI workflows, an interactive visual canvas, native Indian payment rails, automated logistics, and statutory tax compliance out of the box.
        </p>
      </div>

      {/* 2. Who We Cater To */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          2. Who We Cater To (Target Customer Segments)
        </h2>
        <p style={{ margin: "0 0 10px 0" }}>
          WebCreon is purpose-built to serve a diverse spectrum of modern commerce creators:
        </p>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li>
            <strong>Direct-to-Consumer (D2C) Brands &amp; E-Commerce Startups:</strong> Modern apparel, lifestyle, beauty, footwear, and consumer goods brands seeking conversion-optimized online storefronts with custom domain branding and sub-second page loads.
          </li>
          <li>
            <strong>Offline Retailers &amp; Local Indian Businesses:</strong> Brick-and-mortar store owners, distributors, and manufacturers looking to digitize their catalog, accept online UPI/Card payments, and fulfill pan-India orders with automated GST Rule 54 tax invoicing.
          </li>
          <li>
            <strong>Solo Entrepreneurs, Artisans &amp; Independent Creators:</strong> Boutique makers and innovators launching their first online venture with instant AI copywriting, layout generation, and accessible free/starter plans.
          </li>
          <li>
            <strong>Digital Agencies, Web Designers &amp; Freelancers:</strong> Creative studios building and managing high-performance e-commerce stores for clients using multi-user staff roles, custom domains, and visual canvas tools.
          </li>
        </ul>
      </div>

      {/* 3. Core Architectural Capabilities */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          3. Core Architectural Capabilities
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li>
            <strong>Autonomous AI Co-Pilot &amp; Generation:</strong> Generates full storefront pages, hero banners, product descriptions, and SEO meta tags from natural language prompts in seconds with zero prompt engineering required.
          </li>
          <li>
            <strong>Interactive Visual Canvas:</strong> Real-time component layout editor with multi-viewport live preview (Desktop, Tablet, Mobile) and instant sub-second rendering.
          </li>
          <li>
            <strong>Integrated Indian Payment Rails:</strong> Native integration with <strong>Razorpay</strong> (UPI, QR, Credit/Debit Cards, Net Banking) alongside Cash on Delivery (COD) management.
          </li>
          <li>
            <strong>Automated Shipping Logistics:</strong> Native fulfillment orchestration with <strong>Shiprocket</strong> and courier partners for label generation, pickup scheduling, and live tracking.
          </li>
          <li>
            <strong>Statutory GST &amp; Tax Compliance:</strong> Automated generation of GST Rule 54 compliant Tax Invoices and Credit Notes with statutory CGST, SGST, IGST, and Section 194-O TDS computations.
          </li>
          <li>
            <strong>Custom Domains with Automated SSL:</strong> Instant custom domain mapping (<code>shop.yourbrand.com</code>) with free automated SSL certificate provisioning.
          </li>
        </ul>
      </div>

      {/* 4. Trust & Security Standards */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          4. Security, Trust &amp; Privacy Guarantees
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li>
            <strong>Zero Training Protection:</strong> Your private store sales, customer lists, and proprietary prompts are never used to train or fine-tune public foundation AI models.
          </li>
          <li>
            <strong>PCI-DSS Gateway Compliance:</strong> All card transactions are processed through certified Level 1 PCI-DSS gateways (Razorpay); WebCreon never captures or stores raw card credentials.
          </li>
          <li>
            <strong>Data Sovereignty &amp; Encryption:</strong> Row-level multi-tenant database isolation, AES-256 bank credential encryption, and full compliance with the <em>Digital Personal Data Protection (DPDP) Act, 2023</em>.
          </li>
        </ul>
      </div>

      {/* 5. Corporate & Contact Matrix */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "18px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          5. Corporate Contact &amp; Registered Entity Details
        </h2>
        <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.8 }}>
          <div><strong>Legal Entity Name:</strong> WebCreon Technologies Private Limited</div>
          <div><strong>Nature of Business:</strong> Cloud Software-as-a-Service (SaaS) &amp; Autonomous E-Commerce Technology</div>
          <div><strong>Operational &amp; Registered Office:</strong> WebCreon Technologies Private Limited, Mumbai, Maharashtra 400001, India</div>
          <div><strong>General &amp; Technical Support:</strong> <a href="mailto:support@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>support@webcreon.com</a></div>
          <div><strong>Billing &amp; Invoices:</strong> <a href="mailto:billing@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>billing@webcreon.com</a></div>
          <div><strong>Privacy &amp; Grievances:</strong> <a href="mailto:privacy@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>privacy@webcreon.com</a> | <a href="mailto:grievance@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>grievance@webcreon.com</a></div>
          <div><strong>Operating Hours &amp; SLA:</strong> Monday to Saturday, 9:00 AM – 7:00 PM IST (First response SLA within 24 business hours)</div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// CONTACT US & STATUTORY HELPDESK (RAZORPAY & DPDP COMPLIANT)
// ===========================================================================
function ContactUsDocument() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "18px" }}>
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: "22px",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Contact Us &amp; Support Matrix
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Official Communication Channels &bull; WebCreon Technologies Private Limited
        </p>
      </div>

      <div>
        <p style={{ margin: 0 }}>
          At WebCreon, we are committed to providing reliable, timely, and transparent support for all our merchants, partners, and customers. Whether you require technical assistance with your storefront, have inquiries regarding subscription billing, or need to reach our statutory compliance desk, our dedicated teams are ready to help.
        </p>
      </div>

      {/* 1. Official Corporate & Registered Office */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          1. Corporate Entity &amp; Physical Office
        </h2>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px 20px", fontSize: "13.5px", color: "#334155", lineHeight: 1.8 }}>
          <div><strong>Legal Entity Name:</strong> WebCreon Technologies Private Limited</div>
          <div><strong>Nature of Business:</strong> Autonomous E-Commerce Platform &amp; Cloud Website Builder (SaaS)</div>
          <div><strong>Registered &amp; Operational Address:</strong> WebCreon Technologies Private Limited, Mumbai, Maharashtra 400001, India</div>
          <div><strong>Jurisdiction:</strong> Mumbai, Maharashtra, India</div>
        </div>
      </div>

      {/* 2. Specialized Support Channels */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          2. Specialized Communication Desks
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <li>
            <strong>General &amp; Technical Support:</strong> For assistance with store layout design, custom domain setup, product catalog imports, or AI Co-Pilot generation.<br />
            Email: <a href="mailto:support@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>support@webcreon.com</a>
          </li>
          <li>
            <strong>Billing, Invoicing &amp; Subscriptions:</strong> For questions regarding plan upgrades, renewal cycles, Razorpay invoice receipts, or refund requests under our 7-day money-back guarantee.<br />
            Email: <a href="mailto:billing@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>billing@webcreon.com</a>
          </li>
          <li>
            <strong>Legal, Compliance &amp; Terms:</strong> For corporate governance, merchant agreements, or regulatory compliance inquiries.<br />
            Email: <a href="mailto:legal@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>legal@webcreon.com</a>
          </li>
          <li>
            <strong>Data Privacy &amp; Statutory Grievance Redressal:</strong> In compliance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.<br />
            Email: <a href="mailto:grievance@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>grievance@webcreon.com</a> | <a href="mailto:privacy@webcreon.com" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>privacy@webcreon.com</a>
          </li>
        </ul>
      </div>

      {/* 3. Business Hours & SLA */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          3. Operating Hours &amp; Response Service Level Agreement (SLA)
        </h2>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <li><strong>Operating Hours:</strong> Monday to Saturday, 9:00 AM – 7:00 PM IST (Closed on Sundays and National Gazetted Holidays).</li>
          <li><strong>First-Response SLA:</strong> All inbound support tickets and email inquiries receive an initial acknowledgment and review within <strong>24 business hours</strong>.</li>
          <li><strong>Resolution Commitment:</strong> Standard technical and billing tickets are resolved within 2 to 3 business days.</li>
        </ul>
      </div>

      {/* 4. Support Escalation Matrix */}
      <div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px 0" }}>
          4. Three-Tier Support Escalation Matrix
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px" }}>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Tier 1: Frontline Operations Desk</div>
            <div style={{ fontSize: "13px", color: "#475569" }}>Handles general platform inquiries, catalog management, theme settings, and documentation walk-throughs via the in-app support ticket form.</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px" }}>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Tier 2: Technical &amp; Billing Engineering</div>
            <div style={{ fontSize: "13px", color: "#475569" }}>Handles payment gateway webhook investigations, custom domain DNS verifications, API integrations, and tax invoice corrections.</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px" }}>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Tier 3: Statutory Grievance Redressal Officer</div>
            <div style={{ fontSize: "13px", color: "#475569" }}>Final authority for statutory escalations, data deletion requests under DPDP Act 2023, and unresolved commercial disputes.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLegalFullView;
