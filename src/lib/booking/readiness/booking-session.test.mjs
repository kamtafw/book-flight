import assert from "node:assert/strict"
import test from "node:test"
import {
	clearBookingSessionState,
	transitionBookingSession,
} from "./booking-session.ts"

function makeState(overrides = {}) {
	return {
		activeBookingSession: { id: "session-1", offerId: "off_1" },
		selectedOutboundSeats: ["12A"],
		selectedOutboundSeatServices: [{ id: "service-1" }],
		passengerCollection: { passengers: [{ id: "passenger-1" }] },
		searchCriteria: { origin: "LOS", destination: "LHR" },
		cachedOffers: [{ id: "off_1" }],
		...overrides,
	}
}

test("re-entering the same offer preserves the active session and booking data", () => {
	const state = makeState()
	const result = transitionBookingSession(state, "off_1", () => "session-2")
	assert.equal(result.activeBookingSession.id, "session-1")
	assert.equal(result.passengerCollection, state.passengerCollection)
	assert.equal(result.selectedOutboundSeatServices, state.selectedOutboundSeatServices)
	assert.equal(result.selectedOutboundSeats, state.selectedOutboundSeats)
})

test("starting a different offer creates a new session and clears old booking data", () => {
	const state = makeState()
	const result = transitionBookingSession(state, "off_2", () => "session-2")
	assert.deepEqual(result.activeBookingSession, { id: "session-2", offerId: "off_2" })
	assert.equal(result.passengerCollection, null)
	assert.deepEqual(result.selectedOutboundSeatServices, [])
	assert.deepEqual(result.selectedOutboundSeats, [])
	assert.equal(result.searchCriteria, state.searchCriteria)
	assert.equal(result.cachedOffers, state.cachedOffers)
})

test("starting a session without an active session initializes a clean session", () => {
	const state = makeState({
		activeBookingSession: null,
		selectedOutboundSeats: ["8C"],
		selectedOutboundSeatServices: [{ id: "old-service" }],
		passengerCollection: { passengers: [{ id: "old-passenger" }] },
	})
	const result = transitionBookingSession(state, "off_3", () => "session-3")
	assert.deepEqual(result.activeBookingSession, { id: "session-3", offerId: "off_3" })
	assert.deepEqual(result.selectedOutboundSeats, [])
	assert.deepEqual(result.selectedOutboundSeatServices, [])
	assert.equal(result.passengerCollection, null)
})

test("rejects an empty offer identity", () => {
	assert.throws(() => transitionBookingSession(makeState(), " ", () => "session-2"))
})

test("abandonment clears booking data but preserves search and cached offers", () => {
	const state = makeState()
	const result = clearBookingSessionState(state)
	assert.equal(result.activeBookingSession, null)
	assert.equal(result.passengerCollection, null)
	assert.deepEqual(result.selectedOutboundSeatServices, [])
	assert.deepEqual(result.selectedOutboundSeats, [])
	assert.equal(result.searchCriteria, state.searchCriteria)
	assert.equal(result.cachedOffers, state.cachedOffers)
})

test("cleanup is idempotent", () => {
	const once = clearBookingSessionState(makeState())
	const twice = clearBookingSessionState(once)
	assert.deepEqual(twice, once)
})