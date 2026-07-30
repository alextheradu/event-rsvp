import type { PlaceSuggestion, PlacesPort } from "./places";

interface GeoapifyFeature {
	properties?: {
		place_id?: unknown;
		formatted?: unknown;
		lat?: unknown;
		lon?: unknown;
	};
}

export function createGeoapifyPlaces(
	apiKey = process.env.GEOAPIFY_API_KEY,
	fetchImpl: typeof fetch = fetch,
): PlacesPort {
	return {
		async autocomplete(query, signal) {
			if (!apiKey) return [];
			const timeout = AbortSignal.timeout(5_000);
			const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
			try {
				const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
				url.searchParams.set("text", query);
				url.searchParams.set("limit", "5");
				url.searchParams.set("format", "geojson");
				url.searchParams.set("apiKey", apiKey);
				const response = await fetchImpl(url, { signal: combined });
				if (!response.ok) return [];
				const body = (await response.json()) as { features?: unknown };
				if (!Array.isArray(body.features)) return [];
				return body.features.flatMap((feature): PlaceSuggestion[] => {
					const properties = (feature as GeoapifyFeature).properties;
					if (
						typeof properties?.place_id !== "string" ||
						typeof properties.formatted !== "string" ||
						typeof properties.lat !== "number" ||
						typeof properties.lon !== "number"
					) {
						return [];
					}
					return [
						{
							provider: "geoapify",
							placeId: properties.place_id,
							display: properties.formatted,
							latitude: properties.lat,
							longitude: properties.lon,
						},
					];
				});
			} catch {
				return [];
			}
		},
	};
}

export const geoapifyPlaces = createGeoapifyPlaces();
