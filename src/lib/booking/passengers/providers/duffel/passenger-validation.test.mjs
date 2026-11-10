import assert from "node:assert/strict"
import test from "node:test"
import { validateDuffelPassengers } from "./passenger-validation.ts"

function makeOffer(overrides = {}) {
	return {
		id: "off_validation",
		airline: "Example Air",
		flightNumber: "EA 101",
		departureTime: "09:00",
		arrivalTime: "12:00",
		duration: "3h",
		price: 100,
		currency: "GBP",
		expiresAt: "2027-01-01T00:00:00Z",
		passengerIdentityDocumentsRequired: false,
		supportedPassengerIdentityDocumentTypes: ["passport", "identity_card"],
		passengers: [
			{ id: "pas_adult", type: "adult", age: 30 },
		],
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
		...overrides,
	}
}

function makePassenger(id = "internal-adult", providerId = "pas_adult", overrides = {}) {
	return {
		id,
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
			offerId: "off_validation",
			providerPassengerId: providerId,
			providerPassengerType: "adult",
			age: 30,
		}],
		...overrides,
	}
}

function makeCollection(passengers = [makePassenger()], relationships = []) {
	return { passengers, relationships }
}

const options = { today: "2026-11-09" }

test("marks a complete adult passenger collection provider-ready", () => {
	const result = validateDuffelPassengers(makeOffer(), makeCollection(), options)
	assert.equal(result.status, "provider_ready")
	assert.deepEqual(result.issues, [])
})

test("maps accepted gender labels and rejects unsupported free text", () => {
	const valid = validateDuffelPassengers(makeOffer(), makeCollection(), options)
	assert.equal(valid.status, "provider_ready")
	const invalid = validateDuffelPassengers(
		makeOffer(),
		makeCollection([makePassenger("p1", "pas_adult", { identity: { ...makePassenger().identity, gender: "nonbinary" } })]),
		options,
	)
	assert.equal(invalid.status, "draft")
	assert.ok(invalid.issues.some((issue) => issue.code === "UNSUPPORTED_GENDER"))
})

test("requires real names and a real non-future date of birth", () => {
	const passenger = makePassenger()
	const result = validateDuffelPassengers(
		makeOffer(),
		makeCollection([makePassenger("p1", "pas_adult", {
			identity: { ...passenger.identity, givenName: " ", dateOfBirth: "2026-02-30" },
		})]),
		options,
	)
	assert.equal(result.status, "draft")
	assert.ok(result.issues.some((issue) => issue.code === "GIVEN_NAME_REQUIRED"))
	assert.ok(result.issues.some((issue) => issue.code === "INVALID_DATE_OF_BIRTH"))
})

test("compares date of birth age against the provider age on the last flight date", () => {
	const matching = validateDuffelPassengers(makeOffer(), makeCollection(), options)
	assert.equal(matching.status, "provider_ready")
	const mismatch = validateDuffelPassengers(
		makeOffer(),
		makeCollection([makePassenger("p1", "pas_adult", {
			identity: { ...makePassenger().identity, dateOfBirth: "1990-01-01" },
		})]),
		options,
	)
	assert.equal(mismatch.status, "draft")
	assert.ok(mismatch.issues.some((issue) => issue.code === "PASSENGER_AGE_MISMATCH"))
})

test("allows an adult with no provider age to become provider-ready", () => {
	const offer = makeOffer({ passengers: [{ id: "pas_adult", type: "adult", age: null }] })
	const result = validateDuffelPassengers(offer, makeCollection(), options)
	assert.equal(result.status, "provider_ready")
	assert.ok(!result.issues.some((issue) => issue.code === "AGE_CHECK_UNKNOWN"))
})

test("keeps age-dependent passengers without provider age from claiming provider readiness", () => {
	const child = {
		...makePassenger("child", "pas_child"),
		category: "child",
		identity: { ...makePassenger().identity, dateOfBirth: "2018-06-01" },
		providerReferences: [{
			provider: "duffel",
			offerId: "off_validation",
			providerPassengerId: "pas_child",
			providerPassengerType: "child",
			age: null,
		}],
	}
	const offer = makeOffer({
		passengers: [{ id: "pas_child", type: "child", age: null }],
	})
	const result = validateDuffelPassengers(offer, makeCollection([child]), options)
	assert.equal(result.status, "locally_valid")
	assert.ok(result.issues.some((issue) => issue.code === "AGE_CHECK_UNKNOWN"))
})

test("requires passenger-owned email and does not accept an associated adult email", () => {
	const passenger = makePassenger()
	const result = validateDuffelPassengers(
		makeOffer(),
		makeCollection([makePassenger("p1", "pas_adult", {
			contacts: [
				{ ...passenger.contacts[0], belongsTo: "other", relatedPersonPassengerId: "someone" },
				passenger.contacts[1],
			],
		})]),
		options,
	)
	assert.equal(result.status, "locally_valid")
	assert.ok(result.issues.some((issue) => issue.code === "PASSENGER_OWN_EMAIL_REQUIRED"))
})

test("accepts a valid phone explicitly owned by another adult passenger", () => {
	const adult = makePassenger("adult", "pas_adult")
	const child = {
		...makePassenger("child", "pas_child"),
		category: "child",
		providerReferences: [{
			provider: "duffel", offerId: "off_validation",
			providerPassengerId: "pas_child", providerPassengerType: "child", age: 8,
		}],
		identity: { ...makePassenger().identity, dateOfBirth: "2018-06-01" },
		contacts: [
			{ id: "child-email", type: "email", value: "child@example.com", belongsTo: "passenger" },
			{ id: "parent-phone", type: "phone", value: "+2348012345678", belongsTo: "other", relatedPersonPassengerId: "adult" },
		],
	}
	const offer = makeOffer({
		passengers: [
			{ id: "pas_adult", type: "adult", age: 30 },
			{ id: "pas_child", type: "child", age: 8 },
		],
	})
	const result = validateDuffelPassengers(offer, makeCollection([adult, child]), options)
	assert.equal(result.status, "provider_ready")
})

test("rejects an unassociated or non-adult phone owner", () => {
	const result = validateDuffelPassengers(
		makeOffer(),
		makeCollection([makePassenger("p1", "pas_adult", {
			contacts: [
				{ id: "e", type: "email", value: "ada@example.com", belongsTo: "passenger" },
				{ id: "p", type: "phone", value: "+2348012345678", belongsTo: "other" },
			],
		})]),
		options,
	)
	assert.equal(result.status, "locally_valid")
	assert.ok(result.issues.some((issue) => issue.code === "INVALID_PHONE_OWNER"))
})

test("requires passport and complete document details only when the offer requires documents", () => {
	const offer = makeOffer({
		passengerIdentityDocumentsRequired: true,
		supportedPassengerIdentityDocumentTypes: ["passport"],
	})
	const missing = validateDuffelPassengers(offer, makeCollection(), options)
	assert.equal(missing.status, "locally_valid")
	assert.ok(missing.issues.some((issue) => issue.code === "PASSPORT_REQUIRED"))
	const validDocument = makePassenger("p1", "pas_adult", {
		travelDocuments: [{
			id: "doc1", type: "passport", documentNumber: "REDACTED-TEST",
			issuingCountry: "NG", expirationDate: "2030-01-01",
		}],
	})
	assert.equal(validateDuffelPassengers(offer, makeCollection([validDocument]), options).status, "provider_ready")
})

test("unknown document metadata and missing supported types block readiness", () => {
	const unknown = validateDuffelPassengers(
		makeOffer({ passengerIdentityDocumentsRequired: null }),
		makeCollection(),
		options,
	)
	assert.equal(unknown.status, "locally_valid")
	assert.ok(unknown.issues.some((issue) => issue.code === "DOCUMENT_REQUIREMENT_UNKNOWN"))
	const missingTypes = validateDuffelPassengers(
		makeOffer({ passengerIdentityDocumentsRequired: true, supportedPassengerIdentityDocumentTypes: null }),
		makeCollection([makePassenger("p1", "pas_adult", {
			travelDocuments: [{
				id: "doc1", type: "passport", documentNumber: "TEST",
				issuingCountry: "NG", expirationDate: "2030-01-01",
			}],
		})]),
		options,
	)
	assert.ok(missingTypes.issues.some((issue) => issue.code === "DOCUMENT_TYPES_UNKNOWN"))
})

test("rejects unsupported, incomplete, malformed, and expired documents without six-month rule", () => {
	const offer = makeOffer()
	const unsupported = makePassenger("p1", "pas_adult", {
		travelDocuments: [{
			id: "doc1", type: "visa", documentNumber: "TEST",
			issuingCountry: "NG", expirationDate: "2030-01-01",
		}],
	})
	assert.ok(validateDuffelPassengers(offer, makeCollection([unsupported]), options).issues.some((issue) => issue.code === "UNSUPPORTED_DOCUMENT_TYPE"))
	const expired = makePassenger("p1", "pas_adult", {
		travelDocuments: [{
			id: "doc1", type: "passport", documentNumber: "TEST",
			issuingCountry: "NG", expirationDate: "2026-11-08",
		}],
	})
	assert.ok(validateDuffelPassengers(offer, makeCollection([expired]), options).issues.some((issue) => issue.code === "EXPIRED_DOCUMENT"))
})

test("rejects mismatched, foreign, duplicate, missing, and extra passenger mappings", () => {
	const offer = makeOffer({
		passengers: [
			{ id: "pas_adult", type: "adult", age: 30 },
			{ id: "pas_other", type: "adult", age: 30 },
		],
	})
	const missing = validateDuffelPassengers(offer, makeCollection(), options)
	assert.ok(missing.issues.some((issue) => issue.code === "MISSING_INTERNAL_PASSENGER"))
	const foreign = makePassenger("p1", "pas_adult", {
		providerReferences: [{
			provider: "duffel", offerId: "off_foreign",
			providerPassengerId: "pas_adult", providerPassengerType: "adult", age: 30,
		}],
	})
	assert.ok(validateDuffelPassengers(offer, makeCollection([foreign]), options).issues.some((issue) => issue.code === "FOREIGN_OFFER_REFERENCE"))
	const wrongProvider = makePassenger("p1", "pas_adult", {
		providerReferences: [{
			provider: "other", offerId: "off_validation",
			providerPassengerId: "pas_adult", providerPassengerType: "adult", age: 30,
		}],
	})
	assert.ok(validateDuffelPassengers(offer, makeCollection([wrongProvider]), options).issues.some((issue) => issue.code === "WRONG_PROVIDER"))
	const duplicate = makePassenger("p2", "pas_adult")
	assert.ok(validateDuffelPassengers(offer, makeCollection([makePassenger(), duplicate]), options).issues.some((issue) => issue.code === "DUPLICATE_PROVIDER_PASSENGER_MAPPING"))
})

test("validates infant responsibility and Duffel's unique adult assignment", () => {
	const adult1 = makePassenger("adult1", "pas_adult")
	const adult2 = makePassenger("adult2", "pas_adult2")
	const infant1 = {
		...makePassenger("infant1", "pas_infant1"),
		category: "infant",
		providerReferences: [{ provider: "duffel", offerId: "off_validation", providerPassengerId: "pas_infant1", providerPassengerType: "infant_without_seat", age: 0 }],
		identity: { ...makePassenger().identity, dateOfBirth: "2026-05-01" },
	}
	const infant2 = {
		...infant1,
		id: "infant2",
		providerReferences: [{ provider: "duffel", offerId: "off_validation", providerPassengerId: "pas_infant2", providerPassengerType: "infant_without_seat", age: 0 }],
	}
	const offer = makeOffer({
		passengers: [
			{ id: "pas_adult", type: "adult", age: 30 },
			{ id: "pas_adult2", type: "adult", age: 30 },
			{ id: "pas_infant1", type: "infant_without_seat", age: 0 },
			{ id: "pas_infant2", type: "infant_without_seat", age: 0 },
		],
	})
	const sharedAdult = validateDuffelPassengers(offer, makeCollection(
		[adult1, adult2, infant1, infant2],
		[
			{ passengerId: "infant1", relatedPassengerId: "adult1", type: "responsible_adult" },
			{ passengerId: "infant2", relatedPassengerId: "adult1", type: "responsible_adult" },
		],
	), options)
	assert.ok(sharedAdult.issues.some((issue) => issue.code === "ADULT_ASSIGNED_MULTIPLE_INFANTS"))
	const uniqueAdults = validateDuffelPassengers(offer, makeCollection(
		[adult1, adult2, infant1, infant2],
		[
			{ passengerId: "infant1", relatedPassengerId: "adult1", type: "responsible_adult" },
			{ passengerId: "infant2", relatedPassengerId: "adult2", type: "responsible_adult" },
		],
	), options)
	assert.equal(uniqueAdults.status, "provider_ready")
})

test("issue messages never echo sensitive passenger values", () => {
	const secretNumber = "PASSPORT-SECRET-123"
	const result = validateDuffelPassengers(
		makeOffer({ passengerIdentityDocumentsRequired: true }),
		makeCollection([makePassenger("p1", "pas_adult", {
			travelDocuments: [{
				id: "doc1", type: "passport", documentNumber: secretNumber,
				issuingCountry: "NG", expirationDate: "2020-01-01",
			}],
		})]),
		options,
	)
	assert.ok(!JSON.stringify(result).includes(secretNumber))
	assert.ok(!JSON.stringify(result).includes("ada@example.com"))
})
