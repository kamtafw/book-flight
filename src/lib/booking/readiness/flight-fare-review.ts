import { subtractMoney, addMoney, type Money } from "./pricing"

export interface FlightFareReviewIdentity {
	reviewSessionId: string
	bookingSessionId: string
	selectedOfferId: string
}

export interface FlightFareReviewInput {
	identity: FlightFareReviewIdentity
	currentOfferId: string
	previousPrice: Money
	currentPrice: Money
}

export interface FlightFareAcceptance {
	identity: FlightFareReviewIdentity
	currentOfferId: string
	previousPrice: Money
	currentPrice: Money
	acceptedAt: string
}

export type FlightFareReview =
	| {
			status: "unchanged"
			identity: FlightFareReviewIdentity
			currentOfferId: string
			previousPrice: Money
			currentPrice: Money
			difference: { amount: "0"; currency: string }
			acceptanceRequired: false
	  }
	| {
			status: "acceptance_required"
			identity: FlightFareReviewIdentity
			currentOfferId: string
			previousPrice: Money
			currentPrice: Money
			difference: Money | null
			acceptanceRequired: true
	  }

function snapshotMoney(money: Money): Money {
	// Reuse the exact-money validator without changing the supplied amount's precision.
	addMoney(money, { amount: "0", currency: money.currency })
	return { amount: money.amount, currency: money.currency }
}

function snapshotIdentity(identity: FlightFareReviewIdentity): FlightFareReviewIdentity {
	if (
		!identity.reviewSessionId.trim() ||
		!identity.bookingSessionId.trim() ||
		!identity.selectedOfferId.trim()
	) {
		throw new Error("Flight fare review requires a complete session and offer identity.")
	}
	return { ...identity }
}

function validateOfferId(offerId: string) {
	if (typeof offerId !== "string" || !offerId.trim()) {
		throw new Error("A current provider offer ID is required.")
	}
	return offerId
}

/**
 * Compares the selected fare with the refreshed provider fare.
 * Any amount OR currency change requires acceptance, including a decrease.
 */
export function createFlightFareReview(input: FlightFareReviewInput): FlightFareReview {
	const identity = snapshotIdentity(input.identity)
	const currentOfferId = validateOfferId(input.currentOfferId)
	const previousPrice = snapshotMoney(input.previousPrice)
	const currentPrice = snapshotMoney(input.currentPrice)
	const unchanged =
		previousPrice.amount === currentPrice.amount &&
		previousPrice.currency === currentPrice.currency

	if (unchanged) {
		return {
			status: "unchanged",
			identity,
			currentOfferId,
			previousPrice,
			currentPrice,
			difference: { amount: "0", currency: currentPrice.currency },
			acceptanceRequired: false,
		}
	}

	const difference =
		previousPrice.currency === currentPrice.currency
			? subtractMoney(currentPrice, previousPrice)
			: null

	return {
		status: "acceptance_required",
		identity,
		currentOfferId,
		previousPrice,
		currentPrice,
		difference,
		acceptanceRequired: true,
	}
}

/** Records an explicit acceptance against the exact fare review being shown. */
export function acceptFlightFareChange(
	review: FlightFareReview,
	acceptedAt = new Date().toISOString(),
): FlightFareAcceptance {
	if (review.status !== "acceptance_required") {
		throw new Error("There is no changed flight fare requiring acceptance.")
	}
	if (!Number.isFinite(Date.parse(acceptedAt))) {
		throw new Error("A valid acceptance timestamp is required.")
	}
	return {
		identity: { ...review.identity },
		currentOfferId: review.currentOfferId,
		previousPrice: { ...review.previousPrice },
		currentPrice: { ...review.currentPrice },
		acceptedAt,
	}
}

/**
 * Acceptance remains valid only for the same review/booking/selected offer,
 * refreshed offer ID, old fare and exact current amount/currency.
 */
export function isFlightFareAcceptanceCurrent(
	review: FlightFareReview,
	acceptance: FlightFareAcceptance | null,
): boolean {
	if (review.status !== "acceptance_required" || !acceptance) return false
	return (
		acceptance.identity.reviewSessionId === review.identity.reviewSessionId &&
		acceptance.identity.bookingSessionId === review.identity.bookingSessionId &&
		acceptance.identity.selectedOfferId === review.identity.selectedOfferId &&
		acceptance.currentOfferId === review.currentOfferId &&
		acceptance.previousPrice.amount === review.previousPrice.amount &&
		acceptance.previousPrice.currency === review.previousPrice.currency &&
		acceptance.currentPrice.amount === review.currentPrice.amount &&
		acceptance.currentPrice.currency === review.currentPrice.currency
	)
}
