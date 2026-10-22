const loadedFonts = new Set<string>(["inter", "plus_jakarta"]);

const FONT_MAP: Record<string, string> = {
  playfair: "Playfair+Display:ital,wght@0,400..900;1,400..900",
  playfair_serif: "Playfair+Display:ital,wght@0,400..900;1,400..900",
  playfair_display: "Playfair+Display:ital,wght@0,400..900;1,400..900",
  outfit: "Outfit:wght@300..900",
  outfit_tech: "Outfit:wght@300..900",
  outfit_geometric: "Outfit:wght@300..900",
  cinzel: "Cinzel:wght@400..900",
  cinzel_display: "Cinzel:wght@400..900",
  cormorant: "Cormorant+Garamond:ital,wght@0,300..700;1,300..700",
  cormorant_serif: "Cormorant+Garamond:ital,wght@0,300..700;1,300..700",
  cormorant_garamond: "Cormorant+Garamond:ital,wght@0,300..700;1,300..700",
  montserrat: "Montserrat:ital,wght@0,300..900;1,300..900",
  montserrat_bold: "Montserrat:ital,wght@0,300..900;1,300..900",
  poppins: "Poppins:ital,wght@0,300..900;1,300..900",
  poppins_rounded: "Poppins:ital,wght@0,300..900;1,300..900",
  space_grotesk: "Space+Grotesk:wght@300..700",
  dm_sans: "DM+Sans:ital,opsz,wght@0,9..40,300..900;1,9..40,300..900",
  bebas_neue: "Oswald:wght@300..700",
  oswald: "Oswald:wght@300..700",
  oswald_bold: "Oswald:wght@300..700",
  syne: "Syne:wght@400..800",
  syne_avantgarde: "Syne:wght@400..800",
  unbounded: "Unbounded:wght@300..900",
  unbounded_logo: "Unbounded:wght@300..900",
  orbitron: "Orbitron:wght@400..900",
  orbitron_scifi: "Orbitron:wght@400..900",
  bricolage_grotesque: "Bricolage+Grotesque:opsz,wght@12..96,300..800",
  instrument_serif: "Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900",
  fraunces: "Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900",
  fraunces_editorial: "Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900",
  italiana: "Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900",
  italiana_couture: "Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900",
  bodoni_moda: "Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900",
  marcellus: "Lora:ital,wght@0,400..700;1,400..700",
  marcellus_roman: "Lora:ital,wght@0,400..700;1,400..700",
  lora: "Lora:ital,wght@0,400..700;1,400..700",
  lora_serif: "Lora:ital,wght@0,400..700;1,400..700",
  michroma: "Chakra+Petch:ital,wght@0,300..700;1,300..700",
  michroma_aerotech: "Chakra+Petch:ital,wght@0,300..700;1,300..700",
  chakra_petch: "Chakra+Petch:ital,wght@0,300..700;1,300..700",
  parisienne: "Parisienne",
  parisienne_script: "Parisienne",
  righteous: "Epilogue:ital,wght@0,300..900;1,300..900",
  righteous_retro: "Epilogue:ital,wght@0,300..900;1,300..900",
  epilogue: "Epilogue:ital,wght@0,300..900;1,300..900",
  epilogue_retro: "Epilogue:ital,wght@0,300..900;1,300..900",
  syncopate: "Syncopate:wght@400;700",
  syncopate_wide: "Syncopate:wght@400;700",
  tenor_sans: "Urbanist:ital,wght@0,300..900;1,300..900",
  tenor_runway: "Urbanist:ital,wght@0,300..900;1,300..900",
  urbanist: "Urbanist:ital,wght@0,300..900;1,300..900",
  urbanist_runway: "Urbanist:ital,wght@0,300..900;1,300..900",
  audiowide: "Oxanium:wght@300..800",
  audiowide_future: "Oxanium:wght@300..800",
  oxanium: "Oxanium:wght@300..800",
  oxanium_future: "Oxanium:wght@300..800",
  inter: "Inter:ital,wght@0,300..900;1,300..900",
  sans_modern: "Inter:ital,wght@0,300..900;1,300..900",
  modern_sans: "Inter:ital,wght@0,300..900;1,300..900",
  plus_jakarta: "Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800",
  plus_jakarta_sans: "Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800",
};

/**
 * Dynamically injects Google Font stylesheets on-demand when a theme requests them,
 * instead of preloading all 20+ Google fonts on initial page load.
 */
export function ensureStoreFontLoaded(fontFamily?: string | null): void {
  if (!fontFamily || typeof document === "undefined") return;

  const raw = String(fontFamily).trim();
  const primaryName = raw.split(",")[0].trim().replace(/['"]/g, "").toLowerCase().replace(/\s+/g, "_");
  if (!primaryName) return;

  const query = FONT_MAP[primaryName] || FONT_MAP[raw.toLowerCase().replace(/['"]/g, "").replace(/\s+/g, "_")];
  if (!query) return;

  const fontId = query.split(":")[0].toLowerCase().replace(/\+/g, "_");
  if (loadedFonts.has(fontId)) return;

  const existing = document.querySelector(`link[data-wc-font="${fontId}"]`) as HTMLLinkElement | null;
  if (existing) {
    loadedFonts.add(fontId);
    return;
  }

  loadedFonts.add(fontId);
  const targetHref = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = targetHref;
  link.setAttribute("data-wc-font", fontId);
  document.head.appendChild(link);
}
