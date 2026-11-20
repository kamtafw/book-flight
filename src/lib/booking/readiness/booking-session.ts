export interface ActiveBookingSession {
	id: string
	offerId: string
}

export interface CheckoutReviewSession {
	id: string
	bookingSessionId: string
	offerId: string
}

export interface BookingSessionState {
	activeBookingSession: ActiveBookingSession | null
	checkoutReviewSession: CheckoutReviewSession | null
	selectedOutboundSeats: string[]
	selectedOutboundSeatServices: unknown[]
	passengerCollection: unknown | null
}

type BookingSessionFields<T extends BookingSessionState> = {
	activeBookingSession: ActiveBookingSession | null
	checkoutReviewSession: CheckoutReviewSession | null
	selectedOutboundSeats: T["selectedOutboundSeats"]
	selectedOutboundSeatServices: T["selectedOutboundSeatServices"]
	passengerCollection: T["passengerCollection"]
}

/**
 * Starts a new in-memory booking session when the selected offer changes.
 * Re-entering the same active offer is treated as navigation within the
 * existing session and preserves all booking-specific data.
 */
export function transitionBookingSession<T extends BookingSessionState>(
	state: T,
	offerId: string,
	createSessionId: () => string,
): Omit<T, keyof BookingSessionFields<T>> & BookingSessionFields<T> {
	if (!offerId.trim()) throw new Error("A valid offer ID is required.")

	if (state.activeBookingSession?.offerId === offerId) return state

	return {
		...state,
		activeBookingSession: { id: createSessionId(), offerId },
		checkoutReviewSession: null,
		selectedOutboundSeats: [],
		selectedOutboundSeatServices: [],
		passengerCollection: null,
	}
}

/** Clears only booking-session data; search criteria/results remain untouched. */
export function clearBookingSessionState<T extends BookingSessionState>(
	state: T,
): Omit<T, keyof BookingSessionFields<T>> & BookingSessionFields<T> {
	return {
		...state,
		activeBookingSession: null,
		checkoutReviewSession: null,
		selectedOutboundSeats: [],
		selectedOutboundSeatServices: [],
		passengerCollection: null,
	}
}

/** Returns the existing review identity for this booking or creates one. */
export function getOrCreateCheckoutReviewSession(
	activeBookingSession: ActiveBookingSession | null,
	currentReviewSession: CheckoutReviewSession | null,
	offerId: string,
	createSessionId: () => string,
): CheckoutReviewSession | null {
	if (!activeBookingSession || activeBookingSession.offerId !== offerId) return null
	if (
		currentReviewSession?.bookingSessionId === activeBookingSession.id &&
		currentReviewSession.offerId === offerId
	) {
		return currentReviewSession
	}
	return {
		id: createSessionId(),
		bookingSessionId: activeBookingSession.id,
		offerId,
	}
}

/** A review identity is usable only within the exact active booking session and offer. */
export function isCheckoutReviewSessionCurrent(
	reviewSession: CheckoutReviewSession | null,
	activeBookingSession: ActiveBookingSession | null,
	offerId: string | undefined,
): boolean {
	return Boolean(
		reviewSession &&
		activeBookingSession &&
		offerId &&
		reviewSession.bookingSessionId === activeBookingSession.id &&
		reviewSession.offerId === offerId &&
		activeBookingSession.offerId === offerId,
	)
}
