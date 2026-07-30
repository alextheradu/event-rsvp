"use client";

import { useState, useTransition } from "react";
import {
	retryChannelAccessAction,
	setCheckedInAction,
} from "@/lib/actions/roster";

export interface RosterRow {
	id: string;
	name: string;
	status: string;
	checkedIn: boolean;
	verificationStatus: string | null;
	channelAccessStatus: string;
	notificationsEnabled: boolean;
	feedbackOpen: boolean;
}

export default function Roster({ rows }: { rows: RosterRow[] }) {
	const [filter, setFilter] = useState("all");
	const visible = rows.filter(
		(row) =>
			filter === "all" ||
			row.status === filter ||
			(filter === "checked_in" && row.checkedIn),
	);
	return (
		<div className="space-y-4">
			<label className="text-sm text-zinc-400">
				Show{" "}
				<select
					value={filter}
					onChange={(event) => setFilter(event.target.value)}
					className="ml-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2"
				>
					<option value="all">Everyone</option>
					<option value="confirmed">Confirmed</option>
					<option value="waitlisted">Waitlisted</option>
					<option value="cancelled">Cancelled</option>
					<option value="checked_in">Checked in</option>
				</select>
			</label>
			<div className="overflow-x-auto rounded-xl border border-zinc-800">
				<table className="w-full text-sm">
					<thead className="text-left text-zinc-500 bg-zinc-900">
						<tr>
							<th className="p-3">Attendee</th>
							<th className="p-3">RSVP</th>
							<th className="p-3">Verification</th>
							<th className="p-3">Channel</th>
							<th className="p-3">Attendance</th>
						</tr>
					</thead>
					<tbody>
						{visible.map((row) => (
							<RosterTableRow key={row.id} row={row} />
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function RosterTableRow({ row }: { row: RosterRow }) {
	const [pending, start] = useTransition();
	const [checked, setChecked] = useState(row.checkedIn);
	return (
		<tr className="border-t border-zinc-800">
			<td className="p-3 font-medium">{row.name}</td>
			<td className="p-3 capitalize">{row.status}</td>
			<td className="p-3">{row.verificationStatus ?? "Not checked"}</td>
			<td className="p-3">
				<span>{row.channelAccessStatus.replaceAll("_", " ")}</span>
				{["failed", "verification_needed", "verification_unavailable"].includes(
					row.channelAccessStatus,
				) && (
					<button
						type="button"
						className="block text-xs text-primary mt-1"
						onClick={() =>
							start(async () => {
								await retryChannelAccessAction(row.id);
							})
						}
					>
						Retry
					</button>
				)}
			</td>
			<td className="p-3">
				<label className="inline-flex items-center gap-2">
					<input
						type="checkbox"
						checked={checked}
						disabled={pending || row.status !== "confirmed"}
						onChange={(event) => {
							const next = event.target.checked;
							const confirmed =
								!row.feedbackOpen ||
								window.confirm(
									"Feedback is already open. Correct attendance without revoking any invitation or response?",
								);
							if (!confirmed) return;
							start(async () => {
								const result = await setCheckedInAction(
									row.id,
									next,
									row.feedbackOpen,
								);
								if (result.ok) setChecked(next);
							});
						}}
					/>
					{checked ? "Checked in" : "Not checked in"}
				</label>
			</td>
		</tr>
	);
}
