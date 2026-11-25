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
		slices: [{
			originCode: "LOS",
			destinationCode: "ABV",
			duration: "1h 15m",
			segments: [{
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
			}],
		}],
	}
}

function prepareReview() {
	const store = useFlightBookingStore
	store.getState().abandonBookingSession()
	const offer = makeOffer("offer-selected")
	store.getState().beginBookingSession({ id: offer.id })
	store.getState().initializePassengerCollection(offer)
	store.getState().getOrCreateCheckoutReviewSession(offer.id)
	const attempt = store.getState().startOfferReviewRefresh()
	assert.ok(attempt)
	const outcome = createOfferReviewOutcome(offer, { status: "valid", offer })
	assert.equal(store.getState().completeOfferReviewRefresh(attempt, outcome), true)
	return { store, offer }
}

function makeSeat(designator, id = `service-${designator}`) {
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

function validSeatOutcome(selection) {
	return {
		status: "valid",
		selections: [{
			status: "valid",
			selection,
			current: {
				serviceId: selection.id,
				passengerId: selection.passengerId,
				segmentId: selection.segmentId,
				seatDesignator: selection.seatDesignator,
				seatName: selection.seatName,
				disclosures: [],
				amount: selection.totalAmount,
				currency: selection.totalCurrency,
			},
		}],
	}
}

function deferred() {
	let resolve
	let reject
	const promise = new Promise((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

function startNewOfferReview(store, offer) {
	store.getState().beginBookingSession({ id: offer.id })
	store.getState().initializePassengerCollection(offer)
	store.getState().getOrCreateCheckoutReviewSession(offer.id)
	return store.getState().startOfferReviewRefresh()
}

test("overlapping review focus events cannot start duplicate provider requests", () => {
	const { store, offer } = prepareReview()
	const offerAttempt = store.getState().startOfferReviewRefresh()
	assert.ok(offerAttempt)
	assert.equal(store.getState().startOfferReviewRefresh(), null)
	assert.equal(store.getState().offerReviewLifecycle.attemptId, offerAttempt.attemptId)

	const selected = makeSeat("12A")
	store.getState().selectOutboundSeatService(selected)
	const seatAttempt = store.getState().startSeatReviewValidation(offer.expiresAt)
	assert.equal(seatAttempt.kind, "started")
	assert.equal(store.getState().startSeatReviewValidation(offer.expiresAt).kind, "blocked")
	assert.equal(store.getState().seatReviewLifecycle.attemptId, seatAttempt.attempt.attemptId)
})

test("a delayed offer-refresh success from an earlier booking cannot replace the current attempt", async () => {
	const { store, offer } = prepareReview()
	const oldAttempt = store.getState().startOfferReviewRefresh()
	assert.ok(oldAttempt)
	const pending = deferred()
	const oldRequest = pending.promise.then((response) =>
		store.getState().completeOfferReviewRefresh(
			oldAttempt,
			createOfferReviewOutcome(offer, response),
		),
	)

	const nextOffer = makeOffer("offer-next")
	const currentAttempt = startNewOfferReview(store, nextOffer)
	assert.ok(currentAttempt)
	pending.resolve({ status: "valid", offer })
	assert.equal(await oldRequest, false)
	assert.equal(store.getState().offerReviewLifecycle.attemptId, currentAttempt.attemptId)
	assert.equal(store.getState().offerReviewLifecycle.status, "refreshing")

	const currentOutcome = createOfferReviewOutcome(nextOffer, {
		status: "valid",
		offer: nextOffer,
	})
	assert.equal(store.getState().completeOfferReviewRefresh(currentAttempt, currentOutcome), true)
})

test("a delayed offer-refresh failure from an earlier booking cannot overwrite the current attempt", async () => {
	const { store } = prepareReview()
	const oldAttempt = store.getState().startOfferReviewRefresh()
	assert.ok(oldAttempt)
	const pending = deferred()
	const oldRequest = pending.promise.catch((error) =>
		store.getState().failOfferReviewRefresh(oldAttempt, error.message),
	)

	const nextOffer = makeOffer("offer-next")
	const currentAttempt = startNewOfferReview(store, nextOffer)
	assert.ok(currentAttempt)
	pending.reject(new Error("Old request failed"))
	assert.equal(await oldRequest, false)
	assert.equal(store.getState().offerReviewLifecycle.attemptId, currentAttempt.attemptId)
	assert.equal(store.getState().offerReviewLifecycle.status, "refreshing")
})

test("a delayed seat-validation success for a replaced seat cannot complete the current validation", async () => {
	const { store, offer } = prepareReview()
	const originalSeat = makeSeat("12A")
	store.getState().selectOutboundSeatService(originalSeat)
	const oldStart = store.getState().startSeatReviewValidation(offer.expiresAt)
	assert.equal(oldStart.kind, "started")
	const pending = deferred()
	const oldRequest = pending.promise.then((outcome) =>
		store.getState().completeSeatReviewValidation(oldStart.attempt, outcome),
	)

	const replacementSeat = makeSeat("14C")
	store.getState().selectOutboundSeatService(replacementSeat)
	const currentStart = store.getState().startSeatReviewValidation(offer.expiresAt)
	assert.equal(currentStart.kind, "started")
	pending.resolve(validSeatOutcome(originalSeat))
	assert.equal(await oldRequest, false)
	assert.equal(store.getState().seatReviewLifecycle.attemptId, currentStart.attempt.attemptId)
	assert.equal(store.getState().seatReviewLifecycle.status, "validating")
	assert.equal(
		store.getState().completeSeatReviewValidation(
			currentStart.attempt,
			validSeatOutcome(replacementSeat),
		),
		true,
	)
})

test("a delayed seat-validation failure for a replaced seat cannot fail the current validation", async () => {
	const { store, offer } = prepareReview()
	const originalSeat = makeSeat("12A")
	store.getState().selectOutboundSeatService(originalSeat)
	const oldStart = store.getState().startSeatReviewValidation(offer.expiresAt)
	assert.equal(oldStart.kind, "started")
	const pending = deferred()
	const oldRequest = pending.promise.catch((error) =>
		store.getState().failSeatReviewValidation(oldStart.attempt, error.message),
	)

	const replacementSeat = makeSeat("14C")
	store.getState().selectOutboundSeatService(replacementSeat)
	const currentStart = store.getState().startSeatReviewValidation(offer.expiresAt)
	assert.equal(currentStart.kind, "started")
	pending.reject(new Error("Old seat request failed"))
	assert.equal(await oldRequest, false)
	assert.equal(store.getState().seatReviewLifecycle.attemptId, currentStart.attempt.attemptId)
	assert.equal(store.getState().seatReviewLifecycle.status, "validating")
})
