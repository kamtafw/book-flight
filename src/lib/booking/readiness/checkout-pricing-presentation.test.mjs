import assert from "node:assert/strict"
import test from "node:test"
import {
	acknowledgeSeatDisclosures,
	acceptSeatPriceChange,
	createSeatAcceptanceRequirements,
} from "./seat-acceptance"
import { createFlightFareReview } from "./flight-fare-review"
import { buildCheckoutPricingPresentation } from "./checkout-pricing-presentation"

function selection(overrides = {}) {
	return {
		id: "service-1",
		passengerId: "provider-passenger-1",
		totalAmount: "25.00",
		totalCurrency: "USD",
		offerId: "selected-offer",
		segmentId: "segment-1",
		seatDesignator: "12A",
		seatName: "Window",
		disclosures: ["Original condition"],
		...overrides,
	}
}

function currentSeat(selected, overrides = {}) {
	return {
		serviceId: selected.id,
		passengerId: selected.passengerId,
		segmentId: selected.segmentId,
		seatDesignator: selected.seatDesignator,
		seatName: selected.seatName,
		amount: selected.totalAmount,
		currency: selected.totalCurrency,
		disclosures: [...selected.disclosures],
		...overrides,
	}
}

function fareReview(previousAmount = "100.00", currentAmount = "100.00", currency = "USD") {
	return createFlightFareReview({
		identity: {
			reviewSessionId: "review-1",
			bookingSessionId: "booking-1",
			selectedOfferId: "selected-offer",
		},
		currentOfferId: "current-offer",
		previousPrice: { amount: previousAmount, currency },
		currentPrice: { amount: currentAmount, currency },
	})
}

function requirementsFor(status, selected, currentOverrides = {}) {
	const selectionOutcome =
		status === "unavailable"
			? { status: "unavailable", selection: selected, reason: "seat_unavailable" }
			: status === "price_changed"
				? { status, selection: selected, current: currentSeat(selected, currentOverrides) }
				: status === "disclosures_changed"
					? {
							status,
							selection: selected,
							current: currentSeat(selected, currentOverrides),
							priceChanged: false,
						}
					: status === "disclosures_and_price_changed"
						? { status, selection: selected, current: currentSeat(selected, currentOverrides) }
						: { status: "valid", selection: selected, current: currentSeat(selected, currentOverrides) }
	return createSeatAcceptanceRequirements(
		{
			reviewSessionId: "review-1",
			bookingSessionId: "booking-1",
			selectedOfferId: "selected-offer",
			currentOfferId: "current-offer",
		},
		{ status: status === "valid" ? "valid" : "action_required", selections: [selectionOutcome] },
	)
}

function build(overrides = {}) {
	return buildCheckoutPricingPresentation({
		flightFareReview: fareReview(),
		flightFareAccepted: true,
		seatRequirements: requirementsFor("valid", selection()),
		seatPriceAcceptances: [],
		seatDisclosureAcknowledgements: [],
		passengerLabels: { "provider-passenger-1": "Alex Morgan" },
		segmentLabels: { "segment-1": "LOS → ABV" },
		...overrides,
	})
}

test("builds an exact consolidated total from current fare and validated seat prices", () => {
	const result = build()
	assert.equal(result.status, "ready")
	assert.deepEqual(result.pricing?.status, "complete")
	assert.equal(result.pricing?.seatSubtotal.amount, "25.00")
	assert.equal(result.pricing?.total.amount, "125.00")
	assert.equal(result.seatLines[0].label, "Alex Morgan · LOS → ABV · Seat 12A")
	assert.equal(result.allAcceptancesSatisfied, true)
})

test("changed flight fare remains blocked until explicitly accepted", () => {
	const review = fareReview("100.00", "115.50")
	const result = build({ flightFareReview: review, flightFareAccepted: false })
	assert.equal(result.flightFare?.acceptanceRequired, true)
	assert.equal(result.flightFare?.accepted, false)
	assert.equal(result.pricing?.status, "complete")
	assert.equal(result.pricing?.total.amount, "140.50")
	assert.equal(result.allAcceptancesSatisfied, false)
})

test("seat price and disclosure requirements remain independent", () => {
	const selected = selection()
	const requirements = requirementsFor("disclosures_and_price_changed", selected, {
		amount: "30.00",
		disclosures: ["Updated exit row condition"],
	})
	const [requirement] = requirements
	const result = build({ seatRequirements: requirements })
	assert.equal(result.seatLines[0].priceAcceptanceRequired, true)
	assert.equal(result.seatLines[0].disclosureAcknowledgementRequired, true)
	assert.equal(result.seatLines[0].priceAccepted, false)
	assert.equal(result.seatLines[0].disclosuresAcknowledged, false)
	assert.equal(result.pricing?.status, "complete")
	assert.equal(result.pricing?.total.amount, "130.00")

	const priceAcceptance = acceptSeatPriceChange(requirement, "2026-11-25T10:00:00.000Z")
	const disclosureAcknowledgement = acknowledgeSeatDisclosures(
		requirement,
		"2026-11-25T10:01:00.000Z",
	)
	const accepted = build({
		seatRequirements: requirements,
		seatPriceAcceptances: [priceAcceptance],
		seatDisclosureAcknowledgements: [disclosureAcknowledgement],
	})
	assert.equal(accepted.seatLines[0].priceAccepted, true)
	assert.equal(accepted.seatLines[0].disclosuresAcknowledged, true)
	assert.equal(accepted.allAcceptancesSatisfied, true)
})

test("unavailable seat blocks consolidated total and progression", () => {
	const result = build({
		seatRequirements: requirementsFor("unavailable", selection()),
	})
	assert.equal(result.status, "blocked")
	assert.equal(result.reason, "seat_unavailable")
	assert.equal(result.pricing, null)
	assert.equal(result.allAcceptancesSatisfied, false)
})

test("mixed currencies show component prices without a grand total", () => {
	const selected = selection({ totalCurrency: "EUR" })
	const result = build({
		seatRequirements: requirementsFor("valid", selected),
	})
	assert.equal(result.status, "mixed_currency")
	assert.equal(result.pricing?.status, "mixed_currency")
	assert.deepEqual(result.pricing?.currencies, ["EUR", "USD"])
	assert.equal(result.allAcceptancesSatisfied, false)
})

test("missing seat validation or fare review fails closed", () => {
	assert.equal(build({ seatRequirements: null }).status, "blocked")
	assert.equal(build({ flightFareReview: null }).status, "blocked")
	assert.equal(build({ seatRequirements: null }).allAcceptancesSatisfied, false)
})
