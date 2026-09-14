import React from "react";

export type MarkdownThemeProps = {
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  borderColor?: string;
  cardBg?: string;
  isDark?: boolean;
  fontFamily?: string;
};

/**
 * Parses markdown inline tokens (bold, italic, code, link) into React elements.
 */
export function renderInlineMarkdown(text: string, theme?: MarkdownThemeProps): React.ReactNode[] {
  if (!text) return [];

  const elements: React.ReactNode[] = [];
  // Tokenize bold (**text** or __text__), italic (*text* or _text_), inline code (`code`), links ([label](url))
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      elements.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      elements.push(
        <code
          key={match.index}
          style={{
            fontFamily: "monospace",
            fontSize: "0.9em",
            background: theme?.isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.06)",
            padding: "2px 5px",
            borderRadius: "4px",
            color: theme?.accentColor || "inherit",
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const closingBracket = token.indexOf("](");
      const label = token.substring(1, closingBracket);
      const href = token.substring(closingBracket + 2, token.length - 1);
      elements.push(
        <a
          key={match.index}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          style={{
            color: theme?.accentColor || "#2563eb",
            textDecoration: "underline",
            fontWeight: 500,
          }}
        >
          {label}
        </a>
      );
    } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      elements.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    } else {
      elements.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

/**
 * Zero-dependency robust Markdown block renderer for storefront and preview.
 */
export const MarkdownContent: React.FC<{
  content: string;
  theme?: MarkdownThemeProps;
  className?: string;
}> = ({ content, theme, className = "" }) => {
  const textColor = theme?.textColor || (theme?.isDark ? "#f8fafc" : "#1e293b");
  const mutedColor = theme?.mutedColor || (theme?.isDark ? "#94a3b8" : "#64748b");
  const accentColor = theme?.accentColor || "#2563eb";
  const borderColor = theme?.borderColor || (theme?.isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)");
  const cardBg = theme?.cardBg || (theme?.isDark ? "#1e293b" : "#f8fafc");

  const lines = (content || "").split(/\r?\n/);
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Blank line
    if (!line) {
      i++;
      continue;
    }

    // 2. Horizontal divider (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line)) {
      blocks.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: "none",
            borderTop: `1px solid ${borderColor}`,
            margin: "28px 0",
            opacity: 0.8,
          }}
        />
      );
      i++;
      continue;
    }

    // 3. Headings
    if (line.startsWith("# ")) {
      blocks.push(
        <h1
          key={`h1-${i}`}
          style={{
            fontSize: "clamp(22px, 3.5vw, 32px)",
            fontWeight: 800,
            color: textColor,
            margin: "28px 0 16px 0",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}
        >
          {renderInlineMarkdown(line.substring(2).trim(), theme)}
        </h1>
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2
          key={`h2-${i}`}
          style={{
            fontSize: "clamp(18px, 2.5vw, 24px)",
            fontWeight: 700,
            color: textColor,
            margin: "24px 0 12px 0",
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
          }}
        >
          {renderInlineMarkdown(line.substring(3).trim(), theme)}
        </h2>
      );
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        <h3
          key={`h3-${i}`}
          style={{
            fontSize: "clamp(16px, 2vw, 19px)",
            fontWeight: 600,
            color: textColor,
            margin: "20px 0 10px 0",
            lineHeight: 1.3,
          }}
        >
          {renderInlineMarkdown(line.substring(4).trim(), theme)}
        </h3>
      );
      i++;
      continue;
    }

    if (line.startsWith("#### ")) {
      blocks.push(
        <h4
          key={`h4-${i}`}
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: textColor,
            margin: "16px 0 8px 0",
            lineHeight: 1.35,
          }}
        >
          {renderInlineMarkdown(line.substring(5).trim(), theme)}
        </h4>
      );
      i++;
      continue;
    }

    // 4. Blockquote (> quote)
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          style={{
            borderLeft: `4px solid ${accentColor}`,
            background: cardBg,
            margin: "20px 0",
            padding: "12px 18px",
            borderRadius: "0 8px 8px 0",
            fontStyle: "italic",
            color: mutedColor,
            lineHeight: 1.6,
          }}
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} style={{ margin: qIdx === 0 ? 0 : "6px 0 0 0" }}>
              {renderInlineMarkdown(ql, theme)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 5. Unordered List (- item or * item)
    if (/^[-*]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul
          key={`ul-${i}`}
          style={{
            margin: "14px 0",
            paddingLeft: "24px",
            lineHeight: 1.65,
            color: textColor,
          }}
        >
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: "6px" }}>
              {renderInlineMarkdown(item, theme)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Ordered List (1. item)
    if (/^\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          style={{
            margin: "14px 0",
            paddingLeft: "24px",
            lineHeight: 1.65,
            color: textColor,
          }}
        >
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: "6px" }}>
              {renderInlineMarkdown(item, theme)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Markdown Tables (| Col 1 | Col 2 |)
    if (line.startsWith("|") && line.endsWith("|")) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableRows.push(lines[i].trim());
        i++;
      }

      if (tableRows.length >= 2) {
        const headerRow = tableRows[0]
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        // Row 1 is divider (|---|---|)
        const dataRows = tableRows.slice(2).map((r) =>
          r
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        );

        blocks.push(
          <div
            key={`table-${i}`}
            style={{
              overflowX: "auto",
              margin: "20px 0",
              borderRadius: "8px",
              border: `1px solid ${borderColor}`,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ background: cardBg, borderBottom: `1px solid ${borderColor}` }}>
                  {headerRow.map((h, hIdx) => (
                    <th key={hIdx} style={{ padding: "10px 14px", fontWeight: 700, color: textColor }}>
                      {renderInlineMarkdown(h, theme)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((dr, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: rIdx === dataRows.length - 1 ? "none" : `1px solid ${borderColor}`,
                    }}
                  >
                    {dr.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: "10px 14px", color: textColor }}>
                        {renderInlineMarkdown(cell, theme)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 8. Regular paragraph
    blocks.push(
      <p
        key={`p-${i}`}
        style={{
          margin: "12px 0",
          lineHeight: 1.68,
          fontSize: "15px",
          color: textColor,
        }}
      >
        {renderInlineMarkdown(rawLine, theme)}
      </p>
    );
    i++;
  }

  return (
    <div
      className={`markdown-rendered-content ${className}`}
      style={{
        fontFamily: theme?.fontFamily || "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: textColor,
      }}
    >
      {blocks}
    </div>
  );
};
