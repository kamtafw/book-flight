import type { FlightOffer } from "@/lib/flights/types"
import type { ActiveBookingSession } from "./booking-session"
import { getBookingReadiness } from "./booking-readiness"
import type { PassengerCollection } from "../passengers/passenger-domain"

export type CheckoutReviewEntryState =
	| "flight_unavailable"
	| "booking_session_unavailable"
	| "passenger_details_incomplete"
	| "ready"

export function getCheckoutReviewEntryState(
	flightId: string | undefined,
	offer: FlightOffer | undefined,
	activeBookingSession: ActiveBookingSession | null,
	passengerCollection: PassengerCollection | null,
): CheckoutReviewEntryState {
	if (!flightId || !offer || offer.id !== flightId) return "flight_unavailable"
	if (!activeBookingSession || activeBookingSession.offerId !== flightId) {
		return "booking_session_unavailable"
	}
	if (!passengerCollection) return "passenger_details_incomplete"

	const readiness = getBookingReadiness(offer, passengerCollection)
	return readiness.status === "ready_for_order_preparation" && readiness.offerId === flightId
		? "ready"
		: "passenger_details_incomplete"
}
