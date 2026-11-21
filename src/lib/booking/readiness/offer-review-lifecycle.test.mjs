import assert from "node:assert/strict"
import test from "node:test"

import {
	isOfferReviewAttemptCurrent,
	isOfferReviewLifecycleForSession,
	shouldStartOfferReviewRefresh,
} from "./offer-review-lifecycle.ts"

const identity = {
	reviewSessionId: "review-1",
	bookingSessionId: "booking-1",
	offerId: "off_123",
}

const originalOffer = {
	id: "off_123",
	airline: "Airline",
	flightNumber: "AB123",
	departureTime: "2026-12-01T08:00:00+00:00",
	arrivalTime: "2026-12-01T10:00:00+00:00",
	duration: "2h",
	price: 100,
	priceAmount: "100.00",
	currency: "USD",
	expiresAt: "2026-12-01T07:00:00+00:00",
	operatingCarrierNames: [],
	passengers: [{ id: "pas_123", type: "adult", age: 30 }],
	slices: [
		{
			originCode: "LOS",
			destinationCode: "ABV",
			duration: "2h",
			segments: [
				{
					id: "seg_123",
					departureAirportCode: "LOS",
					departureAirportName: "Lagos",
					departureAt: "2026-12-01T08:00:00+00:00",
					arrivalAirportCode: "ABV",
					arrivalAirportName: "Abuja",
					arrivalAt: "2026-12-01T10:00:00+00:00",
					marketingCarrierName: "Airline",
					marketingCarrierCode: "AB",
					operatingCarrierName: "Airline",
					operatingCarrierCode: "AB",
					flightNumber: "123",
					duration: "2h",
				},
			],
		},
	],
}

const validOutcome = {
	status: "valid",
	originalOffer,
	currentOffer: { ...originalOffer, expiresAt: "2026-12-01T07:00:00+00:00" },
	canContinueToSeatValidation: true,
	priceAcceptanceRequired: false,
}

function lifecycle(patch = {}) {
	return {
		...identity,
		attemptId: "attempt-1",
		attemptNumber: 1,
		status: "ready",
		outcome: validOutcome,
		errorMessage: null,
		...patch,
	}
}

test("review lifecycle is isolated to the exact review, booking and offer", () => {
	assert.equal(isOfferReviewLifecycleForSession(lifecycle(), identity), true)
	assert.equal(
		isOfferReviewLifecycleForSession(lifecycle(), { ...identity, bookingSessionId: "booking-2" }),
		false,
	)
	assert.equal(
		isOfferReviewLifecycleForSession(lifecycle(), { ...identity, reviewSessionId: "review-2" }),
		false,
	)
	assert.equal(
		isOfferReviewLifecycleForSession(lifecycle(), { ...identity, offerId: "off_456" }),
		false,
	)
})

test("only the active attempt can complete an in-flight refresh", () => {
	const current = lifecycle({ status: "refreshing", outcome: null })
	assert.equal(
		isOfferReviewAttemptCurrent(current, {
			...identity,
			attemptId: "attempt-1",
			attemptNumber: 1,
		}),
		true,
	)
	assert.equal(
		isOfferReviewAttemptCurrent(current, {
			...identity,
			attemptId: "attempt-old",
			attemptNumber: 1,
		}),
		false,
	)
	assert.equal(
		isOfferReviewAttemptCurrent(current, {
			...identity,
			attemptId: "attempt-1",
			attemptNumber: 2,
		}),
		false,
	)
})

test("starts a refresh when there is no matching lifecycle", () => {
	assert.equal(
		shouldStartOfferReviewRefresh(null, identity, Date.parse("2026-11-01T00:00:00Z")),
		true,
	)
	assert.equal(
		shouldStartOfferReviewRefresh(lifecycle(), { ...identity, bookingSessionId: "booking-2" }),
		true,
	)
})

test("reuses successful results only while the provider offer is unexpired", () => {
	assert.equal(
		shouldStartOfferReviewRefresh(lifecycle(), identity, Date.parse("2026-11-30T00:00:00Z")),
		false,
	)
	assert.equal(
		shouldStartOfferReviewRefresh(lifecycle(), identity, Date.parse("2026-12-01T07:00:00Z")),
		true,
	)
})

test("does not auto-loop after a technical error or restart a blocked business outcome", () => {
	assert.equal(
		shouldStartOfferReviewRefresh(lifecycle({ status: "error", outcome: null }), identity),
		false,
	)
	assert.equal(
		shouldStartOfferReviewRefresh(
			lifecycle({ status: "retry_exhausted", outcome: null }),
			identity,
		),
		false,
	)
	assert.equal(
		shouldStartOfferReviewRefresh(
			lifecycle({
				status: "unavailable",
				outcome: {
					status: "unavailable",
					originalOffer,
					code: "OFFER_UNAVAILABLE",
					message: "Unavailable",
					canContinueToSeatValidation: false,
					priceAcceptanceRequired: false,
					blockingReason: "unavailable",
				},
			}),
			identity,
		),
		false,
	)
})
