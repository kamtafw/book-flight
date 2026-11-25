import assert from "node:assert/strict"
import test from "node:test"
import {
	acceptFlightFareChange,
	createFlightFareReview,
	isFlightFareAcceptanceCurrent,
} from "./flight-fare-review"

const identity = {
	reviewSessionId: "review-1",
	bookingSessionId: "booking-1",
	selectedOfferId: "offer-selected",
}

function review(previousPrice, currentPrice, overrides = {}) {
	return createFlightFareReview({
		identity,
		currentOfferId: "offer-refreshed",
		previousPrice,
		currentPrice,
		...overrides,
	})
}

test("unchanged amount and currency do not require acceptance", () => {
	const result = review(
		{ amount: "125.50", currency: "USD" },
		{ amount: "125.50", currency: "USD" },
	)
	assert.equal(result.status, "unchanged")
	assert.equal(result.acceptanceRequired, false)
	assert.deepEqual(result.difference, { amount: "0", currency: "USD" })
	assert.throws(() => acceptFlightFareChange(result))
})

test("an increased fare requires acceptance and exposes an exact positive difference", () => {
	const result = review(
		{ amount: "125.50", currency: "USD" },
		{ amount: "140.00", currency: "USD" },
	)
	assert.equal(result.status, "acceptance_required")
	assert.deepEqual(result.difference, { amount: "14.50", currency: "USD" })
})

test("a decreased fare still requires explicit acceptance", () => {
	const result = review(
		{ amount: "140.00", currency: "USD" },
		{ amount: "125.50", currency: "USD" },
	)
	assert.equal(result.status, "acceptance_required")
	assert.deepEqual(result.difference, { amount: "-14.50", currency: "USD" })
})

test("a currency change requires acceptance without inventing a converted difference", () => {
	const result = review(
		{ amount: "100.00", currency: "USD" },
		{ amount: "92.00", currency: "EUR" },
	)
	assert.equal(result.status, "acceptance_required")
	assert.equal(result.difference, null)
})

test("acceptance is bound to the exact current fare and offer identity", () => {
	const result = review(
		{ amount: "100.00", currency: "USD" },
		{ amount: "110.00", currency: "USD" },
	)
	const acceptance = acceptFlightFareChange(result, "2026-11-25T03:00:00.000Z")
	assert.equal(isFlightFareAcceptanceCurrent(result, acceptance), true)

	const changedAmount = review(
		{ amount: "100.00", currency: "USD" },
		{ amount: "111.00", currency: "USD" },
	)
	assert.equal(isFlightFareAcceptanceCurrent(changedAmount, acceptance), false)

	const changedOffer = review(
		{ amount: "100.00", currency: "USD" },
		{ amount: "110.00", currency: "USD" },
		{ currentOfferId: "different-refreshed-offer" },
	)
	assert.equal(isFlightFareAcceptanceCurrent(changedOffer, acceptance), false)

	const changedSession = review(
		{ amount: "100.00", currency: "USD" },
		{ amount: "110.00", currency: "USD" },
		{ identity: { ...identity, reviewSessionId: "review-2" } },
	)
	assert.equal(isFlightFareAcceptanceCurrent(changedSession, acceptance), false)
})

test("acceptance is invalidated when the previous comparison baseline changes", () => {
	const result = review(
		{ amount: "100.00", currency: "USD" },
		{ amount: "110.00", currency: "USD" },
	)
	const acceptance = acceptFlightFareChange(result, "2026-11-25T03:00:00.000Z")
	const changedBaseline = review(
		{ amount: "101.00", currency: "USD" },
		{ amount: "110.00", currency: "USD" },
	)
	assert.equal(isFlightFareAcceptanceCurrent(changedBaseline, acceptance), false)
})

test("rejects invalid money, incomplete identities, offer IDs and timestamps", () => {
	assert.throws(() => review(
		{ amount: "1e3", currency: "USD" },
		{ amount: "1000", currency: "USD" },
	))
	assert.throws(() => review(
		{ amount: "100", currency: "USD" },
		{ amount: "101", currency: "usd" },
	))
	assert.throws(() => review(
		{ amount: "100", currency: "USD" },
		{ amount: "101", currency: "USD" },
		{ identity: { ...identity, bookingSessionId: "" } },
	))
	assert.throws(() => review(
		{ amount: "100", currency: "USD" },
		{ amount: "101", currency: "USD" },
		{ currentOfferId: "" },
	))
	const changed = review(
		{ amount: "100", currency: "USD" },
		{ amount: "101", currency: "USD" },
	)
	assert.throws(() => acceptFlightFareChange(changed, "not-a-date"))
})
