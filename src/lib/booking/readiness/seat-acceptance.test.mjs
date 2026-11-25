import assert from "node:assert/strict"
import test from "node:test"
import {
	acceptSeatPriceChange,
	acknowledgeSeatDisclosures,
	areSeatAcceptanceRequirementsSatisfied,
	createSeatAcceptanceRequirements,
	isSeatDisclosureAcknowledgementCurrent,
	isSeatPriceAcceptanceCurrent,
} from "./seat-acceptance"

const context = {
	reviewSessionId: "review-1",
	bookingSessionId: "booking-1",
	selectedOfferId: "offer-selected",
	currentOfferId: "offer-current",
}

function seat(overrides = {}) {
	return {
		id: "service-1",
		offerId: "offer-selected",
		passengerId: "passenger-1",
		segmentId: "segment-1",
		seatDesignator: "12A",
		seatName: "Window",
		totalAmount: "25.00",
		totalCurrency: "USD",
		disclosures: ["Original disclosure"],
		...overrides,
	}
}

function current(selection, overrides = {}) {
	return {
		serviceId: selection.id,
		passengerId: selection.passengerId,
		segmentId: selection.segmentId,
		seatDesignator: selection.seatDesignator,
		seatName: selection.seatName,
		amount: selection.totalAmount,
		currency: selection.totalCurrency,
		disclosures: [...selection.disclosures],
		...overrides,
	}
}

function requirements(status, selection = seat(), currentDetails = current(selection)) {
	let item
	switch (status) {
		case "valid":
			item = { status: "valid", selection, current: currentDetails }
			break
		case "price_changed":
			item = { status: "price_changed", selection, current: currentDetails }
			break
		case "disclosures_changed":
			item = { status: "disclosures_changed", selection, current: currentDetails, priceChanged: false }
			break
		case "disclosures_and_price_changed":
			item = { status: "disclosures_and_price_changed", selection, current: currentDetails }
			break
		case "unavailable":
			item = { status: "unavailable", selection, reason: "seat_unavailable" }
			break
	}
	return createSeatAcceptanceRequirements(context, {
		status: status === "valid" ? "valid" : "action_required",
		selections: [item],
	})
}

test("unchanged valid seats require neither price acceptance nor disclosure acknowledgement", () => {
	const [item] = requirements("valid")
	assert.equal(item.status, "valid")
	assert.equal(item.priceAcceptanceRequired, false)
	assert.equal(item.disclosureAcknowledgementRequired, false)
	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [], []), true)
})

test("changed seat price requires explicit acceptance for that exact component", () => {
	const selected = seat()
	const [item] = requirements("price_changed", selected, current(selected, {
		amount: "29.50",
	}))
	assert.equal(item.status, "price_changed")
	assert.equal(item.priceAcceptanceRequired, true)
	assert.equal(item.disclosureAcknowledgementRequired, false)
	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [], []), false)

	const acceptance = acceptSeatPriceChange(item, "2026-11-25T03:00:00.000Z")
	assert.deepEqual(acceptance.previousPrice, { amount: "25.00", currency: "USD" })
	assert.deepEqual(acceptance.currentPrice, { amount: "29.50", currency: "USD" })
	assert.equal(isSeatPriceAcceptanceCurrent(item, acceptance), true)
	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [acceptance], []), true)
})

test("a currency change requires price acceptance without calculating a converted difference", () => {
	const selected = seat()
	const [item] = requirements("price_changed", selected, current(selected, {
		amount: "25.00",
		currency: "EUR",
	}))
	assert.equal(item.priceAcceptanceRequired, true)
	assert.equal(item.currentPrice.currency, "EUR")
	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [], []), false)
})

test("changed disclosures require a separate acknowledgement", () => {
	const selected = seat()
	const [item] = requirements("disclosures_changed", selected, current(selected, {
		disclosures: ["New exit-row responsibility"],
	}))
	assert.equal(item.priceAcceptanceRequired, false)
	assert.equal(item.disclosureAcknowledgementRequired, true)
	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [], []), false)

	const acknowledgement = acknowledgeSeatDisclosures(item, "2026-11-25T03:00:00.000Z")
	assert.deepEqual(acknowledgement.previousDisclosures, ["Original disclosure"])
	assert.deepEqual(acknowledgement.currentDisclosures, ["New exit-row responsibility"])
	assert.equal(isSeatDisclosureAcknowledgementCurrent(item, acknowledgement), true)
	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [], [acknowledgement]), true)
})

test("price acceptance and disclosure acknowledgement are independently required for the same seat", () => {
	const selected = seat()
	const [item] = requirements("disclosures_and_price_changed", selected, current(selected, {
		amount: "30.00",
		disclosures: ["New disclosure"],
	}))
	const priceAcceptance = acceptSeatPriceChange(item, "2026-11-25T03:00:00.000Z")
	const disclosureAcknowledgement = acknowledgeSeatDisclosures(item, "2026-11-25T03:01:00.000Z")

	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [priceAcceptance], []), false)
	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [], [disclosureAcknowledgement]), false)
	assert.equal(
		areSeatAcceptanceRequirementsSatisfied([item], [priceAcceptance], [disclosureAcknowledgement]),
		true,
	)
})

test("acceptance is invalidated by changed price, disclosure set, service or offer identity", () => {
	const selected = seat()
	const [priceItem] = requirements("price_changed", selected, current(selected, { amount: "29.00" }))
	const priceAcceptance = acceptSeatPriceChange(priceItem, "2026-11-25T03:00:00.000Z")
	const [changedPrice] = requirements("price_changed", selected, current(selected, { amount: "31.00" }))
	assert.equal(isSeatPriceAcceptanceCurrent(changedPrice, priceAcceptance), false)

	const [disclosureItem] = requirements("disclosures_changed", selected, current(selected, {
		disclosures: ["Updated disclosure"],
	}))
	const acknowledgement = acknowledgeSeatDisclosures(disclosureItem, "2026-11-25T03:00:00.000Z")
	const [changedDisclosure] = requirements("disclosures_changed", selected, current(selected, {
		disclosures: ["Different updated disclosure"],
	}))
	assert.equal(isSeatDisclosureAcknowledgementCurrent(changedDisclosure, acknowledgement), false)

	const changedService = seat({ id: "service-2" })
	const [changedServiceItem] = requirements("price_changed", changedService, current(changedService, {
		amount: "29.00",
	}))
	assert.equal(isSeatPriceAcceptanceCurrent(changedServiceItem, priceAcceptance), false)

	const changedContext = createSeatAcceptanceRequirements(
		{ ...context, currentOfferId: "offer-new" },
		{
			status: "action_required",
			selections: [{
				status: "price_changed",
				selection: selected,
				current: current(selected, { amount: "29.00" }),
			}],
		},
	)[0]
	assert.equal(isSeatPriceAcceptanceCurrent(changedContext, priceAcceptance), false)
})

test("disclosure ordering does not invalidate acknowledgement, but disclosure content does", () => {
	const selected = seat({ disclosures: ["First", "Second"] })
	const [first] = requirements("disclosures_changed", selected, current(selected, {
		disclosures: ["Updated A", "Updated B"],
	}))
	const acknowledgement = acknowledgeSeatDisclosures(first, "2026-11-25T03:00:00.000Z")
	const [reordered] = requirements("disclosures_changed", selected, current(selected, {
		disclosures: ["Updated B", "Updated A"],
	}))
	assert.equal(isSeatDisclosureAcknowledgementCurrent(reordered, acknowledgement), true)
})

test("unavailable seats cannot satisfy review requirements through acceptance", () => {
	const [item] = requirements("unavailable")
	assert.equal(item.status, "unavailable")
	assert.equal(areSeatAcceptanceRequirementsSatisfied([item], [], []), false)
})

test("not-selected outcomes need no seat acceptances", () => {
	assert.deepEqual(createSeatAcceptanceRequirements(context, {
		status: "not_selected",
		selections: [],
	}), [])
	assert.equal(areSeatAcceptanceRequirementsSatisfied([], [], []), true)
})

test("rejects malformed seat acceptance identity and timestamps", () => {
	assert.throws(() => createSeatAcceptanceRequirements(
		{ ...context, currentOfferId: "" },
		{ status: "not_selected", selections: [] },
	))
	const [item] = requirements("price_changed", seat(), current(seat(), { amount: "29.00" }))
	assert.throws(() => acceptSeatPriceChange(item, "not-a-date"))
	assert.throws(() => acknowledgeSeatDisclosures(
		requirements("disclosures_changed")[0],
		"not-a-date",
	))
})
