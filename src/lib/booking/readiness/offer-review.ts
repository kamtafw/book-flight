import type { FlightOffer, OfferRefreshPrice, OfferRefreshResponse } from "@/lib/flights/types"

/**
 * A normalized result for the Checkout Review offer stage.
 *
 * This model deliberately stops at eligibility for the next validation stage.
 * It does not represent final checkout or order-preparation readiness.
 * Technical refresh failures remain thrown FlightSearchError instances from
 * refreshOffer(); they are not business outcomes in this union.
 */
export type OfferReviewOutcome =
	| {
			status: "valid"
			originalOffer: FlightOffer
			currentOffer: FlightOffer
			canContinueToSeatValidation: true
			priceAcceptanceRequired: false
	  }
	| {
			status: "price_changed"
			originalOffer: FlightOffer
			currentOffer: FlightOffer
			previousPrice: OfferRefreshPrice
			currentPrice: OfferRefreshPrice
			canContinueToSeatValidation: true
			priceAcceptanceRequired: true
	  }
	| {
			status: "itinerary_changed"
			originalOffer: FlightOffer
			refreshedOffer: FlightOffer
			materialDifferences: string[]
			priceChanged: boolean
			previousPrice: OfferRefreshPrice
			currentPrice: OfferRefreshPrice
			canContinueToSeatValidation: false
			priceAcceptanceRequired: false
			blockingReason: "itinerary_changed"
	  }
	| {
			status: "unavailable"
			originalOffer: FlightOffer
			code: string
			message: string
			canContinueToSeatValidation: false
			priceAcceptanceRequired: false
			blockingReason: "unavailable"
	  }

/**
 * FlightOffer is plain provider data. Copy nested collections so the original
 * selection remains an independent comparison baseline if either the store
 * or a later review step replaces or mutates its offer object.
 */
function snapshotOffer(offer: FlightOffer): FlightOffer {
	return {
		...offer,
		operatingCarrierNames: [...offer.operatingCarrierNames],
		passengers: offer.passengers?.map((passenger) => ({ ...passenger })),
		slices: offer.slices.map((slice) => ({
			...slice,
			segments: slice.segments.map((segment) => ({ ...segment })),
		})),
	}
}

function snapshotPrice(price: OfferRefreshPrice): OfferRefreshPrice {
	return { amount: price.amount, currency: price.currency }
}

/**
 * Combines the originally selected offer with the typed BR-02 business
 * outcome without allowing a refreshed itinerary to silently replace the
 * customer's original selection.
 */
export function createOfferReviewOutcome(
	originalOffer: FlightOffer,
	response: OfferRefreshResponse,
): OfferReviewOutcome {
	const originalSnapshot = snapshotOffer(originalOffer)

	switch (response.status) {
		case "valid":
			return {
				status: "valid",
				originalOffer: originalSnapshot,
				currentOffer: snapshotOffer(response.offer),
				canContinueToSeatValidation: true,
				priceAcceptanceRequired: false,
			}

		case "price_changed":
			return {
				status: "price_changed",
				originalOffer: originalSnapshot,
				currentOffer: snapshotOffer(response.offer),
				previousPrice: snapshotPrice(response.previousPrice),
				currentPrice: snapshotPrice(response.currentPrice),
				canContinueToSeatValidation: true,
				priceAcceptanceRequired: true,
			}

		case "itinerary_changed":
			return {
				status: "itinerary_changed",
				originalOffer: originalSnapshot,
				refreshedOffer: snapshotOffer(response.offer),
				materialDifferences: [...response.materialDifferences],
				priceChanged: response.priceChanged,
				previousPrice: snapshotPrice(response.previousPrice),
				currentPrice: snapshotPrice(response.currentPrice),
				canContinueToSeatValidation: false,
				priceAcceptanceRequired: false,
				blockingReason: "itinerary_changed",
			}

		case "unavailable":
			return {
				status: "unavailable",
				originalOffer: originalSnapshot,
				code: response.code,
				message: response.message,
				canContinueToSeatValidation: false,
				priceAcceptanceRequired: false,
				blockingReason: "unavailable",
			}
	}
}
