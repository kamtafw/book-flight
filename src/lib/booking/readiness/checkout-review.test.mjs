import assert from "node:assert/strict"
import test from "node:test"
import { getCheckoutReviewEntryState } from "./checkout-review"

function makeOffer(id = "off_review") {
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
		slices: [{
			originCode: "LOS",
			destinationCode: "LHR",
			duration: "3h",
			segments: [{
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
			}],
		}],
	}
}

function makeCollection(offerId = "off_review") {
	return {
		passengers: [{
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
			providerReferences: [{
				provider: "duffel",
				offerId,
				providerPassengerId: "pas_adult",
				providerPassengerType: "adult",
				age: 30,
			}],
		}],
		relationships: [],
	}
}

const offer = makeOffer()
const bookingSession = { id: "booking-1", offerId: offer.id }
const passengers = makeCollection()

test("allows entry only when the selected offer, booking session and passenger data match", () => {
	assert.equal(
		getCheckoutReviewEntryState(offer.id, offer, bookingSession, passengers),
		"ready",
	)
})

test("rejects an absent or mismatched offer", () => {
	assert.equal(getCheckoutReviewEntryState(undefined, offer, bookingSession, passengers), "flight_unavailable")
	assert.equal(getCheckoutReviewEntryState("off_other", offer, bookingSession, passengers), "flight_unavailable")
	assert.equal(getCheckoutReviewEntryState(offer.id, undefined, bookingSession, passengers), "flight_unavailable")
})

test("rejects a missing or foreign booking session", () => {
	assert.equal(getCheckoutReviewEntryState(offer.id, offer, null, passengers), "booking_session_unavailable")
	assert.equal(
		getCheckoutReviewEntryState(offer.id, offer, { id: "booking-2", offerId: "off_other" }, passengers),
		"booking_session_unavailable",
	)
})

test("rejects missing or incomplete passenger details", () => {
	assert.equal(
		getCheckoutReviewEntryState(offer.id, offer, bookingSession, null),
		"passenger_details_incomplete",
	)
	const incomplete = makeCollection()
	incomplete.passengers[0].identity.givenName = ""
	assert.equal(
		getCheckoutReviewEntryState(offer.id, offer, bookingSession, incomplete),
		"passenger_details_incomplete",
	)
})
