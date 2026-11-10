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

export interface BookingSessionReset {
	activeBookingSession: null
	selectedOutboundSeats: []
	selectedOutboundSeatServices: []
	passengerCollection: null
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
): Omit<T, keyof BookingSessionReset> & {
	activeBookingSession: ActiveBookingSession
	selectedOutboundSeats: string[]
	selectedOutboundSeatServices: unknown[]
	passengerCollection: unknown | null
} {
	if (!offerId.trim()) throw new Error("A valid offer ID is required.")

	if (state.activeBookingSession?.offerId === offerId) {
		return state as Omit<T, keyof BookingSessionReset> & {
			activeBookingSession: ActiveBookingSession
			selectedOutboundSeats: string[]
			selectedOutboundSeatServices: unknown[]
			passengerCollection: unknown | null
		}
	}

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
): Omit<T, keyof BookingSessionReset> & BookingSessionReset {
	return {
		...state,
		activeBookingSession: null,
		selectedOutboundSeats: [],
		selectedOutboundSeatServices: [],
		passengerCollection: null,
	}
}
