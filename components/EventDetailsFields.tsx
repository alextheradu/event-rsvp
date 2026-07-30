"use client";

import { useEffect, useId, useState } from "react";
import { toLocalDateTime } from "@/lib/event-time";
import type { Form } from "@/lib/forms";
import type { PlaceSuggestion } from "@/lib/places";

const field =
	"w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3.5 py-3 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/20";

type Defaults = Partial<
	Pick<
		Form,
		| "startAt"
		| "endAt"
		| "timezone"
		| "eventFormat"
		| "capacity"
		| "attendeeNotes"
		| "locationDisplay"
		| "locationLatitude"
		| "locationLongitude"
		| "locationProvider"
		| "locationPlaceId"
		| "onlineUrl"
	>
>;

export default function EventDetailsFields({
	defaults = {},
}: {
	defaults?: Defaults;
}) {
	const defaultZone =
		defaults.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
	const [format, setFormat] = useState(defaults.eventFormat ?? "tbd");
	const [location, setLocation] = useState(defaults.locationDisplay ?? "");
	const [selected, setSelected] = useState<PlaceSuggestion | null>(
		defaults.locationLatitude !== null &&
			defaults.locationLatitude !== undefined &&
			defaults.locationLongitude !== null &&
			defaults.locationLongitude !== undefined &&
			defaults.locationPlaceId
			? {
					provider: "geoapify",
					placeId: defaults.locationPlaceId,
					display: defaults.locationDisplay ?? "",
					latitude: defaults.locationLatitude,
					longitude: defaults.locationLongitude,
				}
			: null,
	);
	const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
	const [activeIndex, setActiveIndex] = useState(-1);
	const [locationEdited, setLocationEdited] = useState(false);
	const [locationFocused, setLocationFocused] = useState(false);
	const listId = useId();

	useEffect(() => {
		if (
			format !== "in_person" ||
			!locationFocused ||
			!locationEdited ||
			location.trim().length < 3
		) {
			setSuggestions([]);
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(
					`/api/places/autocomplete?q=${encodeURIComponent(location)}`,
					{ signal: controller.signal },
				);
				setSuggestions(response.ok ? await response.json() : []);
				setActiveIndex(-1);
			} catch {
				if (!controller.signal.aborted) setSuggestions([]);
			}
		}, 300);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [format, location, locationEdited, locationFocused]);

	return (
		<fieldset className="space-y-5 border-t border-zinc-800/80 pt-6">
			<legend className="pr-3 text-sm font-semibold text-zinc-200">
				Schedule & place
			</legend>
			<div className="grid sm:grid-cols-2 gap-4">
				<label className="space-y-1.5 text-sm text-zinc-400">
					<span>Starts</span>
					<input
						className={field}
						type="datetime-local"
						name="startLocal"
						required
						defaultValue={toLocalDateTime(
							defaults.startAt ?? null,
							defaultZone,
						)}
					/>
				</label>
				<label className="space-y-1.5 text-sm text-zinc-400">
					<span>Ends</span>
					<input
						className={field}
						type="datetime-local"
						name="endLocal"
						required
						defaultValue={toLocalDateTime(defaults.endAt ?? null, defaultZone)}
					/>
				</label>
			</div>
			<div className="grid sm:grid-cols-2 gap-4">
				<label className="space-y-1.5 text-sm text-zinc-400">
					<span>Timezone</span>
					<input
						className={field}
						name="timezone"
						required
						defaultValue={defaultZone}
					/>
				</label>
				<label className="space-y-1.5 text-sm text-zinc-400">
					<span>Capacity (optional)</span>
					<input
						className={field}
						type="number"
						name="capacity"
						min={1}
						max={10000}
						defaultValue={defaults.capacity ?? ""}
					/>
				</label>
			</div>
			<label className="block space-y-1.5 text-sm text-zinc-400">
				<span>Format</span>
				<select
					className={field}
					name="eventFormat"
					value={format}
					onChange={(event) => setFormat(event.target.value)}
				>
					<option value="tbd">To be decided</option>
					<option value="in_person">In person</option>
					<option value="online">Online</option>
				</select>
			</label>
			{format === "in_person" && (
				<fieldset
					className="space-y-2 relative"
					aria-label="Venue autocomplete"
					onBlur={(event) => {
						if (event.currentTarget.contains(event.relatedTarget)) return;
						setLocationFocused(false);
						setSuggestions([]);
						setActiveIndex(-1);
					}}
				>
					<label className="block space-y-1.5 text-sm text-zinc-400">
						<span>Venue or address</span>
						<input
							className={field}
							name="locationDisplay"
							required
							role="combobox"
							aria-controls={listId}
							aria-expanded={suggestions.length > 0}
							aria-activedescendant={
								activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
							}
							autoComplete="off"
							value={location}
							onFocus={() => setLocationFocused(true)}
							onChange={(event) => {
								setLocation(event.target.value);
								setSelected(null);
								setLocationEdited(true);
							}}
							onKeyDown={(event) => {
								if (!suggestions.length) return;
								if (event.key === "ArrowDown") {
									event.preventDefault();
									setActiveIndex((current) =>
										Math.min(current + 1, suggestions.length - 1),
									);
								} else if (event.key === "ArrowUp") {
									event.preventDefault();
									setActiveIndex((current) => Math.max(current - 1, 0));
								} else if (event.key === "Escape") {
									setSuggestions([]);
									setActiveIndex(-1);
								} else if (event.key === "Enter" && activeIndex >= 0) {
									event.preventDefault();
									const suggestion = suggestions[activeIndex];
									setSelected(suggestion);
									setLocation(suggestion.display);
									setLocationEdited(false);
									setSuggestions([]);
									setActiveIndex(-1);
								}
							}}
						/>
					</label>
					<input
						type="hidden"
						name="locationLatitude"
						value={selected?.latitude ?? ""}
					/>
					<input
						type="hidden"
						name="locationLongitude"
						value={selected?.longitude ?? ""}
					/>
					<input
						type="hidden"
						name="locationProvider"
						value={selected?.provider ?? ""}
					/>
					<input
						type="hidden"
						name="locationPlaceId"
						value={selected?.placeId ?? ""}
					/>
					{suggestions.length > 0 && (
						<div
							id={listId}
							role="listbox"
							className="absolute z-20 w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/40"
						>
							{suggestions.map((suggestion, index) => (
								<button
									type="button"
									key={suggestion.placeId}
									id={`${listId}-${index}`}
									role="option"
									aria-selected={activeIndex === index}
									className={`block w-full text-left px-4 py-3 text-sm hover:bg-zinc-800 ${
										activeIndex === index ? "bg-zinc-800" : ""
									}`}
									onClick={() => {
										setSelected(suggestion);
										setLocation(suggestion.display);
										setLocationEdited(false);
										setSuggestions([]);
										setActiveIndex(-1);
									}}
								>
									{suggestion.display}
								</button>
							))}
							<div className="px-4 py-2 text-[11px] text-zinc-500">
								Powered by Geoapify · © OpenStreetMap contributors
							</div>
						</div>
					)}
					<p className="text-xs leading-relaxed text-zinc-600">
						Autocomplete is optional—manual addresses work too.
					</p>
				</fieldset>
			)}
			{format === "online" && (
				<label className="block space-y-1.5 text-sm text-zinc-400">
					<span>Online event URL</span>
					<input
						className={field}
						type="url"
						name="onlineUrl"
						required
						defaultValue={defaults.onlineUrl ?? ""}
						placeholder="https://"
					/>
				</label>
			)}
			<label className="block space-y-1.5 text-sm text-zinc-400">
				<span>What attendees should know (optional)</span>
				<textarea
					className={field}
					name="attendeeNotes"
					rows={3}
					maxLength={2000}
					defaultValue={defaults.attendeeNotes ?? ""}
				/>
			</label>
		</fieldset>
	);
}
