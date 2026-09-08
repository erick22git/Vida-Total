/**
 * Thin client for the Pexels photo search API, used to fetch real food photos.
 * Free tier: https://www.pexels.com/api/ (200 requests/hour, 20 000/month).
 */

const PLACEHOLDER_VALUES = new Set(["", "TU_API_KEY_AQUI", "YOUR_API_KEY_HERE", "undefined"]);

export function getPexelsApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY;
  if (!key || PLACEHOLDER_VALUES.has(key.trim())) return null;
  return key.trim();
}

export function isPexelsConfigured(): boolean {
  return getPexelsApiKey() !== null;
}

interface PexelsPhoto {
  src: { medium: string; large: string; small: string; original: string };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

/**
 * Searches Pexels for a single photo matching `query` and returns the medium-size
 * image URL, or `null` if the key is missing/placeholder, the request fails, or
 * no results are found. Never throws.
 */
export async function fetchFoodPhoto(query: string): Promise<string | null> {
  const apiKey = getPexelsApiKey();
  if (!apiKey) return null;

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
    });

    if (res.status === 429) {
      console.warn("[pexelsService] Rate limit reached (429).");
      return null;
    }
    if (!res.ok) {
      console.warn(`[pexelsService] Request failed with status ${res.status}.`);
      return null;
    }

    const data = (await res.json()) as PexelsSearchResponse;
    const photo = data.photos?.[0];
    return photo?.src?.medium ?? null;
  } catch (err) {
    console.warn("[pexelsService] Network error while fetching photo:", err);
    return null;
  }
}
