import assert from "node:assert/strict"
import test from "node:test"

import {
	createPassengerCollectionFromOffer,
	PassengerDomainError,
	validatePassengerRelationships,
} from "./passenger-domain.ts"

function makeIdFactory() {
	let current = 0
	return () => `internal-${++current}`
}

const offer = {
	id: "off_test123",
	passengers: [
		{ id: "pas_adult_1", type: "adult", age: 34 },
		{ id: "pas_child_1", type: "child", age: 8 },
		{ id: "pas_infant_1", type: "infant_without_seat", age: 1 },
	],
}

test("maps every offer passenger to a distinct internal passenger", () => {
	const collection = createPassengerCollectionFromOffer(offer, {
		provider: "duffel",
		createInternalId: makeIdFactory(),
		getCategory: (passenger) => {
			if (passenger.type === "adult") return "adult"
			if (passenger.type === "child") return "child"
			if (passenger.type === "infant_without_seat") return "infant"
			return "unknown"
		},
	})

	assert.equal(collection.passengers.length, 3)
	assert.deepEqual(
		collection.passengers.map((passenger) => passenger.id),
		["internal-1", "internal-2", "internal-3"],
	)
	assert.deepEqual(
		collection.passengers.map((passenger) => passenger.providerReferences[0]),
		[
			{
				provider: "duffel",
				offerId: "off_test123",
				providerPassengerId: "pas_adult_1",
				providerPassengerType: "adult",
				age: 34,
			},
			{
				provider: "duffel",
				offerId: "off_test123",
				providerPassengerId: "pas_child_1",
				providerPassengerType: "child",
				age: 8,
			},
			{
				provider: "duffel",
				offerId: "off_test123",
				providerPassengerId: "pas_infant_1",
				providerPassengerType: "infant_without_seat",
				age: 1,
			},
		],
	)
	assert.deepEqual(collection.relationships, [])
})

test("preserves provider passenger IDs without relying on passenger array positions", () => {
	const reversedOffer = { ...offer, passengers: [...offer.passengers].reverse() }
	const collection = createPassengerCollectionFromOffer(reversedOffer, {
		provider: "duffel",
		createInternalId: makeIdFactory(),
	})

	assert.deepEqual(
		collection.passengers.map((passenger) => passenger.providerReferences[0].providerPassengerId),
		["pas_infant_1", "pas_child_1", "pas_adult_1"],
	)
	assert.ok(collection.passengers.every((passenger) => passenger.category === "unknown"))
})

test("rejects an offer without provider passenger identities", () => {
	assert.throws(
		() =>
			createPassengerCollectionFromOffer(
				{ id: "off_empty", passengers: [] },
				{
					provider: "duffel",
					createInternalId: makeIdFactory(),
				},
			),
		(error) => error instanceof PassengerDomainError && error.code === "MISSING_OFFER_PASSENGERS",
	)
})

test("rejects duplicate provider passenger IDs", () => {
	assert.throws(
		() =>
			createPassengerCollectionFromOffer(
				{
					id: "off_duplicate",
					passengers: [
						{ id: "pas_1", type: "adult", age: 30 },
						{ id: "pas_1", type: "adult", age: 30 },
					],
				},
				{ provider: "duffel", createInternalId: makeIdFactory() },
			),
		(error) =>
			error instanceof PassengerDomainError && error.code === "DUPLICATE_PROVIDER_PASSENGER_ID",
	)
})

test("rejects duplicate internal IDs from the injected ID factory", () => {
	assert.throws(
		() =>
			createPassengerCollectionFromOffer(offer, {
				provider: "duffel",
				createInternalId: () => "same-id",
			}),
		(error) =>
			error instanceof PassengerDomainError && error.code === "DUPLICATE_INTERNAL_PASSENGER_ID",
	)
})

test("validates relationship references and prevents multiple responsible-adult links per passenger", () => {
	const collection = createPassengerCollectionFromOffer(offer, {
		provider: "duffel",
		createInternalId: makeIdFactory(),
		getCategory: (passenger) =>
			passenger.type === "adult"
				? "adult"
				: passenger.type === "infant_without_seat"
					? "infant"
					: "child",
	})
	const [adult, child, infant] = collection.passengers

	assert.deepEqual(
		validatePassengerRelationships(collection.passengers, [
			{ passengerId: infant.id, relatedPassengerId: adult.id, type: "responsible_adult" },
		]),
		[],
	)

	assert.deepEqual(
		validatePassengerRelationships(collection.passengers, [
			{ passengerId: infant.id, relatedPassengerId: adult.id, type: "responsible_adult" },
			{ passengerId: infant.id, relatedPassengerId: child.id, type: "responsible_adult" },
		]),
		[
			{
				code: "MULTIPLE_RESPONSIBLE_ADULTS",
				passengerId: infant.id,
				relatedPassengerId: child.id,
			},
		],
	)
})

test("reports unknown and self-referencing passenger relationships", () => {
	const collection = createPassengerCollectionFromOffer(offer, {
		provider: "duffel",
		createInternalId: makeIdFactory(),
	})
	const [adult] = collection.passengers

	assert.deepEqual(
		validatePassengerRelationships(collection.passengers, [
			{ passengerId: adult.id, relatedPassengerId: "missing", type: "responsible_adult" },
			{ passengerId: adult.id, relatedPassengerId: adult.id, type: "responsible_adult" },
		]),
		[
			{
				code: "UNKNOWN_PASSENGER",
				passengerId: adult.id,
				relatedPassengerId: "missing",
			},
			{
				code: "SELF_RELATIONSHIP",
				passengerId: adult.id,
				relatedPassengerId: adult.id,
			},
		],
	)
})
