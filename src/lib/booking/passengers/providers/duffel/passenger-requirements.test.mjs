import assert from "node:assert/strict"
import test from "node:test"
import {
	DuffelPassengerRequirementsError,
	extractDuffelPassengerRequirements,
} from "./passenger-requirements.ts"

function makeOffer(overrides = {}) {
	return {
		id: "off_example123",
		airline: "Example Air",
		flightNumber: "EA 101",
		departureTime: "09:00",
		arrivalTime: "12:00",
		duration: "3h",
		price: 100,
		currency: "GBP",
		expiresAt: "2027-01-01T00:00:00Z",
		passengerIdentityDocumentsRequired: true,
		supportedPassengerIdentityDocumentTypes: ["passport", "identity_card"],
		passengers: [
			{ id: "pas_adult", type: "adult", age: null },
			{ id: "pas_child", type: "child", age: 8 },
		],
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
		...overrides,
	}
}

test("extracts exact offer-scoped provider passenger identities and age/type", () => {
	const result = extractDuffelPassengerRequirements(makeOffer())

	assert.equal(result.provider, "duffel")
	assert.equal(result.offerId, "off_example123")
	assert.deepEqual(result.passengers, [
		{ providerPassengerId: "pas_adult", providerPassengerType: "adult", age: null },
		{ providerPassengerId: "pas_child", providerPassengerType: "child", age: 8 },
	])
})

test("derives the last-flight date from the final itinerary segment", () => {
	const offer = makeOffer({
		slices: [
			makeOffer().slices[0],
			{
				originCode: "LHR",
				destinationCode: "JFK",
				duration: "8h",
				segments: [
					{
						...makeOffer().slices[0].segments[0],
						id: "seg_2",
						arrivalAt: "2027-02-02T18:30:00Z",
					},
				],
			},
		],
	})
	assert.equal(extractDuffelPassengerRequirements(offer).lastFlightDate, "2027-02-02")
})

test("preserves required, not-required, and unknown document states", () => {
	assert.equal(
		extractDuffelPassengerRequirements(makeOffer()).identityDocuments.status,
		"required",
	)
	assert.equal(
		extractDuffelPassengerRequirements(
			makeOffer({ passengerIdentityDocumentsRequired: false }),
		).identityDocuments.status,
		"not_required",
	)
	assert.equal(
		extractDuffelPassengerRequirements(
			makeOffer({ passengerIdentityDocumentsRequired: null }),
		).identityDocuments.status,
		"unknown",
	)
	assert.equal(
		extractDuffelPassengerRequirements(
			makeOffer({ passengerIdentityDocumentsRequired: undefined }),
		).identityDocuments.status,
		"unknown",
	)
})

test("preserves unknown versus explicitly empty supported document types", () => {
	assert.deepEqual(
		extractDuffelPassengerRequirements(
			makeOffer({ supportedPassengerIdentityDocumentTypes: [] }),
		).identityDocuments.supportedTypes,
		[],
	)
	assert.equal(
		extractDuffelPassengerRequirements(
			makeOffer({ supportedPassengerIdentityDocumentTypes: null }),
		).identityDocuments.supportedTypes,
		null,
	)
})

test("returns null when the final itinerary arrival date is unavailable or invalid", () => {
	for (const arrivalAt of [undefined, "not-a-date", "2027-02-30T12:00:00Z"]) {
		const offer = makeOffer({
			slices: [
				{
					...makeOffer().slices[0],
					segments: [
						{ ...makeOffer().slices[0].segments[0], arrivalAt },
					],
				},
			],
		})
		assert.equal(extractDuffelPassengerRequirements(offer).lastFlightDate, null)
	}
})

test("rejects missing offer and passenger identities", () => {
	assert.throws(
		() => extractDuffelPassengerRequirements(makeOffer({ id: " " })),
		(error) =>
			error instanceof DuffelPassengerRequirementsError &&
			error.code === "INVALID_OFFER_ID",
	)
	assert.throws(
		() => extractDuffelPassengerRequirements(makeOffer({ passengers: [] })),
		(error) =>
			error instanceof DuffelPassengerRequirementsError &&
			error.code === "MISSING_OFFER_PASSENGERS",
	)
	assert.throws(
		() =>
			extractDuffelPassengerRequirements(
				makeOffer({ passengers: [{ id: " ", type: "adult", age: null }] }),
			),
		(error) =>
			error instanceof DuffelPassengerRequirementsError &&
			error.code === "INVALID_PROVIDER_PASSENGER_ID",
	)
	assert.throws(
		() =>
			extractDuffelPassengerRequirements(
				makeOffer({
					passengers: [
						{ id: "pas_duplicate", type: "adult", age: null },
						{ id: "pas_duplicate", type: "child", age: 8 },
					],
				}),
			),
		(error) =>
			error instanceof DuffelPassengerRequirementsError &&
			error.code === "DUPLICATE_PROVIDER_PASSENGER_ID",
	)
})

test("does not mutate the normalized offer", () => {
	const offer = makeOffer()
	const before = structuredClone(offer)
	extractDuffelPassengerRequirements(offer)
	assert.deepEqual(offer, before)
})
