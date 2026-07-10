/* ==================================================================
 * lib/providers/nasa.ts  —  NASA Image and Video Library client
 * ------------------------------------------------------------------
 * Best-effort imagery enrichment (ARCHITECTURE.md §3). Not the
 * key-gated `api.nasa.gov` (APOD, Mars Photos, ...) — none of those
 * endpoints tie to a specific launch. `images-api.nasa.gov` is a
 * separate, unauthenticated search API over NASA's media library, which
 * does return per-mission results, but only for NASA-affiliated
 * missions — searching a routine commercial launch (the majority of
 * this app's data) legitimately returns zero hits, not an error. Like
 * lib/providers/spacex.ts, this client fails soft: `searchNasaImage`
 * returns `null`, never throws.
 * ================================================================== */

const NASA_IMAGES_BASE_URL = process.env.NASA_IMAGES_API_BASE_URL ?? "https://images-api.nasa.gov";

export interface NasaImageResult {
  title: string;
  url: string;
  dateCreated: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Searches NASA's media library by free-text query (mission name) and
 * returns the top image hit, if any. `null` means either no result or a
 * failure of any kind — the caller can't distinguish "no NASA coverage"
 * from "request failed," which is fine since both cases are handled the
 * same way (skip and mark checked). */
export async function searchNasaImage(query: string): Promise<NasaImageResult | null> {
  try {
    const url = new URL(`${NASA_IMAGES_BASE_URL}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("media_type", "image");

    const res = await fetch(url);
    if (!res.ok) return null;

    const body: unknown = await res.json();
    if (!isRecord(body) || !isRecord(body.collection) || !Array.isArray(body.collection.items)) {
      return null;
    }

    const firstItem = body.collection.items[0];
    if (!isRecord(firstItem) || !Array.isArray(firstItem.data) || firstItem.data.length === 0) {
      return null;
    }

    const meta = firstItem.data[0];
    if (!isRecord(meta) || typeof meta.title !== "string") return null;

    const firstLink = Array.isArray(firstItem.links) ? firstItem.links[0] : undefined;
    const imageUrl = isRecord(firstLink) && typeof firstLink.href === "string" ? firstLink.href : null;
    if (!imageUrl) return null;

    return {
      title: meta.title,
      url: imageUrl,
      dateCreated: typeof meta.date_created === "string" ? meta.date_created : null,
    };
  } catch {
    return null;
  }
}
