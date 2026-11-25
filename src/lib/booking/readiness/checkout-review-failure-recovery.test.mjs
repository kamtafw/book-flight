import assert from "node:assert/strict"
import test from "node:test"

import { useFlightBookingStore } from "@/store/flight-booking.store"
import { createOfferReviewOutcome } from "./offer-review"
import { shouldStartOfferReviewRefresh } from "./offer-review-lifecycle"

function makeOffer(id = "offer-selected", priceAmount = "100.00") {
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

function makeSeat(id = "service-1", designator = "12A") {
	return {
		id,
		offerId: "offer-selected",
		passengerId: "pas_adult",
		segmentId: "seg-1",
		seatDesignator: designator,
		seatName: "Window",
		totalAmount: "25.00",
		totalCurrency: "USD",
		disclosures: [],
	}
}

function prepareReview() {
	const store = useFlightBookingStore
	store.getState().abandonBookingSession()
	const offer = makeOffer()
	store.getState().beginBookingSession({ id: offer.id })
	store.getState().initializePassengerCollection(offer)
	store.getState().getOrCreateCheckoutReviewSession(offer.id)

	const attempt = store.getState().startOfferReviewRefresh()
	assert.ok(attempt)
	const outcome = createOfferReviewOutcome(offer, { status: "valid", offer })
	assert.equal(store.getState().completeOfferReviewRefresh(attempt, outcome), true)
	return { store, offer }
}

function startOfferFailure(store, message = "Network unavailable") {
	const attempt = store.getState().startOfferReviewRefresh()
	assert.ok(attempt)
	assert.equal(store.getState().failOfferReviewRefresh(attempt, message), true)
	return store.getState().offerReviewLifecycle
}

function unavailableOutcome(offer) {
	return createOfferReviewOutcome(offer, {
		status: "unavailable",
		code: "OFFER_UNAVAILABLE",
		message: "The provider can no longer offer this flight.",
	})
}

function itineraryChangedOutcome(offer) {
	return createOfferReviewOutcome(offer, {
		status: "itinerary_changed",
		offer: makeOffer("offer-refreshed"),
		materialDifferences: ["The departure time changed."],
		priceChanged: false,
		previousPrice: { amount: "100.00", currency: "USD" },
		currentPrice: { amount: "100.00", currency: "USD" },
	})
}

test("offer refresh allows only three explicit technical attempts and preserves the booking draft", () => {
	const { store } = prepareReview()
	const passengerId = store.getState().passengerCollection.passengers[0].id
	store.getState().updatePassengerIdentity(passengerId, { givenName: "Tiva" })
	store.getState().selectOutboundSeatService(makeSeat())

	for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber += 1) {
		const lifecycle = startOfferFailure(store)
		assert.equal(lifecycle.attemptNumber, attemptNumber)
		assert.equal(
			lifecycle.status,
			attemptNumber === 3 ? "retry_exhausted" : "error",
		)
		assert.equal(
			shouldStartOfferReviewRefresh(lifecycle, {
				reviewSessionId: lifecycle.reviewSessionId,
				bookingSessionId: lifecycle.bookingSessionId,
				offerId: lifecycle.offerId,
			}),
			false,
		)
		if (attemptNumber < 3) {
			const retry = store.getState().startOfferReviewRefresh()
			assert.equal(retry?.attemptNumber, attemptNumber + 1)
		}
	}

	const state = store.getState()
	assert.equal(state.offerReviewLifecycle.status, "retry_exhausted")
	assert.equal(state.passengerCollection.passengers[0].identity.givenName, "Tiva")
	assert.equal(state.selectedOutboundSeatServices.length, 1)
	assert.equal(state.activeBookingSession.offerId, "offer-selected")
	assert.equal(state.checkoutReviewSession.offerId, "offer-selected")
	assert.equal(state.startOfferReviewRefresh(), null)
})

test("returning to search clears failed validation state but preserves the draft for a fresh review", () => {
	const { store } = prepareReview()
	const passengerId = store.getState().passengerCollection.passengers[0].id
	store.getState().updatePassengerIdentity(passengerId, { givenName: "Tiva" })
	store.getState().selectOutboundSeatService(makeSeat())
	startOfferFailure(store)

	const before = store.getState()
	const bookingSessionId = before.activeBookingSession.id
	const reviewSessionId = before.checkoutReviewSession.id

	store.getState().clearOfferReviewLifecycle()
	const cleared = store.getState()
	assert.equal(cleared.offerReviewLifecycle, null)
	assert.equal(cleared.seatReviewLifecycle, null)
	assert.equal(cleared.activeBookingSession.id, bookingSessionId)
	assert.equal(cleared.checkoutReviewSession.id, reviewSessionId)
	assert.equal(cleared.passengerCollection.passengers[0].identity.givenName, "Tiva")
	assert.equal(cleared.selectedOutboundSeatServices.length, 1)

	const retry = store.getState().startOfferReviewRefresh()
	assert.equal(retry.attemptNumber, 1)
	assert.equal(store.getState().offerReviewLifecycle.status, "refreshing")
})

test("seat validation allows three explicit technical attempts without repeating successful offer refresh", () => {
	const { store } = prepareReview()
	store.getState().selectOutboundSeatService(makeSeat())
	const offerLifecycle = store.getState().offerReviewLifecycle
	const expiry = offerLifecycle.outcome.currentOffer.expiresAt

	for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber += 1) {
		const started = store.getState().startSeatReviewValidation(expiry, attemptNumber > 1)
		assert.equal(started.kind, "started")
		assert.equal(started.attempt.attemptNumber, attemptNumber)
		assert.equal(
			store.getState().failSeatReviewValidation(started.attempt, "Seat provider unavailable"),
			true,
		)
		assert.equal(
			store.getState().seatReviewLifecycle.status,
			attemptNumber === 3 ? "retry_exhausted" : "error",
		)
		assert.equal(store.getState().offerReviewLifecycle, offerLifecycle)
		assert.equal(store.getState().startOfferReviewRefresh(), null)
		if (attemptNumber === 1) {
			assert.equal(store.getState().startSeatReviewValidation(expiry).kind, "blocked")
		}
	}

	const state = store.getState()
	assert.equal(state.seatReviewLifecycle.status, "retry_exhausted")
	assert.equal(state.selectedOutboundSeatServices.length, 1)
	assert.equal(state.passengerCollection.passengers.length, 1)
	assert.equal(store.getState().startSeatReviewValidation(expiry, true).kind, "blocked")
})

test("changing the selected seat after a technical failure starts a fresh validation cycle", () => {
	const { store } = prepareReview()
	store.getState().selectOutboundSeatService(makeSeat())
	const first = store.getState().startSeatReviewValidation("2030-05-21T10:00:00Z")
	assert.equal(first.kind, "started")
	assert.equal(store.getState().failSeatReviewValidation(first.attempt, "Temporary provider error"), true)
	assert.equal(store.getState().seatReviewLifecycle.status, "error")

	store.getState().selectOutboundSeatService(makeSeat("service-2", "14C"))
	const replacement = store.getState().startSeatReviewValidation("2030-05-21T10:00:00Z")
	assert.equal(replacement.kind, "started")
	assert.equal(replacement.attempt.attemptNumber, 1)
	assert.notEqual(replacement.attempt.snapshotKey, first.attempt.snapshotKey)
	assert.equal(store.getState().offerReviewLifecycle.status, "ready")
})

test("unavailable and itinerary-changed offers are business blocks, not technical retry states", () => {
	for (const outcomeFactory of [unavailableOutcome, itineraryChangedOutcome]) {
		const { store, offer } = prepareReview()
		const attempt = store.getState().startOfferReviewRefresh( undefined, true )
		assert.ok(attempt)
		assert.equal(store.getState().completeOfferReviewRefresh(attempt, outcomeFactory(offer)), true)
		const lifecycle = store.getState().offerReviewLifecycle
		assert.equal(lifecycle.status, outcomeFactory === unavailableOutcome ? "unavailable" : "itinerary_changed")
		assert.equal(store.getState().startOfferReviewRefresh(), null)
	}
})

test("an unavailable seat remains a customer-action outcome and cannot be retried as a technical failure", () => {
	const { store } = prepareReview()
	const selected = makeSeat()
	store.getState().selectOutboundSeatService(selected)
	const started = store.getState().startSeatReviewValidation("2030-05-21T10:00:00Z")
	assert.equal(started.kind, "started")

	const unavailableSeatOutcome = {
		status: "action_required",
		selections: [
			{
				status: "unavailable",
				selection: selected,
				reason: "seat_unavailable",
			},
		],
	}
	assert.equal(store.getState().completeSeatReviewValidation(started.attempt, unavailableSeatOutcome), true)
	assert.equal(store.getState().seatReviewLifecycle.status, "action_required")
	assert.equal(
		store.getState().startSeatReviewValidation("2030-05-21T10:00:00Z", true).kind,
		"reuse",
	)
	assert.equal(store.getState().offerReviewLifecycle.status, "ready")
})
