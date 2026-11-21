import assert from "node:assert/strict"
import test from "node:test"
import { createSeatReviewOutcome } from "./seat-review"

function seat(overrides = {}) {
	return {
		id: "ase_1",
		passengerId: "pas_adult",
		totalAmount: "25.00",
		totalCurrency: "USD",
		offerId: "off_review123",
		segmentId: "seg_1",
		seatDesignator: "12A",
		seatName: "Window",
		disclosures: [],
		...overrides,
	}
}

function result(selection, overrides = {}) {
	return {
		serviceId: selection.id,
		passengerId: selection.passengerId,
		segmentId: selection.segmentId,
		seatDesignator: selection.seatDesignator,
		expectedAmount: selection.totalAmount,
		expectedCurrency: selection.totalCurrency,
		expectedDisclosures: selection.disclosures,
		status: "valid",
		reason: null,
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
		...overrides,
	}
}

test("returns not_selected without requiring provider results", () => {
	assert.deepEqual(createSeatReviewOutcome([], { status: "not_selected", selections: [] }), {
		status: "not_selected",
		selections: [],
	})
})

test("associates valid results by provider identity, independent of response order", () => {
	const adult = seat()
	const child = seat({
		id: "ase_2",
		passengerId: "pas_child",
		segmentId: "seg_2",
		seatDesignator: "14C",
		seatName: "Aisle",
	})
	const outcome = createSeatReviewOutcome([adult, child], {
		status: "valid",
		selections: [result(child), result(adult)],
	})
	assert.equal(outcome.status, "valid")
	if (outcome.status === "valid") {
		assert.equal(outcome.selections[0].selection.passengerId, "pas_adult")
		assert.equal(outcome.selections[1].selection.passengerId, "pas_child")
		assert.equal(outcome.selections[1].current.segmentId, "seg_2")
	}
})

test("preserves a changed seat price as a distinct customer action", () => {
	const selected = seat()
	const outcome = createSeatReviewOutcome([selected], {
		status: "price_changed",
		selections: [
			result(selected, {
				status: "price_changed",
				priceChanged: true,
				current: { ...result(selected).current, amount: "27.50" },
			}),
		],
	})
	assert.equal(outcome.status, "action_required")
	assert.equal(outcome.selections[0].status, "price_changed")
})

test("classifies unavailable segment, seat and service selections", () => {
	for (const reason of ["segment_unavailable", "seat_unavailable", "service_unavailable"]) {
		const selected = seat()
		const outcome = createSeatReviewOutcome([selected], {
			status: "selection_changed",
			selections: [result(selected, { status: "selection_changed", reason, current: null })],
		})
		assert.equal(outcome.status, "action_required")
		assert.equal(outcome.selections[0].status, "unavailable")
	}
})

test("preserves changed disclosures independently from seat price changes", () => {
	const selected = seat()
	const current = { ...result(selected).current, disclosures: ["Exit row seat"] }
	const disclosure = createSeatReviewOutcome([selected], {
		status: "selection_changed",
		selections: [
			result(selected, {
				status: "selection_changed",
				reason: "seat_disclosures_changed",
				current,
			}),
		],
	})
	assert.equal(disclosure.selections[0].status, "disclosures_changed")

	const both = createSeatReviewOutcome([selected], {
		status: "selection_changed",
		selections: [
			result(selected, {
				status: "selection_changed",
				reason: "seat_disclosures_changed",
				priceChanged: true,
				current: { ...current, amount: "30.00" },
			}),
		],
	})
	assert.equal(both.selections[0].status, "disclosures_and_price_changed")
})

test("preserves mixed results across passengers and segments", () => {
	const adult = seat()
	const child = seat({
		id: "ase_2",
		passengerId: "pas_child",
		segmentId: "seg_2",
		seatDesignator: "14C",
	})
	const outcome = createSeatReviewOutcome([adult, child], {
		status: "selection_changed",
		selections: [
			result(adult),
			result(child, { status: "selection_changed", reason: "seat_unavailable", current: null }),
		],
	})
	assert.equal(outcome.status, "action_required")
	assert.deepEqual(outcome.selections.map((item) => item.status), ["valid", "unavailable"])
})

test("rejects an outcome that does not consistently describe its selection", () => {
	const selected = seat()
	assert.throws(
		() =>
			createSeatReviewOutcome([selected], {
				status: "selection_changed",
				selections: [
					result(selected, {
						status: "selection_changed",
						reason: "unknown_reason",
						current: null,
					}),
				],
			}),
		/inconsistent/,
	)
})
