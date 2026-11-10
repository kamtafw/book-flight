import type { FlightOffer } from "@/lib/flights/types"
import type { PassengerCollection } from "../passengers/passenger-domain"
import {
	validateDuffelPassengers,
	type PassengerValidationIssue,
} from "../passengers/providers/duffel/passenger-validation"

export type BookingReadinessStatus = "incomplete" | "ready_for_order_preparation"

export interface BookingPassengerIdentity {
	internalPassengerId: string
	providerPassengerId: string
}

export interface BookingReadinessResult {
	status: BookingReadinessStatus
	offerId: string | null
	passengers: BookingPassengerIdentity[]
	issues: PassengerValidationIssue[]
}

/**
 * Derives booking readiness from the exact selected offer and its passenger
 * collection. This is a client-side preparation gate only; it does not assert
 * offer freshness, seat availability, provider acceptance, or booking success.
 */
export function getBookingReadiness(
	offer: FlightOffer | null | undefined,
	collection: PassengerCollection | null | undefined,
	options: { today?: string } = {},
): BookingReadinessResult {
	if (!offer || !collection) {
		return {
			status: "incomplete",
			offerId: offer?.id ?? null,
			passengers: [],
			issues: [],
		}
	}

	try {
		const passengers = Array.isArray(collection.passengers)
			? collection.passengers.map((passenger) => ({
					internalPassengerId: passenger.id,
					providerPassengerId:
						Array.isArray(passenger.providerReferences) && passenger.providerReferences.length === 1
							? passenger.providerReferences[0].providerPassengerId
							: "",
				}))
			: []
		const validation = validateDuffelPassengers(offer, collection, options)
		return {
			status: validation.status === "provider_ready"
				? "ready_for_order_preparation"
				: "incomplete",
			offerId: offer.id,
			passengers,
			issues: validation.issues,
		}
	} catch {
		return {
			status: "incomplete",
			offerId: offer.id,
			passengers: [],
			issues: [{
				code: "READINESS_UNAVAILABLE",
				stage: "provider",
				severity: "error",
				message: "Booking readiness could not be evaluated for this offer.",
			}],
		}
	}
}
