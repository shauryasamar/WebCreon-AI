export type SavedSite = {
  id: string;
  slug: string;
  site_definition: any;
  draft_definition: any;
  version: number;
  default_return_window_days?: number;
  created_at: string;
  updated_at: string;
};

let savedSitesMemoryCache: SavedSite[] = [];

export function getSavedSitesMemoryCache(): SavedSite[] {
  return savedSitesMemoryCache;
}

export function setSavedSitesMemoryCache(list: SavedSite[]): void {
  savedSitesMemoryCache = list;
}

export function clearSavedSitesMemoryCache(): void {
  savedSitesMemoryCache = [];
}
