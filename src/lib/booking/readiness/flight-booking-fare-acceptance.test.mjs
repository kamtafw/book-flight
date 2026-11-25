import assert from "node:assert/strict"
import test from "node:test"
import { createOfferReviewOutcome } from "./offer-review"
import { useFlightBookingStore } from "@/store/flight-booking.store"

function makeOffer(id, priceAmount, currency = "USD") {
	return {
		id,
		airline: "Example Air",
		flightNumber: "EA 101",
		departureTime: "2027-05-21T08:30:00Z",
		arrivalTime: "2027-05-21T09:45:00Z",
		duration: "1h 15m",
		price: Number(priceAmount),
		priceAmount,
		currency,
		expiresAt: "2027-05-21T10:00:00Z",
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
				departureAt: "2027-05-21T08:30:00Z",
				arrivalAirportCode: "ABV",
				arrivalAirportName: "Abuja",
				arrivalAt: "2027-05-21T09:45:00Z",
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

function prepareReview(original, response) {
	const store = useFlightBookingStore
	store.getState().abandonBookingSession()
	store.getState().beginBookingSession({ id: original.id })
	store.getState().getOrCreateCheckoutReviewSession(original.id)
	const attempt = store.getState().startOfferReviewRefresh()
	assert.ok(attempt)
	const outcome = createOfferReviewOutcome(original, response)
	assert.equal(store.getState().completeOfferReviewRefresh(attempt, outcome), true)
	return store
}

test("store records explicit acceptance for the current refreshed fare", () => {
	const original = makeOffer("offer-selected", "100.00")
	const refreshed = makeOffer("offer-refreshed", "110.00")
	const store = prepareReview(original, {
		status: "price_changed",
		previousPrice: { amount: "100.00", currency: "USD" },
		currentPrice: { amount: "110.00", currency: "USD" },
		offer: refreshed,
	})

	assert.equal(store.getState().getCurrentFlightFareReview().status, "acceptance_required")
	assert.equal(store.getState().isCurrentFlightFareAccepted(), false)
	assert.equal(store.getState().acceptCurrentFlightFareChange("2026-11-25T03:00:00.000Z"), true)
	assert.equal(store.getState().isCurrentFlightFareAccepted(), true)
})

test("a new offer refresh invalidates the previous fare acceptance", () => {
	const original = makeOffer("offer-selected", "100.00")
	const refreshed = makeOffer("offer-refreshed", "110.00")
	const store = prepareReview(original, {
		status: "price_changed",
		previousPrice: { amount: "100.00", currency: "USD" },
		currentPrice: { amount: "110.00", currency: "USD" },
		offer: refreshed,
	})
	store.getState().acceptCurrentFlightFareChange("2026-11-25T03:00:00.000Z")
	assert.equal(store.getState().isCurrentFlightFareAccepted(), true)

	const nextAttempt = store.getState().startOfferReviewRefresh()
	assert.ok(nextAttempt)
	assert.equal(store.getState().flightFareAcceptance, null)
	assert.equal(store.getState().isCurrentFlightFareAccepted(), false)
})

test("an unchanged fare is considered accepted without creating an acceptance record", () => {
	const original = makeOffer("offer-selected", "100.00")
	const refreshed = makeOffer("offer-selected", "100.00")
	const store = prepareReview(original, { status: "valid", offer: refreshed })

	assert.equal(store.getState().getCurrentFlightFareReview().status, "unchanged")
	assert.equal(store.getState().isCurrentFlightFareAccepted(), true)
	assert.equal(store.getState().flightFareAcceptance, null)
})

test("a currency change requires explicit acceptance even if the amount is unchanged", () => {
	const original = makeOffer("offer-selected", "100.00", "USD")
	const refreshed = makeOffer("offer-refreshed", "100.00", "EUR")
	const store = prepareReview(original, { status: "valid", offer: refreshed })

	const fareReview = store.getState().getCurrentFlightFareReview()
	assert.equal(fareReview.status, "acceptance_required")
	assert.equal(fareReview.difference, null)
	assert.equal(store.getState().isCurrentFlightFareAccepted(), false)
})