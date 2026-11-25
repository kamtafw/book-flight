import type { PassengerCollection } from "@/lib/booking/passengers/passenger-domain"
import type { FlightOffer, SelectedSeatService } from "@/lib/flights/types"
import type { SeatReviewOutcome, SeatReviewSelectionOutcome } from "./seat-review"

export type SeatReviewPresentationStatus = SeatReviewSelectionOutcome["status"]

export interface SeatReviewPresentationRow {
	passengerId: string | null
	passengerLabel: string
	passengerCategory: string | null
	segmentId: string
	segmentLabel: string
	seatDesignator: string
	seatName: string
	status: SeatReviewPresentationStatus
	originalAmount: string
	originalCurrency: string
	currentAmount: string | null
	currentCurrency: string | null
	disclosures: string[]
	unavailableReason: "segment_unavailable" | "seat_unavailable" | "service_unavailable" | null
}

export interface SeatReviewPresentationGroup {
	passengerId: string | null
	passengerLabel: string
	passengerCategory: string | null
	associationWarning: boolean
	seats: SeatReviewPresentationRow[]
}

function passengerDisplayName(
	passenger: PassengerCollection["passengers"][number],
	index: number,
): string {
	const name = [
		passenger.identity.givenName,
		passenger.identity.middleName,
		passenger.identity.familyName,
	]
		.filter((part): part is string => Boolean(part?.trim()))
		.join(" ")
	return name || `${passenger.category === "unknown" ? "Passenger" : passenger.category} ${index + 1}`
}

function getSegmentLabels(offer: FlightOffer): Map<string, string> {
	const labels = new Map<string, string>()
	let index = 0
	for (const slice of offer.slices) {
		for (const segment of slice.segments) {
			index += 1
			labels.set(
				segment.id,
				`Segment ${index} · ${segment.departureAirportCode} → ${segment.arrivalAirportCode}`,
			)
		}
	}
	return labels
}

function selectionForOutcome(
	outcome: SeatReviewOutcome,
	selection: SelectedSeatService,
): SeatReviewSelectionOutcome | null {
	if (outcome.status === "not_selected") return null
	return outcome.selections.find(
		(item) =>
			item.selection.id === selection.id &&
			item.selection.offerId === selection.offerId &&
			item.selection.passengerId === selection.passengerId &&
			item.selection.segmentId === selection.segmentId &&
			item.selection.seatDesignator === selection.seatDesignator,
	) ?? null
}

/**
 * Builds the customer-facing seat view by joining provider passenger references
 * and flight segment IDs. It never relies on the order of provider results,
 * selected seats, or passenger arrays to infer ownership.
 */
export function buildSeatReviewPresentation(
	outcome: SeatReviewOutcome,
	selections: SelectedSeatService[],
	passengerCollection: PassengerCollection,
	offer: FlightOffer,
): SeatReviewPresentationGroup[] {
	// Seat selection can change before the focus effect replaces the previous
	// validation outcome. The current selection is authoritative for presentation:
	// never render stale seat rows while the new empty snapshot is being recorded.
	if (selections.length === 0) return []

	if (outcome.status === "not_selected") {
		if (outcome.selections.length !== 0) {
			throw new Error("A not-selected seat outcome cannot contain seat selections.")
		}
		return []
	}

	const segmentLabels = getSegmentLabels(offer)
	const passengerMatchesForSelection = (selection: SelectedSeatService) =>
		passengerCollection.passengers
			.map((passenger) => ({
				passenger,
				matches: passenger.providerReferences.some(
					(reference) =>
						reference.provider === "duffel" &&
						selection.offerId === offer.id &&
						reference.offerId === offer.id &&
						reference.providerPassengerId === selection.passengerId,
				),
			}))
			.filter((entry) => entry.matches)

	const createRow = (
		selection: SelectedSeatService,
		passengerId: string | null,
		passengerLabel: string,
		passengerCategory: string | null,
	): SeatReviewPresentationRow => {
		const selectionOutcome = selectionForOutcome(outcome, selection)
		const segmentLabel = segmentLabels.get(selection.segmentId)
		if (!selectionOutcome || !segmentLabel) {
			throw new Error("Seat review presentation is missing a validated seat or segment.")
		}
		const current = "current" in selectionOutcome ? selectionOutcome.current : null
		return {
			passengerId,
			passengerLabel,
			passengerCategory,
			segmentId: selection.segmentId,
			segmentLabel,
			seatDesignator: selection.seatDesignator,
			seatName: current?.seatName ?? selection.seatName,
			status: selectionOutcome.status,
			originalAmount: selection.totalAmount,
			originalCurrency: selection.totalCurrency,
			currentAmount: current?.amount ?? null,
			currentCurrency: current?.currency ?? null,
			disclosures: current ? [...current.disclosures] : [...selection.disclosures],
			unavailableReason: selectionOutcome.status === "unavailable" ? selectionOutcome.reason : null,
		}
	}

	const groups: SeatReviewPresentationGroup[] = passengerCollection.passengers
		.map((passenger, index) => {
			const passengerLabel = passengerDisplayName(passenger, index)
			const seats = selections
				.filter((selection) => {
					const matches = passengerMatchesForSelection(selection)
					return matches.length === 1 && matches[0].passenger.id === passenger.id
				})
				.map((selection) =>
					createRow(selection, passenger.id, passengerLabel, passenger.category),
				)
			return {
				passengerId: passenger.id,
				passengerLabel,
				passengerCategory: passenger.category,
				associationWarning: false,
				seats,
			}
		})
		.filter((group) => group.seats.length > 0)

	const unmatched = selections.filter(
		(selection) => passengerMatchesForSelection(selection).length !== 1,
	)
	if (unmatched.length > 0) {
		groups.push({
			passengerId: null,
			passengerLabel: "Passenger association needs attention",
			passengerCategory: null,
			associationWarning: true,
			seats: unmatched.map((selection) =>
				createRow(
					selection,
					null,
					"Passenger association needs attention",
					null,
				),
			),
		})
	}

	return groups
}
