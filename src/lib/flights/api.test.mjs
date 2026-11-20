import assert from "node:assert/strict"
import test from "node:test"
import { buildOfferRefreshSnapshot, refreshOffer } from "./api"
import { FlightSearchError } from "@/lib/flights/types"

function makeOffer() {
	return {
		id: "off_refresh123",
		airline: "Example Air",
		flightNumber: "EA 101",
		departureTime: "2027-05-21T08:30:00Z",
		arrivalTime: "2027-05-21T09:45:00Z",
		duration: "1h 15m",
		price: 125.5,
		priceAmount: "125.50",
		currency: "USD",
		expiresAt: "2027-05-21T10:00:00Z",
		operatingCarrierNames: ["Example Air"],
		passengers: [{ id: "pas_adult", type: "adult", age: 30 }],
		slices: [{
			originCode: "LOS",
			destinationCode: "ABV",
			duration: "1h 15m",
			segments: [{
				id: "seg_example",
				departureAirportCode: "LOS",
				departureAirportName: "Lagos",
				departureAt: "2027-05-21T08:30:00Z",
				arrivalAirportCode: "ABV",
				arrivalAirportName: "Abuja",
				arrivalAt: "2027-05-21T09:45:00Z",
				marketingCarrierName: "Example Air",
				marketingCarrierCode: "EA",
				operatingCarrierName: "Example Air",
				operatingCarrierCode: "EA",
				flightNumber: "101",
				duration: "1h 15m",
			}],
		}],
	}
}

function mockExecution(body, responseStatusCode = 200) {
	return new Response(
		JSON.stringify({ responseBody: JSON.stringify(body), responseStatusCode }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	)
}

function withFetch(response, run, verifyRequest) {
	const originalFetch = globalThis.fetch
	const originalEnv = {
		endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
		projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
		functionId: process.env.EXPO_PUBLIC_APPWRITE_FLIGHT_SEARCH_FUNCTION_ID,
	}
	process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT = "https://appwrite.example/v1"
	process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID = "project"
	process.env.EXPO_PUBLIC_APPWRITE_FLIGHT_SEARCH_FUNCTION_ID = "flight-search"
	globalThis.fetch = async (input, init) => {
		verifyRequest?.(input, init)
		return response
	}
	return run().finally(() => {
		globalThis.fetch = originalFetch
		if (originalEnv.endpoint === undefined) delete process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT
		else process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT = originalEnv.endpoint
		if (originalEnv.projectId === undefined) delete process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID
		else process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID = originalEnv.projectId
		if (originalEnv.functionId === undefined) delete process.env.EXPO_PUBLIC_APPWRITE_FLIGHT_SEARCH_FUNCTION_ID
		else process.env.EXPO_PUBLIC_APPWRITE_FLIGHT_SEARCH_FUNCTION_ID = originalEnv.functionId
	})
}

test("builds the BR-02 expected snapshot from provider identities and original decimal price", () => {
	const snapshot = buildOfferRefreshSnapshot(makeOffer())
	assert.deepEqual(snapshot, {
		id: "off_refresh123",
		totalAmount: "125.50",
		totalCurrency: "USD",
		passengers: [{ id: "pas_adult" }],
		slices: [{
			originCode: "LOS",
			destinationCode: "ABV",
			segments: [{
				id: "seg_example",
				departureAt: "2027-05-21T08:30:00Z",
				arrivalAt: "2027-05-21T09:45:00Z",
			}],
		}],
	})
})

test("refuses to reconstruct a missing provider price from the numeric display price", () => {
	const offer = { ...makeOffer(), priceAmount: null }
	assert.throws(
		() => buildOfferRefreshSnapshot(offer),
		(error) => error instanceof FlightSearchError && error.code === "INVALID_OFFER_PRICE",
	)
})

test("sends the refresh-offer action and returns a validated current offer", async () => {
	const original = makeOffer()
	const refreshed = { ...original, price: 125.5, priceAmount: "125.50" }
	await withFetch(
		mockExecution({ status: "valid", offer: refreshed }),
		async () => {
			const result = await refreshOffer(original)
			assert.equal(result.status, "valid")
			if (result.status === "valid") assert.equal(result.offer.priceAmount, "125.50")
		},
		(input, init) => {
			assert.equal(String(input), "https://appwrite.example/v1/functions/flight-search/executions")
			assert.equal(init?.method, "POST")
			const execution = JSON.parse(String(init?.body))
			const payload = JSON.parse(execution.body)
			assert.equal(payload.action, "refresh-offer")
			assert.equal(payload.offerId, original.id)
			assert.equal(payload.expectedOffer.totalAmount, "125.50")
			assert.deepEqual(payload.expectedOffer.passengers, [{ id: "pas_adult" }])
		},
	)
})

test("returns unavailable as a business outcome rather than a technical error", async () => {
	await withFetch(
		mockExecution({
			status: "unavailable",
			code: "OFFER_NO_LONGER_AVAILABLE",
			message: "This flight is no longer available.",
		}),
		async () => {
			const result = await refreshOffer(makeOffer())
			assert.deepEqual(result, {
				status: "unavailable",
				code: "OFFER_NO_LONGER_AVAILABLE",
				message: "This flight is no longer available.",
			})
		},
	)
})

test("preserves itinerary-changed precedence when the fare also changed", async () => {
	const original = makeOffer()
	const refreshed = { ...original, price: 140, priceAmount: "140.00" }
	await withFetch(
		mockExecution({
			status: "itinerary_changed",
			materialDifferences: ["slice_1_segment_1"],
			priceChanged: true,
			previousPrice: { amount: "125.50", currency: "USD" },
			currentPrice: { amount: "140.00", currency: "USD" },
			offer: refreshed,
		}),
		async () => {
			const result = await refreshOffer(original)
			assert.equal(result.status, "itinerary_changed")
			if (result.status === "itinerary_changed") assert.equal(result.priceChanged, true)
		},
	)
})

test("maps backend technical failures to FlightSearchError", async () => {
	await withFetch(
		mockExecution({ error: "Provider request failed.", code: "DUFFEL_OFFER_REFRESH_FAILED" }, 502),
		async () => {
			await assert.rejects(
				refreshOffer(makeOffer()),
				(error) =>
					error instanceof FlightSearchError &&
					error.code === "DUFFEL_OFFER_REFRESH_FAILED",
			)
		},
	)
})

test("rejects malformed provider response shapes", async () => {
	await withFetch(mockExecution({ status: "valid", offer: { id: "off_refresh123" } }), async () => {
		await assert.rejects(
			refreshOffer(makeOffer()),
			(error) => error instanceof FlightSearchError && error.code === "INVALID_RESPONSE",
		)
	})
})


test("returns changed fare details without treating them as an itinerary failure", async () => {
	const original = makeOffer()
	const refreshed = { ...original, price: 140, priceAmount: "140.00" }
	await withFetch(
		mockExecution({
			status: "price_changed",
			previousPrice: { amount: "125.50", currency: "USD" },
			currentPrice: { amount: "140.00", currency: "USD" },
			offer: refreshed,
		}),
		async () => {
			const result = await refreshOffer(original)
			assert.equal(result.status, "price_changed")
			if (result.status === "price_changed") {
				assert.equal(result.previousPrice.amount, "125.50")
				assert.equal(result.currentPrice.amount, "140.00")
			}
		},
	)
})
