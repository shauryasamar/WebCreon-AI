const loadedFonts = new Set<string>(["inter", "plus_jakarta"]);

const FONT_MAP: Record<string, string> = {
  playfair: "Playfair+Display:ital,wght@0,400..800;1,400..800",
  playfair_serif: "Playfair+Display:ital,wght@0,400..800;1,400..800",
  outfit: "Outfit:wght@400..800",
  outfit_tech: "Outfit:wght@400..800",
  cinzel: "Cinzel:wght@400..900",
  cinzel_display: "Cinzel:wght@400..900",
  cormorant: "Cormorant+Garamond:ital,wght@0,400..700;1,400..700",
  cormorant_serif: "Cormorant+Garamond:ital,wght@0,400..700;1,400..700",
  montserrat: "Montserrat:wght@400..800",
  montserrat_bold: "Montserrat:wght@400..800",
  poppins: "Poppins:wght@400..800",
  poppins_rounded: "Poppins:wght@400..800",
  space_grotesk: "Space+Grotesk:wght@400..700",
  dm_sans: "DM+Sans:ital,opsz,wght@0,9..40,400..800;1,9..40,400..800",
  bebas_neue: "Bebas+Neue",
  syne: "Syne:wght@500..800",
  unbounded: "Unbounded:wght@400..900",
  orbitron: "Orbitron:wght@400..900",
  bricolage_grotesque: "Bricolage+Grotesque:opsz,wght@12..96,400..800",
  instrument_serif: "Instrument+Serif:ital@0;1",
  italiana: "Italiana",
  marcellus: "Marcellus",
  michroma: "Michroma",
  parisienne: "Parisienne",
  righteous: "Righteous",
  syncopate: "Syncopate:wght@400;700",
  tenor_sans: "Tenor+Sans",
  audiowide: "Audiowide",
};

/**
 * Dynamically injects Google Font stylesheets on-demand when a theme requests them,
 * instead of preloading all 20+ Google fonts on initial page load.
 */
export function ensureStoreFontLoaded(fontFamily?: string | null): void {
  if (!fontFamily || typeof document === "undefined") return;

  const cleanKey = String(fontFamily).toLowerCase().trim().replace(/['"]/g, "").replace(/\s+/g, "_");
  if (!cleanKey || loadedFonts.has(cleanKey)) return;
  loadedFonts.add(cleanKey);

  const query = FONT_MAP[cleanKey];
  if (query) {
    const existing = document.querySelector(`link[data-wc-font="${cleanKey}"]`);
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
      link.setAttribute("data-wc-font", cleanKey);
      document.head.appendChild(link);
    }
  }
}
