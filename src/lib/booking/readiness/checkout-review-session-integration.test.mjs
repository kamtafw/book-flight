import assert from "node:assert/strict"
import test from "node:test"

import { useFlightBookingStore } from "@/store/flight-booking.store"
import { createOfferReviewOutcome } from "./offer-review"

function makeOffer(id, priceAmount = "100.00") {
	return {
		id,
		airline: "Example Air",
		flightNumber: "EA 101",
		departureTime: "2030-05-21T08:30:00Z",
		arrivalTime: "2030-05-21T09:45:00Z",
		duration: "1h 15m",
		price: Number(priceAmount),
		priceAmount,
		currency: "USD",
		expiresAt: "2030-05-21T10:00:00Z",
		operatingCarrierNames: ["Example Air"],
		passengers: [{ id: "pas_adult", type: "adult", age: 30 }],
		slices: [
			{
				originCode: "LOS",
				destinationCode: "ABV",
				duration: "1h 15m",
				segments: [
					{
						id: "seg-1",
						departureAirportCode: "LOS",
						departureAirportName: "Lagos",
						departureAt: "2030-05-21T08:30:00Z",
						arrivalAirportCode: "ABV",
						arrivalAirportName: "Abuja",
						arrivalAt: "2030-05-21T09:45:00Z",
						marketingCarrierName: "Example Air",
						marketingCarrierCode: "EA",
						operatingCarrierName: "Example Air",
						operatingCarrierCode: "EA",
						flightNumber: "101",
						duration: "1h 15m",
					},
				],
			},
		],
	}
}

function prepareReview({ changedFare = false } = {}) {
	const store = useFlightBookingStore
	store.getState().abandonBookingSession()

	const original = makeOffer("offer-selected", "100.00")
	store.getState().beginBookingSession({ id: original.id })
	store.getState().initializePassengerCollection(original)
	store.getState().getOrCreateCheckoutReviewSession(original.id)

	const attempt = store.getState().startOfferReviewRefresh()
	assert.ok(attempt)

	const refreshed = makeOffer(
		changedFare ? "offer-refreshed" : original.id,
		changedFare ? "110.00" : "100.00",
	)
	const response = changedFare
		? {
				status: "price_changed",
				previousPrice: { amount: "100.00", currency: "USD" },
				currentPrice: { amount: "110.00", currency: "USD" },
				offer: refreshed,
			}
		: { status: "valid", offer: refreshed }
	const outcome = createOfferReviewOutcome(original, response)
	assert.equal(store.getState().completeOfferReviewRefresh(attempt, outcome), true)

	if (changedFare) {
		assert.equal(store.getState().acceptCurrentFlightFareChange("2030-01-01T00:00:00.000Z"), true)
	}

	return { store, original }
}

function seat(id, designator, amount = "25.00") {
	return {
		id,
		offerId: "offer-selected",
		passengerId: "pas_adult",
		segmentId: "seg-1",
		seatDesignator: designator,
		seatName: "Window",
		totalAmount: amount,
		totalCurrency: "USD",
		disclosures: [],
	}
}

test("passenger edits preserve the active booking/review session and current offer validation", () => {
	const { store } = prepareReview({ changedFare: true })
	const before = store.getState()
	const bookingSessionId = before.activeBookingSession.id
	const reviewSessionId = before.checkoutReviewSession.id
	const offerLifecycle = before.offerReviewLifecycle

	assert.equal(store.getState().isCurrentFlightFareAccepted(), true)
	assert.equal(
		store.getState().startSeatReviewValidation("2030-05-21T10:00:00Z").kind,
		"not_selected",
	)

	const passengerId = store.getState().passengerCollection.passengers[0].id
	store.getState().updatePassengerIdentity(passengerId, { givenName: "Updated" })

	const after = store.getState()
	assert.equal(after.activeBookingSession.id, bookingSessionId)
	assert.equal(after.checkoutReviewSession.id, reviewSessionId)
	assert.equal(after.offerReviewLifecycle, offerLifecycle)
	assert.equal(after.seatReviewLifecycle.status, "not_selected")
	assert.equal(after.passengerCollection.passengers[0].identity.givenName, "Updated")
	assert.equal(after.isCurrentFlightFareAccepted(), true)

	const sameBookingSessionId = after.beginBookingSession({ id: "offer-selected" })
	assert.equal(sameBookingSessionId, bookingSessionId)
	assert.equal(store.getState().checkoutReviewSession.id, reviewSessionId)
})

test("changing a seat invalidates only the seat snapshot while preserving accepted flight fare", () => {
	const { store } = prepareReview({ changedFare: true })
	const first = seat("service-1", "12A")
	store.getState().selectOutboundSeatService(first)

	const firstAttempt = store.getState().startSeatReviewValidation("2030-05-21T10:00:00Z")
	assert.equal(firstAttempt.kind, "started")
	assert.equal(store.getState().seatReviewLifecycle.status, "validating")

	const offerLifecycle = store.getState().offerReviewLifecycle
	const replacement = seat("service-2", "14C")
	store.getState().selectOutboundSeatService(replacement)

	assert.equal(store.getState().offerReviewLifecycle, offerLifecycle)
	assert.equal(store.getState().isCurrentFlightFareAccepted(), true)
	assert.equal(store.getState().getCurrentSeatAcceptanceRequirements(), null)

	const replacementAttempt = store.getState().startSeatReviewValidation("2030-05-21T10:00:00Z")
	assert.equal(replacementAttempt.kind, "started")
	assert.notEqual(replacementAttempt.attempt.attemptId, firstAttempt.attempt.attemptId)
	assert.equal(
		replacementAttempt.attempt.snapshotKey,
		store.getState().seatReviewLifecycle.snapshotKey,
	)
})

test("a new offer starts a clean booking session and clears review-specific state", () => {
	const { store } = prepareReview({ changedFare: true })
	store.getState().selectOutboundSeatService(seat("service-1", "12A"))
	store.getState().startSeatReviewValidation("2030-05-21T10:00:00Z")

	store.getState().beginBookingSession({ id: "offer-next" })
	const state = store.getState()

	assert.equal(state.activeBookingSession.offerId, "offer-next")
	assert.equal(state.checkoutReviewSession, null)
	assert.equal(state.passengerCollection, null)
	assert.deepEqual(state.selectedOutboundSeatServices, [])
	assert.equal(state.offerReviewLifecycle, null)
	assert.equal(state.seatReviewLifecycle, null)
	assert.equal(state.flightFareAcceptance, null)
	assert.deepEqual(state.seatPriceAcceptances, [])
	assert.deepEqual(state.seatDisclosureAcknowledgements, [])
})

test("abandoning a booking clears booking and review state", () => {
	const { store } = prepareReview({ changedFare: true })
	store.getState().selectOutboundSeatService(seat("service-1", "12A"))
	store.getState().abandonBookingSession()

	const state = store.getState()
	assert.equal(state.activeBookingSession, null)
	assert.equal(state.checkoutReviewSession, null)
	assert.equal(state.passengerCollection, null)
	assert.deepEqual(state.selectedOutboundSeatServices, [])
	assert.equal(state.offerReviewLifecycle, null)
	assert.equal(state.seatReviewLifecycle, null)
	assert.equal(state.flightFareAcceptance, null)
	assert.deepEqual(state.seatPriceAcceptances, [])
	assert.deepEqual(state.seatDisclosureAcknowledgements, [])
})
