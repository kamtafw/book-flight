import assert from "node:assert/strict"
import test from "node:test"
import {
	addMoney,
	calculateCheckoutPricing,
	subtractMoney,
} from "./pricing"

test("adds decimal amounts exactly without floating-point arithmetic", () => {
	assert.deepEqual(addMoney({ amount: "0.1", currency: "USD" }, { amount: "0.2", currency: "USD" }), {
		amount: "0.3",
		currency: "USD",
	})
	assert.deepEqual(addMoney({ amount: "12.40", currency: "NGN" }, { amount: "0.6", currency: "NGN" }), {
		amount: "13.00",
		currency: "NGN",
	})
})

test("subtracts exact amounts and preserves a negative difference", () => {
	assert.deepEqual(subtractMoney({ amount: "90.00", currency: "USD" }, { amount: "100.00", currency: "USD" }), {
		amount: "-10.00",
		currency: "USD",
	})
})

test("calculates flight fare, seat subtotal, add-ons and total", () => {
	const result = calculateCheckoutPricing({
		flightFare: { amount: "1200.00", currency: "USD" },
		seats: [
			{ id: "seat-a", kind: "seat", label: "12A", money: { amount: "25.50", currency: "USD" } },
			{ id: "seat-b", kind: "seat", label: "14C", money: { amount: "10.00", currency: "USD" } },
		],
		additionalServices: [
			{ id: "bag-1", kind: "additional_service", label: "Checked baggage", money: { amount: "30.00", currency: "USD" } },
		],
	})
	assert.equal(result.status, "complete")
	if (result.status !== "complete") return
	assert.deepEqual(result.seatSubtotal, { amount: "35.50", currency: "USD" })
	assert.deepEqual(result.additionalServicesSubtotal, { amount: "30.00", currency: "USD" })
	assert.deepEqual(result.total, { amount: "1265.50", currency: "USD" })
})

test("returns mixed-currency components without calculating a grand total", () => {
	const result = calculateCheckoutPricing({
		flightFare: { amount: "100.00", currency: "USD" },
		seats: [
			{ id: "seat-a", kind: "seat", label: "12A", money: { amount: "20.00", currency: "EUR" } },
		],
	})
	assert.equal(result.status, "mixed_currency")
	if (result.status !== "mixed_currency") return
	assert.deepEqual(result.currencies, ["EUR", "USD"])
	assert.equal("total" in result, false)
	assert.equal(result.components.length, 2)
})

test("rejects malformed amounts, invalid currencies and cross-currency arithmetic", () => {
	assert.throws(() => addMoney({ amount: "1e3", currency: "USD" }, { amount: "1", currency: "USD" }))
	assert.throws(() => addMoney({ amount: "-1", currency: "USD" }, { amount: "1", currency: "USD" }))
	assert.throws(() => addMoney({ amount: "1.00", currency: "usd" }, { amount: "1.00", currency: "USD" }))
	assert.throws(() => addMoney({ amount: "1.00", currency: "USD" }, { amount: "1.00", currency: "EUR" }))
})

test("rejects malformed component identities", () => {
	assert.throws(() => calculateCheckoutPricing({
		flightFare: { amount: "100", currency: "USD" },
		seats: [{ id: " ", kind: "seat", label: "12A", money: { amount: "10", currency: "USD" } }],
	}))
})

test("rejects duplicate component IDs across seat and add-on components", () => {
	assert.throws(() => calculateCheckoutPricing({
		flightFare: { amount: "100", currency: "USD" },
		seats: [{ id: "same-id", kind: "seat", label: "12A", money: { amount: "10", currency: "USD" } }],
		additionalServices: [{ id: "same-id", kind: "additional_service", label: "Bag", money: { amount: "15", currency: "USD" } }],
	}))
})

test("returns zero subtotals at the flight fare precision when no optional components exist", () => {
	const result = calculateCheckoutPricing({
		flightFare: { amount: "100.00", currency: "NGN" },
		seats: [],
	})
	assert.equal(result.status, "complete")
	if (result.status !== "complete") return
	assert.deepEqual(result.seatSubtotal, { amount: "0.00", currency: "NGN" })
	assert.deepEqual(result.additionalServicesSubtotal, { amount: "0.00", currency: "NGN" })
	assert.deepEqual(result.total, { amount: "100.00", currency: "NGN" })
})