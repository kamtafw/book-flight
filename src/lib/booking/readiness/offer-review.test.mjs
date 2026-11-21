import assert from "node:assert/strict"
import test from "node:test"
import { createOfferReviewOutcome } from "./offer-review"

function makeOffer(overrides = {}) {
	return {
		id: "off_review123",
		airline: "Example Air",
		flightNumber: "EA 101",
		departureTime: "2027-05-21T08:30:00Z",
		arrivalTime: "2027-05-21T09:45:00Z",
		duration: "1h 15m",
		price: 125.5,
		priceAmount: "125.50",
		currency: "USD",
		expiresAt: "2027-05-21T10:00:00Z",
		operatingCarrierNames: ["Example Air"],
		supportedPassengerIdentityDocumentTypes: ["passport"],
		passengers: [{ id: "pas_adult", type: "adult", age: 30 }],
		slices: [
			{
				originCode: "LOS",
				destinationCode: "ABV",
				duration: "1h 15m",
				segments: [
					{
						id: "seg_original",
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
					},
				],
			},
		],
		...overrides,
	}
}

test("keeps the original offer separate from the valid refreshed offer", () => {
	const original = makeOffer()
	const refreshed = makeOffer({ price: 125.5, priceAmount: "125.50" })

	const outcome = createOfferReviewOutcome(original, { status: "valid", offer: refreshed })

	assert.equal(outcome.status, "valid")
	assert.equal(outcome.canContinueToSeatValidation, true)
	assert.equal(outcome.priceAcceptanceRequired, false)
	assert.notEqual(outcome.originalOffer, original)
	assert.notEqual(outcome.currentOffer, refreshed)
	assert.equal(outcome.originalOffer.priceAmount, "125.50")
	assert.equal(outcome.currentOffer.priceAmount, "125.50")
	assert.notEqual(outcome.originalOffer.slices, outcome.currentOffer.slices)
})

test("preserves original and updated fare data when the price changes", () => {
	const original = makeOffer()
	const refreshed = makeOffer({ price: 140, priceAmount: "140.00" })
	const outcome = createOfferReviewOutcome(original, {
		status: "price_changed",
		previousPrice: { amount: "125.50", currency: "USD" },
		currentPrice: { amount: "140.00", currency: "USD" },
		offer: refreshed,
	})

	assert.equal(outcome.status, "price_changed")
	assert.equal(outcome.canContinueToSeatValidation, true)
	assert.equal(outcome.priceAcceptanceRequired, true)
	assert.equal(outcome.originalOffer.priceAmount, "125.50")
	assert.equal(outcome.currentOffer.priceAmount, "140.00")
	assert.deepEqual(outcome.previousPrice, { amount: "125.50", currency: "USD" })
	assert.deepEqual(outcome.currentPrice, { amount: "140.00", currency: "USD" })
})

test("itinerary changes block the next validation even when the fare also changed", () => {
	const original = makeOffer()
	const changedItinerary = makeOffer({
		price: 140,
		priceAmount: "140.00",
		slices: [
			{
				originCode: "LOS",
				destinationCode: "DXB",
				duration: "8h",
				segments: [
					{
						id: "seg_changed",
						departureAirportCode: "LOS",
						departureAirportName: "Lagos",
						departureAt: "2027-05-21T08:30:00Z",
						arrivalAirportCode: "DXB",
						arrivalAirportName: "Dubai",
						arrivalAt: "2027-05-21T16:30:00Z",
						marketingCarrierName: "Example Air",
						marketingCarrierCode: "EA",
						operatingCarrierName: "Example Air",
						operatingCarrierCode: "EA",
						flightNumber: "101",
						duration: "8h",
					},
				],
			},
		],
	})
	const outcome = createOfferReviewOutcome(original, {
		status: "itinerary_changed",
		materialDifferences: ["slice_1_segment_1"],
		priceChanged: true,
		previousPrice: { amount: "125.50", currency: "USD" },
		currentPrice: { amount: "140.00", currency: "USD" },
		offer: changedItinerary,
	})

	assert.equal(outcome.status, "itinerary_changed")
	assert.equal(outcome.canContinueToSeatValidation, false)
	assert.equal(outcome.priceAcceptanceRequired, false)
	assert.equal(outcome.priceChanged, true)
	assert.equal(outcome.blockingReason, "itinerary_changed")
	assert.equal(outcome.originalOffer.slices[0].segments[0].id, "seg_original")
	assert.equal(outcome.refreshedOffer.slices[0].segments[0].id, "seg_changed")
})

test("an unavailable offer blocks continuation while retaining the original selection", () => {
	const original = makeOffer()
	const outcome = createOfferReviewOutcome(original, {
		status: "unavailable",
		code: "OFFER_NO_LONGER_AVAILABLE",
		message: "This flight is no longer available.",
	})

	assert.equal(outcome.status, "unavailable")
	assert.equal(outcome.canContinueToSeatValidation, false)
	assert.equal(outcome.priceAcceptanceRequired, false)
	assert.equal(outcome.blockingReason, "unavailable")
	assert.equal(outcome.originalOffer.id, original.id)
	assert.equal(outcome.originalOffer.priceAmount, "125.50")
})

test("the original snapshot does not share nested mutable data with the selected offer", () => {
	const original = makeOffer()
	const outcome = createOfferReviewOutcome(original, { status: "valid", offer: makeOffer() })

	outcome.originalOffer.slices[0].segments[0].departureAirportName = "Changed copy"
	outcome.originalOffer.passengers[0].age = 99
	outcome.originalOffer.operatingCarrierNames.push("Changed copy")
	outcome.originalOffer.supportedPassengerIdentityDocumentTypes.push("national_id")

	assert.equal(original.slices[0].segments[0].departureAirportName, "Lagos")
	assert.equal(original.passengers[0].age, 30)
	assert.deepEqual(original.operatingCarrierNames, ["Example Air"])
	assert.deepEqual(original.supportedPassengerIdentityDocumentTypes, ["passport"])
})
