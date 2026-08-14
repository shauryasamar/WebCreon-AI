import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { saveThemeSnapshot, updateThemeValues, applyThemeToPages } from "../customizations/editorUtils";

type DataCard = {
  type: "redirect_card" | "orders_card" | "returns_card" | "analytics_card" | "palette_suggestions_card" | "component_palette_suggestions_card" | "camouflage_warning_card" | "table_card";
  title?: string;
  description?: string;
  target_url?: string;
  button_label?: string;
  target_component?: string;
  bg_key?: string;
  new_bg?: string;
  suggested_text?: string;
  columns?: string[];
  rows?: Array<any>;
  row_count?: number;
  orders?: Array<{ id: string; total: number; status: string; items_count?: number; items_summary?: string; date?: string }>;
  returns?: Array<{ id: string; order_id?: string; product?: string; reason?: string; status?: string; refund_status?: string; amount?: number }>;
  palettes?: Array<any>;
  metrics?: {
    total_sales?: string;
    orders_count?: number;
    top_product?: string;
    average_rating?: string;
    cancellation_rate?: string;
  };
};

type CopilotMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  time: string;
  cards?: DataCard[];
};

type AdminCopilotChatProps = {
  siteId: string;
  siteDefinition?: any;
  onSiteDefinitionChange?: (nextDef: any) => void;
};

export const AdminCopilotChat: React.FC<AdminCopilotChatProps> = ({
  siteId,
  siteDefinition,
  onSiteDefinitionChange,
}) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    if (typeof window !== "undefined" && siteId) {
      try {
        const stored = sessionStorage.getItem(`webnirmaan_copilot_chat_${siteId}`) || localStorage.getItem(`webnirmaan_copilot_chat_${siteId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {}
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Persist messages across drawer closing/opening
  useEffect(() => {
    if (typeof window !== "undefined" && siteId) {
      try {
        if (messages.length > 0) {
          sessionStorage.setItem(`webnirmaan_copilot_chat_${siteId}`, JSON.stringify(messages));
          localStorage.setItem(`webnirmaan_copilot_chat_${siteId}`, JSON.stringify(messages));
        }
      } catch {}
    }
  }, [messages, siteId]);

  const handleClearChat = () => {
    setMessages([]);
    if (typeof window !== "undefined" && siteId) {
      try {
        sessionStorage.removeItem(`webnirmaan_copilot_chat_${siteId}`);
        localStorage.removeItem(`webnirmaan_copilot_chat_${siteId}`);
      } catch {}
    }
    setToastMsg("Chat history cleared 🧹");
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Clean fixed admin dashboard theme for Copilot UI
  const chatBg = "#ffffff";
  const chatText = "#0f172a";
  const chatMuted = "#64748b";
  const userBubbleBg = "#2563eb";
  const assistantBubbleBg = "#f1f5f9";
  const assistantBubbleText = "#0f172a";
  const inputBorderColor = "#cbd5e1";
  const inputBg = "#ffffff";

  const handleSaveThemeToLibrary = (themeObj: any, themeName: string) => {
    if (siteDefinition && onSiteDefinitionChange) {
      const themePatch: Record<string, string> = { festival_theme: "none" };
      const paletteKeys = [
        "primary_bg", "secondary_bg", "text_color", "muted_text", "muted_text_color", "soft_text_color",
        "accent_color", "accent_hover", "accent_text",
        "border_color", "soft_border",
        "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color",
        "footer_bg", "footer_text_color", "footer_muted_color",
        "hero_bg", "hero_text_color", "hero_accent",
        "card_bg", "card_text_color", "card_shadow",
      ];
      const sourceObj = themeObj?.patch || themeObj?.theme || themeObj || {};
      for (const key of paletteKeys) {
        if (sourceObj[key]) themePatch[key] = sourceObj[key];
      }
      if (sourceObj.muted_text && !themePatch.muted_text_color) {
        themePatch.muted_text_color = sourceObj.muted_text;
      }
      if (themePatch.navbar_bg && !themePatch.navbar_outer_bg) {
        themePatch.navbar_outer_bg = themePatch.navbar_bg;
      }
      const updatedDef = saveThemeSnapshot(siteDefinition as any, themeName, themePatch);
      onSiteDefinitionChange(updatedDef);
    }

    setToastMsg(`Saved "${themeName}" to SAVED THEMES SNAPSHOTS in sidepanel! 📁`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleApplyPaletteDirectly = async (palette: any) => {
    if (!siteDefinition || !onSiteDefinitionChange) return;

    // Build a complete theme patch from the palette object
    const themePatch: Record<string, string> = {
      festival_theme: "none",
    };
    const paletteKeys = [
      "primary_bg", "secondary_bg", "text_color", "muted_text", "muted_text_color", "soft_text_color",
      "accent_color", "accent_hover", "accent_text",
      "border_color", "soft_border",
      "navbar_bg", "navbar_outer_bg", "navbar_text_color", "navbar_border_color",
      "footer_bg", "footer_text_color", "footer_muted_color",
      "hero_bg", "hero_text_color", "hero_accent",
      "card_bg", "card_text_color", "card_shadow",
    ];
    for (const key of paletteKeys) {
      if (palette[key]) themePatch[key] = palette[key];
    }
    if (palette.muted_text && !themePatch.muted_text_color) {
      themePatch.muted_text_color = palette.muted_text;
    }
    if (themePatch.navbar_bg && !themePatch.navbar_outer_bg) {
      themePatch.navbar_outer_bg = themePatch.navbar_bg;
    }

    // Apply theme patch via updateThemeValues so all pages and components purge old block-level color locks
    const updatedDef = updateThemeValues(siteDefinition as any, themePatch);

    // Apply immediately on the builder canvas
    onSiteDefinitionChange(updatedDef);

    // Add a confirmation message in chat
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, sender: "user", text: `Apply the "${palette.name}" color theme`, time: timeNow },
    ]);

    // Send to backend so the copilot can acknowledge the change
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          site_id: siteId,
          message: `I applied the "${palette.name}" color theme with these colors: ${JSON.stringify(themePatch)}`,
          chat_history: messages.map((m) => ({ sender: m.sender, text: m.text })),
          draft_definition: updatedDef,
        }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { id: `asst-${Date.now()}`, sender: "assistant", text: data.assistant_reply || `Applied the **${palette.name}** theme to your store! ✨`, time: timeNow },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `asst-${Date.now()}`, sender: "assistant", text: `Applied the **${palette.name}** theme successfully! ✨`, time: timeNow },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const updatedHistory = [...messages, { id: userMsgId, sender: "user" as const, text, time: timeNow }];

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", text, time: timeNow },
      { id: assistantMsgId, sender: "assistant", text: "Processing...", time: timeNow },
    ]);

    if (!textToSend) setInput("");
    setLoading(true);

    try {
      let data: any = null;
      let streamedText = "";

      try {
        const streamResponse = await fetch(`${API_BASE_URL}/copilot/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            site_id: siteId,
            message: text,
            chat_history: updatedHistory.map((m) => ({ sender: m.sender, text: m.text })),
            draft_definition: siteDefinition,
          }),
        });

        if (streamResponse.ok && streamResponse.body) {
          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data:")) {
                try {
                  const event = JSON.parse(trimmed.slice(5).trim());
                  if (event.type === "token" && event.content) {
                    streamedText += event.content;
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMsgId
                          ? { ...msg, text: streamedText }
                          : msg
                      )
                    );
                  } else if (event.type === "done") {
                    data = event;
                  }
                } catch {
                  // Ignore partial json in stream
                }
              }
            }
          }
        }
      } catch (streamErr) {
        console.warn("Copilot SSE stream failed, falling back to standard endpoint:", streamErr);
      }

      // Fallback if stream did not return done payload
      if (!data) {
        const response = await fetch(`${API_BASE_URL}/copilot/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            site_id: siteId,
            message: text,
            chat_history: updatedHistory.map((m) => ({ sender: m.sender, text: m.text })),
            draft_definition: siteDefinition,
          }),
        });

        if (!response.ok) throw new Error("Co-Pilot request failed");
        data = await response.json();
      }

      // Trigger Live Design Update in Builder if modified
      const updatedDraft = data?.updated_draft_definition || data?.next_draft_definition;
      if (data?.design_modified && updatedDraft && onSiteDefinitionChange) {
        const nextTheme = updatedDraft.theme || {};
        const syncedPages = applyThemeToPages(
          updatedDraft.pages || [],
          nextTheme
        );
        onSiteDefinitionChange({
          ...updatedDraft,
          pages: syncedPages,
        });
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: data.assistant_reply || streamedText || "Done!",
                cards: data.data_cards,
              }
            : msg
        )
      );
    } catch (err) {
      console.error("Copilot chat error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: "I ran into an issue connecting to store services. Please try again.",
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "calc(100vh - 110px)",
        background: chatBg,
        color: chatText,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div
          style={{
            padding: "6px 12px",
            background: "#10b981",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 700,
            borderRadius: "6px",
            marginBottom: "8px",
            textAlign: "center",
            boxShadow: "0 2px 8px rgba(16,185,129,0.2)",
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Messages Feed */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
        {messages.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: "260px", padding: "40px 0" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: chatMuted, marginBottom: "8px" }}>
              WebNirmaan Co-Pilot
            </div>
            <p style={{ fontSize: "12px", lineHeight: 1.5, margin: 0, color: chatMuted }}>
              Ask Co-Pilot to customize your live store design, manage orders & returns, or analyze store sales performance.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "88%",
                  padding: "10px 14px",
                  borderRadius: isUser ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                  background: isUser ? userBubbleBg : assistantBubbleBg,
                  color: isUser ? "#ffffff" : assistantBubbleText,
                  fontSize: "13px",
                  lineHeight: 1.55,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  wordBreak: "break-word" as const,
                  whiteSpace: "pre-wrap" as const,
                  overflowWrap: "anywhere" as const,
                }}
              >
                {msg.text}
              </div>

              {/* Render Structured Data Cards */}
              {msg.cards && msg.cards.length > 0 && (
                <div style={{ width: "100%", marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {msg.cards.map((card, cIdx) => {
                    if (card.type === "redirect_card") {
                      return (
                        <div
                          key={cIdx}
                          style={{
                            padding: "12px",
                            borderRadius: "10px",
                            background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: "13px", color: "#1e40af", marginBottom: "4px" }}>{card.title}</div>
                          <div style={{ fontSize: "11px", color: "#3b82f6", marginBottom: "8px" }}>{card.description}</div>
                          <button
                            type="button"
                            onClick={() => navigate(card.target_url || "/admin/dashboard")}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              border: "none",
                              background: "#2563eb",
                              color: "#ffffff",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {card.button_label || "Go to AI Dashboard"}
                          </button>
                        </div>
                      );
                    }

                    if (card.type === "palette_suggestions_card" && Array.isArray(card.palettes)) {
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#1e293b" }}>{card.title}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {card.palettes.map((pal: any, pIdx: number) => (
                              <div key={pIdx} style={{ padding: "8px 10px", background: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>{pal.name}</div>
                                  <div style={{ display: "flex", gap: "4px" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleApplyPaletteDirectly(pal)}
                                      style={{
                                        padding: "3px 8px",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        background: "#2563eb",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "5px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Apply Theme ✨
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveThemeToLibrary(pal, pal.name)}
                                      style={{
                                        padding: "3px 6px",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        background: "#059669",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "5px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Save 💾
                                    </button>
                                  </div>
                                </div>
                                <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "6px" }}>{pal.description}</div>
                                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                  <span style={{ fontSize: "9px", color: "#94a3b8", marginRight: "2px" }}>Swatches:</span>
                                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: pal.primary_bg, border: "1px solid #cbd5e1" }} title={`Primary BG: ${pal.primary_bg}`} />
                                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: pal.secondary_bg, border: "1px solid #cbd5e1" }} title={`Secondary BG: ${pal.secondary_bg}`} />
                                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: pal.accent_color, border: "1px solid #cbd5e1" }} title={`Accent: ${pal.accent_color}`} />
                                  {pal.card_bg && <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: pal.card_bg, border: "1px solid #cbd5e1" }} title={`Card BG: ${pal.card_bg}`} />}
                                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: pal.navbar_bg, border: "1px solid #cbd5e1" }} title={`Navbar BG: ${pal.navbar_bg}`} />
                                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: pal.footer_bg, border: "1px solid #cbd5e1" }} title={`Footer BG: ${pal.footer_bg}`} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "component_palette_suggestions_card" && Array.isArray(card.palettes)) {
                      const targetComp = (card.target_component || "navbar").toLowerCase();
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#1e293b" }}>{card.title}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {card.palettes.map((pal: any, pIdx: number) => {
                              // Extract component-specific color patch directly from palette option
                              const compPatch: Record<string, string> = { name: pal.name };
                              if (targetComp === "navbar") {
                                compPatch.navbar_bg = pal.navbar_bg || pal.accent_color;
                                compPatch.navbar_text_color = pal.navbar_text_color || "#ffffff";
                                compPatch.navbar_border_color = pal.navbar_border_color || pal.border_color || compPatch.navbar_bg;
                              } else if (targetComp === "footer") {
                                compPatch.footer_bg = pal.footer_bg || pal.secondary_bg;
                                compPatch.footer_text_color = pal.footer_text_color || pal.text_color;
                              } else if (targetComp === "hero") {
                                compPatch.hero_bg = pal.hero_bg || pal.primary_bg;
                                compPatch.hero_text_color = pal.hero_text_color || pal.text_color;
                              } else if (targetComp === "card" || targetComp === "product") {
                                compPatch.card_bg = pal.card_bg || pal.secondary_bg;
                                compPatch.card_text_color = pal.card_text_color || pal.text_color;
                              } else {
                                if (pal.navbar_bg) compPatch.navbar_bg = pal.navbar_bg;
                                if (pal.navbar_text_color) compPatch.navbar_text_color = pal.navbar_text_color;
                              }

                              return (
                                <div key={pIdx} style={{ padding: "8px 10px", background: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>{pal.name}</div>
                                    <div style={{ display: "flex", gap: "4px" }}>
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPaletteDirectly(compPatch)}
                                        style={{
                                          padding: "3px 8px",
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          background: "#2563eb",
                                          color: "#ffffff",
                                          border: "none",
                                          borderRadius: "5px",
                                          cursor: "pointer",
                                        }}
                                      >
                                        Apply to {targetComp.toUpperCase()} ✨
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveThemeToLibrary(compPatch, `${pal.name} (${targetComp})`)}
                                        style={{
                                          padding: "3px 6px",
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          background: "#059669",
                                          color: "#ffffff",
                                          border: "none",
                                          borderRadius: "5px",
                                          cursor: "pointer",
                                        }}
                                      >
                                        Save 💾
                                      </button>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "6px" }}>{pal.description}</div>
                                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                    <span style={{ fontSize: "9px", color: "#94a3b8", marginRight: "2px" }}>Swatches:</span>
                                    {compPatch.navbar_bg && <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: compPatch.navbar_bg, border: "1px solid #cbd5e1" }} title={`Navbar BG: ${compPatch.navbar_bg}`} />}
                                    {compPatch.footer_bg && <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: compPatch.footer_bg, border: "1px solid #cbd5e1" }} title={`Footer BG: ${compPatch.footer_bg}`} />}
                                    {compPatch.card_bg && <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: compPatch.card_bg, border: "1px solid #cbd5e1" }} title={`Card BG: ${compPatch.card_bg}`} />}
                                    {compPatch.hero_bg && <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: compPatch.hero_bg, border: "1px solid #cbd5e1" }} title={`Hero BG: ${compPatch.hero_bg}`} />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "camouflage_warning_card") {
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: "#fffbebe6", border: "1px solid #fde68a" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px", color: "#b45309" }}>{card.title}</div>
                          <div style={{ fontSize: "11px", color: "#78350f", marginBottom: "8px" }}>{card.description}</div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => handleSend(`Update both: set ${card.bg_key} to ${card.new_bg} and set ${card.bg_key?.replace('_bg', '_text_color')} to ${card.suggested_text}`)}
                              style={{ padding: "4px 8px", fontSize: "10px", fontWeight: 700, background: "#d97706", color: "#ffffff", border: "none", borderRadius: "5px", cursor: "pointer" }}
                            >
                              Update Both (High Contrast) ✨
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveThemeToLibrary({ [card.bg_key || 'navbar_bg']: card.new_bg, [card.bg_key?.replace('_bg', '_text_color') || 'navbar_text_color']: card.suggested_text }, "High Contrast Palette")}
                              style={{ padding: "4px 8px", fontSize: "10px", fontWeight: 700, background: "#059669", color: "#ffffff", border: "none", borderRadius: "5px", cursor: "pointer" }}
                            >
                              Save to Library 💾
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "analytics_card" && card.metrics) {
                      return (
                        <div key={cIdx} style={{ padding: "12px", borderRadius: "10px", background: "#0f172a", color: "#ffffff" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#94a3b8" }}>{card.title}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Total Sales</div>
                              <div style={{ fontSize: "14px", fontWeight: 800, color: "#10b981" }}>{card.metrics.total_sales}</div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Orders</div>
                              <div style={{ fontSize: "14px", fontWeight: 800 }}>{card.metrics.orders_count}</div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Avg Rating</div>
                              <div style={{ fontSize: "14px", fontWeight: 800, color: "#f59e0b" }}>{card.metrics.average_rating}</div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px", borderRadius: "6px" }}>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>Cancel Rate</div>
                              <div style={{ fontSize: "14px", fontWeight: 800, color: "#ef4444" }}>{card.metrics.cancellation_rate}</div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (card.type === "returns_card" && card.returns) {
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#334155" }}>{card.title}</div>
                          {card.returns.map((ret: any, rIdx: number) => {
                            const rst = String(ret.status || "Requested").toLowerCase();
                            const badgeBg = rst.includes("approved") || rst.includes("closed") ? "#10b981" : rst.includes("reject") ? "#ef4444" : rst.includes("inspect") || rst.includes("receive") ? "#f59e0b" : "#6366f1";

                            return (
                              <div key={rIdx} style={{ padding: "8px 10px", background: "#ffffff", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>Return #{ret.id} {ret.order_id ? `(Order #${ret.order_id})` : ""}</span>
                                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: badgeBg, color: "#ffffff" }}>{ret.status}</span>
                                </div>
                                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "2px" }}>Reason: {ret.reason || "Customer return request"}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#16a34a" }}>₹{ret.amount?.toFixed?.(2) || ret.amount || "0.00"}</span>
                                  <span style={{ fontSize: "10px", color: "#64748b" }}>Refund: {ret.refund_status || "Pending"}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (card.type === "orders_card" && card.orders) {
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#334155" }}>{card.title}</div>
                          {card.orders.map((ord: any, oIdx: number) => {
                            const isCancelled = String(ord.status).toLowerCase().includes("canc");
                            const isDelivered = String(ord.status).toLowerCase().includes("deliver");
                            const badgeBg = isCancelled ? "#ef4444" : isDelivered ? "#10b981" : "#2563eb";

                            return (
                              <div key={oIdx} style={{ padding: "8px 10px", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>Order #{ord.id}</span>
                                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: badgeBg, color: "#ffffff" }}>{ord.status}</span>
                                </div>
                                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "2px" }}>{ord.items_summary || "Order Items"}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 800, color: "#1e293b", marginTop: "4px" }}>
                                  <span>₹{ord.total?.toFixed?.(2) || ord.total}</span>
                                  <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500 }}>{ord.date || ""}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    if (card.type === "table_card" && Array.isArray(card.rows)) {
                      const cols = card.columns && card.columns.length > 0 ? card.columns : Object.keys(card.rows[0] || {});
                      return (
                        <div key={cIdx} style={{ padding: "10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #e2e8f0", overflowX: "auto" }}>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px", color: "#1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>📊 {card.title || "Query Results"}</span>
                            <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>{card.row_count !== undefined ? card.row_count : card.rows.length} rows</span>
                          </div>
                          {card.rows.length === 0 ? (
                            <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "center", padding: "8px" }}>No matching records found in store database.</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
                              <thead>
                                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                                  {cols.map((col: string, colIdx: number) => (
                                    <th key={colIdx} style={{ padding: "6px 8px", fontWeight: 700, color: "#475569", textTransform: "capitalize", whiteSpace: "nowrap" }}>
                                      {col.replace(/_/g, " ")}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {card.rows.map((r: any, rIdx: number) => (
                                  <tr key={rIdx} style={{ borderBottom: "1px solid #f1f5f9", background: rIdx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                                    {cols.map((col: string, cIdx2: number) => {
                                      const rawVal = r[col];
                                      const colLower = col.toLowerCase().trim();

                                      const isQuantityOrCount =
                                        colLower.includes("sold") ||
                                        colLower.includes("quantity") ||
                                        colLower.includes("qty") ||
                                        colLower.includes("count") ||
                                        colLower.includes("unit") ||
                                        colLower.includes("stock") ||
                                        colLower.includes("items") ||
                                        colLower.includes("orders") ||
                                        colLower.includes("reviews") ||
                                        colLower.includes("rank") ||
                                        colLower.includes("id");

                                      const isRating = colLower.includes("rating") || colLower.includes("stars") || colLower.includes("score");

                                      const isMonetary =
                                        !isQuantityOrCount &&
                                        !isRating &&
                                        typeof rawVal === "number" &&
                                        (colLower.includes("price") ||
                                         colLower.includes("revenue") ||
                                         colLower.includes("sales") ||
                                         colLower.includes("spent") ||
                                         colLower.includes("amount") ||
                                         colLower.includes("cost") ||
                                         colLower.includes("fee") ||
                                         colLower.includes("charge") ||
                                         colLower.includes("refund") ||
                                         colLower.includes("subtotal") ||
                                         colLower.includes("line_total") ||
                                         colLower.includes("grand_total") ||
                                         colLower.includes("order_total") ||
                                         colLower === "total");

                                      let displayVal: string;
                                      if (isMonetary) {
                                        displayVal = `₹${Number(rawVal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
                                      } else if (isRating && typeof rawVal === "number") {
                                        displayVal = `${Number(rawVal).toFixed(1)} ⭐`;
                                      } else if (isQuantityOrCount && typeof rawVal === "number") {
                                        const isUnitLabel = colLower.includes("sold") || colLower.includes("unit") || colLower.includes("qty") || colLower.includes("quantity");
                                        displayVal = `${Number(rawVal).toLocaleString("en-IN")}${isUnitLabel ? " units" : ""}`;
                                      } else if (typeof rawVal === "number") {
                                        displayVal = Number(rawVal).toLocaleString("en-IN");
                                      } else {
                                        displayVal = String(rawVal !== undefined && rawVal !== null ? rawVal : "-");
                                      }

                                      return (
                                        <td key={cIdx2} style={{ padding: "6px 8px", color: "#1e293b", whiteSpace: "nowrap" }}>
                                          {displayVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}

              <span style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px" }}>{msg.time}</span>
            </div>
          );
        })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div style={{ display: "flex", gap: "6px", marginTop: "10px", paddingTop: "8px", borderTop: `1px solid ${inputBorderColor}` }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask Co-Pilot (e.g. fix footer text, show sales...)"
          disabled={loading}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "8px",
            border: `1px solid ${inputBorderColor}`,
            background: inputBg,
            color: chatText,
            fontSize: "12px",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "none",
            background: loading || !input.trim() ? "#cbd5e1" : userBubbleBg,
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 700,
            cursor: loading || !input.trim() ? "default" : "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};
