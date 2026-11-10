import assert from "node:assert/strict"
import test from "node:test"
import { getBookingReadiness } from "./booking-readiness"

function makeOffer(id = "off_readiness") {
	return {
		id,
		airline: "Example Air",
		flightNumber: "EA 101",
		departureTime: "09:00",
		arrivalTime: "12:00",
		duration: "3h",
		price: 100,
		currency: "GBP",
		expiresAt: "2027-01-01T00:00:00Z",
		passengerIdentityDocumentsRequired: false,
		supportedPassengerIdentityDocumentTypes: ["passport"],
		passengers: [{ id: "pas_adult", type: "adult", age: 30 }],
		slices: [
			{
				originCode: "LOS",
				destinationCode: "LHR",
				duration: "3h",
				segments: [
					{
						id: "seg_1",
						departureAirportCode: "LOS",
						departureAirportName: "Lagos",
						departureAt: "2027-02-01T09:00:00Z",
						arrivalAirportCode: "LHR",
						arrivalAirportName: "London",
						arrivalAt: "2027-02-01T12:00:00Z",
						marketingCarrierName: "Example Air",
						marketingCarrierCode: "EA",
						operatingCarrierName: "Example Air",
						operatingCarrierCode: "EA",
						flightNumber: "101",
						duration: "3h",
					},
				],
			},
		],
	}
}

function makeCollection(offerId = "off_readiness") {
	return {
		passengers: [
			{
				id: "internal-adult",
				category: "adult",
				identity: {
					givenName: "Ada",
					familyName: "Lovelace",
					gender: "female",
					dateOfBirth: "1996-06-01",
				},
				contacts: [
					{ id: "email-1", type: "email", value: "ada@example.com", belongsTo: "passenger" },
					{ id: "phone-1", type: "phone", value: "+2348012345678", belongsTo: "passenger" },
				],
				travelDocuments: [],
				providerReferences: [
					{
						provider: "duffel",
						offerId,
						providerPassengerId: "pas_adult",
						providerPassengerType: "adult",
						age: 30,
					},
				],
			},
		],
		relationships: [],
	}
}

const options = { today: "2026-11-10" }

test("returns ready_for_order_preparation for provider-ready passenger data", () => {
	const result = getBookingReadiness(makeOffer(), makeCollection(), options)
	assert.equal(result.status, "ready_for_order_preparation")
	assert.equal(result.offerId, "off_readiness")
	assert.deepEqual(result.passengers, [
		{
			internalPassengerId: "internal-adult",
			providerPassengerId: "pas_adult",
		},
	])
	assert.deepEqual(result.issues, [])
})

test("returns incomplete when offer or passenger collection is absent", () => {
	assert.equal(getBookingReadiness(null, makeCollection()).status, "incomplete")
	assert.equal(getBookingReadiness(makeOffer(), null).status, "incomplete")
})

test("does not mark incomplete passenger data ready", () => {
	const collection = makeCollection()
	collection.passengers[0].identity.givenName = ""
	const result = getBookingReadiness(makeOffer(), collection, options)
	assert.equal(result.status, "incomplete")
	assert.ok(result.issues.some((issue) => issue.code === "GIVEN_NAME_REQUIRED"))
})

test("ties readiness to the exact offer and provider passenger mapping", () => {
	const result = getBookingReadiness(makeOffer("off_other"), makeCollection(), options)
	assert.equal(result.status, "incomplete")
	assert.equal(result.offerId, "off_other")
	assert.ok(result.issues.some((issue) => issue.code === "FOREIGN_OFFER_REFERENCE"))
})

test("does not expose passenger contact or document values in the readiness result", () => {
	const result = getBookingReadiness(makeOffer(), makeCollection(), options)
	const serialized = JSON.stringify(result)
	assert.equal(serialized.includes("ada@example.com"), false)
	assert.equal(serialized.includes("+2348012345678"), false)
})
