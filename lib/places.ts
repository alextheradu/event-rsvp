export interface PlaceSuggestion {
	provider: "geoapify";
	placeId: string;
	display: string;
	latitude: number;
	longitude: number;
}

export interface PlacesPort {
	autocomplete(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]>;
}
