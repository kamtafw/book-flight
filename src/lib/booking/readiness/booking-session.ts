export interface ActiveBookingSession {
	id: string
	offerId: string
}

export interface BookingSessionState {
	activeBookingSession: ActiveBookingSession | null
	selectedOutboundSeats: string[]
	selectedOutboundSeatServices: unknown[]
	passengerCollection: unknown | null
}

type BookingSessionFields<T extends BookingSessionState> = {
	activeBookingSession: ActiveBookingSession | null
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
		selectedOutboundSeats: [],
		selectedOutboundSeatServices: [],
		passengerCollection: null,
	}
}
