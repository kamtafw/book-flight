import {
	areSeatAcceptanceRequirementsSatisfied,
	createSeatAcceptanceComponentKey,
	isSeatDisclosureAcknowledgementCurrent,
	isSeatPriceAcceptanceCurrent,
	type SeatAcceptanceRequirement,
	type SeatDisclosureAcknowledgement,
	type SeatPriceAcceptance,
} from "./seat-acceptance"
import type { FlightFareReview } from "./flight-fare-review"
import { calculateCheckoutPricing, type CheckoutPricingResult, type Money, type PricingComponent } from "./pricing"

export interface CheckoutPricingPresentationInput {
	flightFareReview: FlightFareReview | null
	flightFareAccepted: boolean
	seatRequirements: SeatAcceptanceRequirement[] | null
	seatPriceAcceptances: SeatPriceAcceptance[]
	seatDisclosureAcknowledgements: SeatDisclosureAcknowledgement[]
	passengerLabels?: Record<string, string>
	segmentLabels?: Record<string, string>
}

export interface CheckoutSeatPricingLine {
	componentKey: string
	label: string
	status: SeatAcceptanceRequirement["status"]
	previousPrice: Money | null
	currentPrice: Money | null
	priceAcceptanceRequired: boolean
	priceAccepted: boolean
	disclosureAcknowledgementRequired: boolean
	disclosuresAcknowledged: boolean
	previousDisclosures: string[]
	currentDisclosures: string[]
}

export interface CheckoutPricingPresentation {
	status: "ready" | "mixed_currency" | "blocked"
	reason: "seat_validation_pending" | "seat_unavailable" | "mixed_currency" | null
	pricing: CheckoutPricingResult | null
	flightFare: {
		previousPrice: Money
		currentPrice: Money
		acceptanceRequired: boolean
		accepted: boolean
	}
	seatLines: CheckoutSeatPricingLine[]
	allAcceptancesSatisfied: boolean
}

function currentSeatPrice(requirement: Exclude<SeatAcceptanceRequirement, { status: "unavailable" }>): Money {
	return {
		amount: requirement.selection.current.amount,
		currency: requirement.selection.current.currency,
	}
}

/**
 * Builds the customer-facing pricing view from the current validated offer and
 * seat requirements. It never calculates a total while seat validation is
 * pending or any selected seat is unavailable.
 */
export function buildCheckoutPricingPresentation(
	input: CheckoutPricingPresentationInput,
): CheckoutPricingPresentation {
	const fareReview = input.flightFareReview
	const requirements = input.seatRequirements
	if (!fareReview || !requirements) {
		return {
			status: "blocked",
			reason: "seat_validation_pending",
			pricing: null,
			flightFare: {
				previousPrice: { amount: "0", currency: "XXX" },
				currentPrice: { amount: "0", currency: "XXX" },
				acceptanceRequired: true,
				accepted: false,
			},
			seatLines: [],
			allAcceptancesSatisfied: false,
		}
	}

	const flightFare = {
		previousPrice: fareReview.previousPrice,
		currentPrice: fareReview.currentPrice,
		acceptanceRequired: fareReview.acceptanceRequired,
		accepted: !fareReview.acceptanceRequired || input.flightFareAccepted,
	}

	const seatLines: CheckoutSeatPricingLine[] = requirements.map((requirement) => {
		const componentKey = createSeatAcceptanceComponentKey(requirement.identity)
		const passengerLabel =
			input.passengerLabels?.[requirement.identity.passengerId] ?? "Passenger"
		const segmentLabel =
			input.segmentLabels?.[requirement.identity.segmentId] ?? "Flight segment"
		const label = `${passengerLabel} · ${segmentLabel} · Seat ${requirement.identity.seatDesignator}`
		if (requirement.status === "unavailable") {
			return {
				componentKey,
				label,
				status: requirement.status,
				previousPrice: {
					amount: requirement.selection.selection.totalAmount,
					currency: requirement.selection.selection.totalCurrency,
				},
				currentPrice: null,
				priceAcceptanceRequired: false,
				priceAccepted: false,
				disclosureAcknowledgementRequired: false,
				disclosuresAcknowledged: false,
				previousDisclosures: [...requirement.selection.selection.disclosures],
				currentDisclosures: [],
			}
		}

		const priceAcceptance =
			input.seatPriceAcceptances.find(
				(item) => createSeatAcceptanceComponentKey(item.identity) === componentKey,
			) ?? null
		const disclosureAcknowledgement =
			input.seatDisclosureAcknowledgements.find(
				(item) => createSeatAcceptanceComponentKey(item.identity) === componentKey,
			) ?? null
		return {
			componentKey,
			label,
			status: requirement.status,
			previousPrice: requirement.priceAcceptanceRequired
				? requirement.previousPrice
				: {
						amount: requirement.selection.selection.totalAmount,
						currency: requirement.selection.selection.totalCurrency,
					},
			currentPrice: currentSeatPrice(requirement),
			priceAcceptanceRequired: requirement.priceAcceptanceRequired,
			priceAccepted:
				!requirement.priceAcceptanceRequired ||
				isSeatPriceAcceptanceCurrent(requirement, priceAcceptance),
			disclosureAcknowledgementRequired: requirement.disclosureAcknowledgementRequired,
			disclosuresAcknowledged:
				!requirement.disclosureAcknowledgementRequired ||
				isSeatDisclosureAcknowledgementCurrent(requirement, disclosureAcknowledgement),
			previousDisclosures:
				"previousDisclosures" in requirement
					? [...requirement.previousDisclosures]
					: [...requirement.selection.selection.disclosures],
			currentDisclosures: [...requirement.selection.current.disclosures],
		}
	})

	const unavailableSeats = seatLines.some((line) => line.status === "unavailable")
	const seatComponents: PricingComponent[] = seatLines.flatMap((line) =>
		line.currentPrice
			? [
					{
						id: line.componentKey,
						kind: "seat" as const,
						label: line.label,
						money: line.currentPrice,
					},
				]
			: [],
	)

	if (unavailableSeats) {
		return {
			status: "blocked",
			reason: "seat_unavailable",
			pricing: null,
			flightFare,
			seatLines,
			allAcceptancesSatisfied: false,
		}
	}

	const pricing = calculateCheckoutPricing({
		flightFare: fareReview.currentPrice,
		seats: seatComponents,
		additionalServices: [],
	})
	const seatRequirementsSatisfied = areSeatAcceptanceRequirementsSatisfied(
		requirements,
		input.seatPriceAcceptances,
		input.seatDisclosureAcknowledgements,
	)
	const allAcceptancesSatisfied = flightFare.accepted && seatRequirementsSatisfied

	if (pricing.status === "mixed_currency") {
		return {
			status: "mixed_currency",
			reason: "mixed_currency",
			pricing,
			flightFare,
			seatLines,
			allAcceptancesSatisfied: false,
		}
	}

	return {
		status: "ready",
		reason: null,
		pricing,
		flightFare,
		seatLines,
		allAcceptancesSatisfied,
	}
}
