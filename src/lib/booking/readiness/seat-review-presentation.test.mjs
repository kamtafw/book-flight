import assert from "node:assert/strict"
import test from "node:test"
import { buildSeatReviewPresentation } from "./seat-review-presentation"

function offer() {
	return {
		id: "off_1",
		slices: [
			{
				originCode: "LOS",
				destinationCode: "DXB",
				segments: [
					{ id: "seg_1", departureAirportCode: "LOS", arrivalAirportCode: "ADD" },
					{ id: "seg_2", departureAirportCode: "ADD", arrivalAirportCode: "DXB" },
				],
			},
		],
	}
}

function passenger(id, providerPassengerId, overrides = {}) {
	return {
		id,
		category: "adult",
		identity: { givenName: id === "p1" ? "Ada" : "Bola", familyName: "Traveller" },
		contacts: [],
		travelDocuments: [],
		providerReferences: [
			{
				provider: "duffel",
				offerId: "off_1",
				providerPassengerId,
				providerPassengerType: "adult",
				age: 30,
			},
		],
		...overrides,
	}
}

function seat(overrides = {}) {
	return {
		id: "service_1",
		passengerId: "pas_1",
		offerId: "off_1",
		segmentId: "seg_1",
		seatDesignator: "12A",
		seatName: "Window",
		totalAmount: "25.00",
		totalCurrency: "USD",
		disclosures: [],
		...overrides,
	}
}

function validOutcome(selections) {
	return {
		status: "valid",
		selections: selections.map((selection) => ({
			status: "valid",
			selection,
			current: {
				serviceId: selection.id,
				passengerId: selection.passengerId,
				segmentId: selection.segmentId,
				seatDesignator: selection.seatDesignator,
				seatName: selection.seatName,
				amount: selection.totalAmount,
				currency: selection.totalCurrency,
				disclosures: selection.disclosures,
			},
		})),
	}
}

test("groups seats under the passenger resolved by exact provider reference and labels each segment", () => {
	const first = seat()
	const second = seat({
		id: "service_2",
		passengerId: "pas_2",
		segmentId: "seg_2",
		seatDesignator: "14C",
		seatName: "Aisle",
	})
	const groups = buildSeatReviewPresentation(
		validOutcome([second, first]),
		[second, first],
		{
			passengers: [passenger("p2", "pas_2"), passenger("p1", "pas_1")],
			relationships: [],
		},
		offer(),
	)
	assert.equal(groups.length, 2)
	assert.equal(groups[0].passengerLabel, "Bola Traveller")
	assert.equal(groups[0].seats[0].segmentLabel, "Segment 2 · ADD → DXB")
	assert.equal(groups[0].seats[0].seatDesignator, "14C")
	assert.equal(groups[1].passengerLabel, "Ada Traveller")
	assert.equal(groups[1].seats[0].segmentLabel, "Segment 1 · LOS → ADD")
})

test("uses current provider price and disclosures while preserving original price", () => {
	const selected = seat()
	const groups = buildSeatReviewPresentation(
		{
			status: "action_required",
			selections: [
				{
					status: "disclosures_and_price_changed",
					selection: selected,
					current: {
						serviceId: selected.id,
						passengerId: selected.passengerId,
						segmentId: selected.segmentId,
						seatDesignator: selected.seatDesignator,
						seatName: "Extra legroom",
						amount: "32.50",
						currency: "USD",
						disclosures: ["Exit row responsibilities"],
					},
				},
			],
		},
		[selected],
		{ passengers: [passenger("p1", "pas_1")], relationships: [] },
		offer(),
	)
	const row = groups[0].seats[0]
	assert.equal(row.status, "disclosures_and_price_changed")
	assert.equal(row.originalAmount, "25.00")
	assert.equal(row.currentAmount, "32.50")
	assert.equal(row.seatName, "Extra legroom")
	assert.deepEqual(row.disclosures, ["Exit row responsibilities"])
})

test("does not guess passenger ownership when provider references are missing or ambiguous", () => {
	const selected = seat()
	const groups = buildSeatReviewPresentation(
		validOutcome([selected]),
		[selected],
		{
			passengers: [
				passenger("p1", "pas_1"),
				passenger("p2", "pas_1"),
			],
			relationships: [],
		},
		offer(),
	)
	assert.equal(groups.length, 1)
	assert.equal(groups[0].associationWarning, true)
	assert.equal(groups[0].passengerId, null)
	assert.equal(groups[0].seats[0].passengerLabel, "Passenger association needs attention")
})

test("presents unavailable seats with the provider's specific reason", () => {
	const selected = seat()
	const groups = buildSeatReviewPresentation(
		{
			status: "action_required",
			selections: [
				{
					status: "unavailable",
					selection: selected,
					reason: "service_unavailable",
				},
			],
		},
		[selected],
		{ passengers: [passenger("p1", "pas_1")], relationships: [] },
		offer(),
	)
	assert.equal(groups[0].seats[0].status, "unavailable")
	assert.equal(groups[0].seats[0].unavailableReason, "service_unavailable")
	assert.equal(groups[0].seats[0].currentAmount, null)
})

test("returns no seat rows when the current selection is empty but the previous validation outcome is stale", () => {
	const previouslySelected = seat()
	assert.deepEqual(
		buildSeatReviewPresentation(
			validOutcome([previouslySelected]),
			[],
			{ passengers: [passenger("p1", "pas_1")], relationships: [] },
			offer(),
		),
		[],
	)
})

test("returns no seat rows for an explicit not-selected outcome", () => {
	assert.deepEqual(
		buildSeatReviewPresentation(
			{ status: "not_selected", selections: [] },
			[],
			{ passengers: [passenger("p1", "pas_1")], relationships: [] },
			offer(),
		),
		[],
	)
})

test("rejects an inconsistent not-selected outcome with existing selections", () => {
	assert.throws(
		() =>
			buildSeatReviewPresentation(
				{ status: "not_selected", selections: [] },
				[seat()],
				{ passengers: [passenger("p1", "pas_1")], relationships: [] },
				offer(),
			),
		/not-selected seat outcome cannot contain/,
	)
})

test("fails closed when an outcome or segment is missing", () => {
	const selected = seat()
	assert.throws(
		() =>
			buildSeatReviewPresentation(
				{ status: "valid", selections: [] },
				[selected],
				{ passengers: [passenger("p1", "pas_1")], relationships: [] },
				offer(),
			),
		/missing a validated seat/,
	)
	assert.throws(
		() =>
			buildSeatReviewPresentation(
				validOutcome([selected]),
				[selected],
				{ passengers: [passenger("p1", "pas_1")], relationships: [] },
				{ ...offer(), slices: [{ ...offer().slices[0], segments: [] }] },
			),
		/missing a validated seat or segment/,
	)
})
