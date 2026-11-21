import type {
	SeatServiceValidationResponse,
	SeatServiceValidationResult,
	SelectedSeatService,
	ValidatedSeatServiceDetails,
} from "@/lib/flights/types"

export type SeatReviewSelectionOutcome =
	| { status: "valid"; selection: SelectedSeatService; current: ValidatedSeatServiceDetails }
	| {
			status: "price_changed"
			selection: SelectedSeatService
			current: ValidatedSeatServiceDetails
	  }
	| {
			status: "unavailable"
			selection: SelectedSeatService
			reason: "segment_unavailable" | "seat_unavailable" | "service_unavailable"
	  }
	| {
			status: "disclosures_changed"
			selection: SelectedSeatService
			current: ValidatedSeatServiceDetails
			priceChanged: boolean
	  }
	| {
			status: "disclosures_and_price_changed"
			selection: SelectedSeatService
			current: ValidatedSeatServiceDetails
	  }

export type SeatReviewOutcome =
	| { status: "not_selected"; selections: [] }
	| { status: "valid"; selections: Extract<SeatReviewSelectionOutcome, { status: "valid" }>[] }
	| { status: "action_required"; selections: SeatReviewSelectionOutcome[] }

/**
 * Join provider results to the exact submitted seat by stable provider identity.
 * This deliberately never relies on response ordering or passenger array indexes.
 * Malformed/incomplete responses are rejected by the API boundary before this
 * function is called; this function is the pure business-outcome normalizer.
 */
export function createSeatReviewOutcome(
	selectedSeats: SelectedSeatService[],
	response: SeatServiceValidationResponse,
): SeatReviewOutcome {
	if (selectedSeats.length === 0) return { status: "not_selected", selections: [] }

	const results = response.selections
	const normalized = selectedSeats.map((selection) => {
		const result = results.find((candidate) => matchesSelection(candidate, selection))
		if (!result) throw new Error("Seat validation result does not match the submitted selections.")
		return normalizeSelection(selection, result)
	})

	return normalized.every((selection) => selection.status === "valid")
		? {
				status: "valid",
				selections: normalized as Extract<SeatReviewSelectionOutcome, { status: "valid" }>[],
			}
		: { status: "action_required", selections: normalized }
}

function matchesSelection(
	result: SeatServiceValidationResult,
	selection: SelectedSeatService,
): boolean {
	return (
		result.serviceId === selection.id &&
		result.passengerId === selection.passengerId &&
		result.segmentId === selection.segmentId &&
		result.seatDesignator === selection.seatDesignator
	)
}

function normalizeSelection(
	selection: SelectedSeatService,
	result: SeatServiceValidationResult,
): SeatReviewSelectionOutcome {
	if (result.status === "valid" && result.current) {
		return { status: "valid", selection: { ...selection, disclosures: [...selection.disclosures] }, current: result.current }
	}
	if (result.status === "price_changed" && result.current) {
		return {
			status: "price_changed",
			selection: { ...selection, disclosures: [...selection.disclosures] },
			current: result.current,
		}
	}
	if (
		result.status === "selection_changed" &&
		result.current === null &&
		(result.reason === "segment_unavailable" ||
			result.reason === "seat_unavailable" ||
			result.reason === "service_unavailable")
	) {
		return { status: "unavailable", selection, reason: result.reason }
	}
	if (
		result.status === "selection_changed" &&
		result.reason === "seat_disclosures_changed" &&
		result.current
	) {
		return result.priceChanged
			? {
					status: "disclosures_and_price_changed",
					selection,
					current: result.current,
				}
			: {
					status: "disclosures_changed",
					selection,
					current: result.current,
					priceChanged: false,
				}
	}
	throw new Error("Seat validation returned an inconsistent selection outcome.")
}
