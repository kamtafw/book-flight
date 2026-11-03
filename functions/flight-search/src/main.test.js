import assert from "node:assert/strict"
import test from "node:test"
import flightSearchHandler, {
	compareOfferItinerary,
	compareSeatSelections,
	formatDuration,
	mapOffer,
	mapPassengers,
	mapSeatMaps,
	normalizeDecimal,
	validateRefreshRequest,
	validateRequest,
	validateSeatServiceRequest,
} from "./main.js"

const validRequest = {
	origin: "LOS",
	destination: "ABV",
	departureDate: "2099-05-21",
	adults: 1,
	cabinClass: "economy",
}

test("accepts a valid one-way adult search", () => {
	assert.equal(validateRequest(validRequest), null)
})

test("rejects identical origin and destination", () => {
	assert.match(validateRequest({ ...validRequest, destination: "LOS" }), /different/)
})

test("rejects malformed and past departure dates", () => {
	assert.match(validateRequest({ ...validRequest, departureDate: "21/05/2099" }), /YYYY-MM-DD/)
	assert.match(validateRequest({ ...validRequest, departureDate: "2000-01-01" }), /past/)
})

test("rejects children counts or invalid adult counts", () => {
	assert.match(validateRequest({ ...validRequest, adults: 0 }), /1 and 9 adult/)
	assert.match(validateRequest({ ...validRequest, adults: 1.5 }), /1 and 9 adult/)
})

test("accepts children and infants when valid ages are supplied", () => {
	assert.equal(validateRequest({ ...validRequest, childAges: [4, 11], infantAges: [0] }), null)
})

test("rejects invalid child and infant ages", () => {
	assert.match(validateRequest({ ...validRequest, childAges: [1] }), /age from 2 through 11/)
	assert.match(validateRequest({ ...validRequest, childAges: [12] }), /age from 2 through 11/)
	assert.match(validateRequest({ ...validRequest, infantAges: [-1] }), /age of 0 or 1/)
	assert.match(validateRequest({ ...validRequest, infantAges: [2] }), /age of 0 or 1/)
})

test("rejects unaccompanied infants and more than nine travellers", () => {
	assert.match(validateRequest({ ...validRequest, infantAges: [0, 1] }), /accompanied by an adult/)
	assert.match(
		validateRequest({ ...validRequest, adults: 8, childAges: [5, 6] }),
		/at most 9 travellers/,
	)
})

test("rejects legacy child and infant counts so they cannot be silently ignored", () => {
	assert.match(validateRequest({ ...validRequest, children: 1 }), /childAges and infantAges arrays/)
	assert.match(validateRequest({ ...validRequest, infants: 1 }), /childAges and infantAges arrays/)
})

test("maps adults by type and minors by age for Duffel", () => {
	assert.deepEqual(mapPassengers(2, [4, 10], [0]), [
		{ type: "adult" },
		{ type: "adult" },
		{ age: 4 },
		{ age: 10 },
		{ age: 0 },
	])
})

test("rejects unsupported cabin classes", () => {
	assert.match(validateRequest({ ...validRequest, cabinClass: "premium-economy" }), /cabin class/)
})

test("formats Duffel ISO durations for the UI", () => {
	assert.equal(formatDuration("PT2H35M"), "2h 35m")
	assert.equal(formatDuration("PT1H"), "1h")
	assert.equal(formatDuration("PT45M"), "45m")
})

test("maps the offer id, fare, segments, and operating carriers", () => {
	const offer = mapOffer({
		id: "off_test123",
		total_amount: "125.50",
		total_currency: "USD",
		expires_at: "2099-05-20T12:00:00Z",
		owner: { name: "Example Airways" },
		passengers: [
			{ id: "pas_adult", type: "adult" },
			{ id: "pas_child", age: 7 },
		],
		slices: [
			{
				duration: "PT1H15M",
				origin: { iata_code: "LOS" },
				destination: { iata_code: "ABV" },
				segments: [
					{
						id: "seg_1",
						origin: { iata_code: "LOS", name: "Murtala Muhammed International Airport" },
						destination: { iata_code: "ABV", name: "Nnamdi Azikiwe International Airport" },
						departing_at: "2099-05-21T08:30:00",
						arriving_at: "2099-05-21T09:45:00",
						duration: "PT1H15M",
						marketing_carrier: { name: "Example Airways", iata_code: "EA" },
						operating_carrier: { name: "Regional Partner", iata_code: "RP" },
						marketing_carrier_flight_number: "123",
					},
				],
			},
		],
	})

	assert.equal(offer.id, "off_test123")
	assert.equal(offer.price, 125.5)
	assert.equal(offer.priceAmount, "125.50")
	assert.equal(offer.currency, "USD")
	assert.deepEqual(offer.passengers, [
		{ id: "pas_adult", type: "adult", age: null },
		{ id: "pas_child", type: null, age: 7 },
	])
	assert.equal(offer.departureTime, "08:30")
	assert.equal(offer.arrivalTime, "09:45")
	assert.deepEqual(offer.operatingCarrierNames, ["Regional Partner"])
	assert.equal(offer.slices[0].segments[0].operatingCarrierName, "Regional Partner")
	assert.equal(offer.slices[0].segments[0].flightNumber, "EA 123")
})

test("normalizes provider seat maps and preserves passenger-specific service IDs", () => {
	const maps = mapSeatMaps([
		{
			id: "sea_test",
			segment_id: "seg_test",
			slice_id: "sli_test",
			cabins: [
				{
					id: "cab_test",
					deck: 0,
					rows: [
						{
							sections: [
								{
									elements: [
										{
											type: "seat",
											designator: "1A",
											name: "Window",
											disclosures: ["Extra legroom"],
											available_services: [
												{
													id: "ase_test",
													passenger_id: "pas_test",
													total_amount: "12.00",
													total_currency: "USD",
												},
											],
										},
										{ type: "exit_row" },
									],
								},
							],
						},
					],
				},
			],
		},
	])

	assert.equal(maps.length, 1)
	assert.equal(maps[0].segmentId, "seg_test")
	assert.equal(maps[0].cabins[0].rows[0].index, 0)
	assert.equal(maps[0].cabins[0].rows[0].sections[0].elements[0].designator, "1A")
	assert.deepEqual(maps[0].cabins[0].rows[0].sections[0].elements[0].availableServices, [
		{ id: "ase_test", passengerId: "pas_test", totalAmount: "12.00", totalCurrency: "USD" },
	])
	assert.equal(maps[0].cabins[0].rows[0].sections[0].elements[1].type, "exit_row")
})

test("does not invent a free price when a seat service omits price fields", () => {
	const maps = mapSeatMaps([
		{
			id: "sea_price",
			segment_id: "seg_price",
			cabins: [
				{
					rows: [
						{
							sections: [
								{
									elements: [
										{
											type: "seat",
											designator: "1A",
											available_services: [{ id: "ase_price", passenger_id: "pas_price" }],
										},
									],
								},
							],
						},
					],
				},
			],
		},
	])
	assert.deepEqual(maps[0].cabins[0].rows[0].sections[0].elements[0].availableServices, [
		{ id: "ase_price", passengerId: "pas_price", totalAmount: "", totalCurrency: "" },
	])
})

test("normalizes unavailable seat maps to an empty list", () => {
	assert.deepEqual(mapSeatMaps([]), [])
	assert.deepEqual(mapSeatMaps(null), [])
})

const expectedOfferSnapshot = {
	id: "off_refresh123",
	totalAmount: "125.50",
	totalCurrency: "USD",
	passengers: [{ id: "pas_adult" }],
	slices: [
		{
			originCode: "LOS",
			destinationCode: "ABV",
			segments: [
				{ id: "seg_1", departureAt: "2099-05-21T08:30:00", arrivalAt: "2099-05-21T09:45:00" },
			],
		},
	],
}

const refreshedOfferSnapshot = {
	passengers: [{ id: "pas_adult", type: "adult", age: null }],
	slices: [
		{
			originCode: "LOS",
			destinationCode: "ABV",
			segments: [
				{
					id: "seg_1",
					departureAt: "2099-05-21T08:30:00",
					arrivalAt: "2099-05-21T09:45:00",
				},
			],
		},
	],
}

test("validates a refresh request with the selected offer snapshot", () => {
	assert.equal(
		validateRefreshRequest({
			action: "refresh-offer",
			offerId: "off_refresh123",
			expectedOffer: expectedOfferSnapshot,
		}),
		null,
	)
})

test("rejects refresh requests without a complete comparable snapshot", () => {
	assert.match(validateRefreshRequest({ offerId: "off_refresh123" }), /selected offer snapshot/)
	assert.match(
		validateRefreshRequest({
			offerId: "off_refresh123",
			expectedOffer: { ...expectedOfferSnapshot, totalAmount: "NaN" },
		}),
		/amount and currency/,
	)
	assert.match(
		validateRefreshRequest({
			offerId: "off_refresh123",
			expectedOffer: { ...expectedOfferSnapshot, id: "off_other" },
		}),
		/selected offer snapshot/,
	)
})

test("compares decimal prices without floating-point conversion", () => {
	assert.equal(normalizeDecimal("00125.5000"), "125.5")
	assert.equal(normalizeDecimal("125.50"), normalizeDecimal("125.5"))
	assert.equal(normalizeDecimal("invalid"), null)
})

test("treats changed carrier display metadata as non-material", () => {
	const current = {
		...refreshedOfferSnapshot,
		slices: [
			{
				...refreshedOfferSnapshot.slices[0],
				segments: [
					{
						...refreshedOfferSnapshot.slices[0].segments[0],
						marketingCarrierName: "A different display name",
					},
				],
			},
		],
	}
	assert.deepEqual(compareOfferItinerary(expectedOfferSnapshot, current), [])
})

test("detects material route, segment, schedule, and passenger identity changes", () => {
	const changed = {
		passengers: [{ id: "pas_replaced", type: "adult", age: null }],
		slices: [
			{
				originCode: "LOS",
				destinationCode: "KAN",
				segments: [
					{
						id: "seg_changed",
						departureAt: "2099-05-21T09:30:00",
						arrivalAt: "2099-05-21T10:45:00",
					},
				],
			},
		],
	}
	assert.deepEqual(compareOfferItinerary(expectedOfferSnapshot, changed), [
		"passenger_identity",
		"slice_1_route",
		"slice_1_segment_1",
	])
})

test("detects changes in slice and segment counts", () => {
	const changed = {
		...refreshedOfferSnapshot,
		slices: [
			...refreshedOfferSnapshot.slices,
			{
				originCode: "ABV",
				destinationCode: "LOS",
				segments: [],
			},
		],
	}
	assert.deepEqual(compareOfferItinerary(expectedOfferSnapshot, changed), ["slice_count"])
})

test("rejects refresh snapshots with invalid route codes or timestamps", () => {
	assert.match(
		validateRefreshRequest({
			offerId: expectedOfferSnapshot.id,
			expectedOffer: {
				...expectedOfferSnapshot,
				slices: [{ ...expectedOfferSnapshot.slices[0], originCode: "" }],
			},
		}),
		/invalid passenger or itinerary/,
	)
	assert.match(
		validateRefreshRequest({
			offerId: expectedOfferSnapshot.id,
			expectedOffer: {
				...expectedOfferSnapshot,
				slices: [
					{
						...expectedOfferSnapshot.slices[0],
						segments: [
							{
								...expectedOfferSnapshot.slices[0].segments[0],
								departureAt: "not-a-date",
							},
						],
					},
				],
			},
		}),
		/invalid passenger or itinerary/,
	)
	assert.match(
		validateRefreshRequest({
			offerId: expectedOfferSnapshot.id,
			expectedOffer: {
				...expectedOfferSnapshot,
				slices: [
					{
						...expectedOfferSnapshot.slices[0],
						segments: [
							{
								...expectedOfferSnapshot.slices[0].segments[0],
								id: " ",
							},
						],
					},
				],
			},
		}),
		/invalid passenger or itinerary/,
	)
})

const providerOffer = {
	id: expectedOfferSnapshot.id,
	total_amount: "125.50",
	total_currency: "USD",
	expires_at: "2099-05-20T12:00:00Z",
	owner: { name: "Example Airways" },
	passengers: [{ id: "pas_adult", type: "adult" }],
	slices: [
		{
			origin: { iata_code: "LOS" },
			destination: { iata_code: "ABV" },
			segments: [
				{
					id: "seg_1",
					origin: { iata_code: "LOS", name: "Lagos" },
					destination: { iata_code: "ABV", name: "Abuja" },
					departing_at: "2099-05-21T08:30:00",
					arriving_at: "2099-05-21T09:45:00",
					marketing_carrier: { name: "Example Airways", iata_code: "EA" },
					operating_carrier: { name: "Example Airways", iata_code: "EA" },
					marketing_carrier_flight_number: "123",
				},
			],
		},
	],
}

async function invokeRefresh({
	status = 200,
	payload = { data: providerOffer },
	fetchError,
	inspectRequest,
} = {}) {
	const previousToken = process.env.DUFFEL_ACCESS_TOKEN
	const previousFetch = globalThis.fetch
	process.env.DUFFEL_ACCESS_TOKEN = "test-duffel-token"
	globalThis.fetch = async (url, options) => {
		inspectRequest?.(url, options)
		if (fetchError) throw fetchError
		return {
			ok: status >= 200 && status < 300,
			status,
			json: async () => payload,
		}
	}
	const calls = { body: null, status: 200, errors: [], logs: [] }
	const res = {
		json(body, responseStatus = 200) {
			calls.body = body
			calls.status = responseStatus
			return body
		},
	}
	try {
		await flightSearchHandler({
			req: {
				method: "POST",
				bodyJson: {
					action: "refresh-offer",
					offerId: expectedOfferSnapshot.id,
					expectedOffer: expectedOfferSnapshot,
				},
			},
			res,
			log: (message) => calls.logs.push(message),
			error: (message) => calls.errors.push(message),
		})
		return calls
	} finally {
		globalThis.fetch = previousFetch
		if (previousToken === undefined) delete process.env.DUFFEL_ACCESS_TOKEN
		else process.env.DUFFEL_ACCESS_TOKEN = previousToken
	}
}

test("refresh handler calls the Duffel offer endpoint with server credentials and returns valid", async () => {
	const calls = await invokeRefresh({
		inspectRequest(url, options) {
			assert.equal(url, `https://api.duffel.com/air/offers/${expectedOfferSnapshot.id}`)
			assert.equal(options.method, "GET")
			assert.equal(options.headers.Authorization, "Bearer test-duffel-token")
			assert.equal(options.headers.Accept, "application/json")
			assert.equal(options.headers["Duffel-Version"], "v2")
		},
	})
	assert.equal(calls.status, 200)
	assert.equal(calls.body.status, "valid")
	assert.equal(calls.body.offer.priceAmount, "125.50")
})

test("refresh handler requires explicit acceptance when currency changes", async () => {
	const calls = await invokeRefresh({
		payload: { data: { ...providerOffer, total_currency: "EUR" } },
	})
	assert.equal(calls.status, 200)
	assert.equal(calls.body.status, "price_changed")
	assert.equal(calls.body.previousPrice.currency, "USD")
	assert.equal(calls.body.currentPrice.currency, "EUR")
})

test("refresh handler returns unavailable for Duffel offer_no_longer_available", async () => {
	const calls = await invokeRefresh({
		status: 422,
		payload: { errors: [{ code: "offer_no_longer_available", message: "Offer expired" }] },
	})
	assert.equal(calls.status, 200)
	assert.equal(calls.body.status, "unavailable")
	assert.equal(calls.body.code, "OFFER_NO_LONGER_AVAILABLE")
})

test("refresh handler keeps provider failures distinct from unavailable offers", async () => {
	const calls = await invokeRefresh({
		status: 500,
		payload: { errors: [{ code: "internal_error" }] },
	})
	assert.equal(calls.status, 502)
	assert.equal(calls.body.code, "DUFFEL_OFFER_REFRESH_FAILED")
	assert.notEqual(calls.body.status, "unavailable")
})

test("refresh handler reports network and timeout failures as verification errors", async () => {
	const network = await invokeRefresh({ fetchError: new Error("connection reset") })
	assert.equal(network.status, 502)
	assert.equal(network.body.code, "DUFFEL_OFFER_REFRESH_UNAVAILABLE")
	assert.notEqual(network.body.status, "unavailable")

	const timeoutError = new Error("aborted")
	timeoutError.name = "AbortError"
	const timeout = await invokeRefresh({ fetchError: timeoutError })
	assert.equal(timeout.status, 502)
	assert.match(timeout.body.error, /took too long/)
})

test("refresh handler rejects missing, null, and malformed provider expiry timestamps", async () => {
	for (const expiry of [undefined, null, "not-a-date"]) {
		const offer = { ...providerOffer }
		if (expiry === undefined) delete offer.expires_at
		else offer.expires_at = expiry
		const calls = await invokeRefresh({ payload: { data: offer } })
		assert.equal(calls.status, 502)
		assert.equal(calls.body.code, "DUFFEL_INVALID_OFFER_RESPONSE")
	}
})

test("refresh handler marks an expired provider offer unavailable", async () => {
	const calls = await invokeRefresh({
		payload: { data: { ...providerOffer, expires_at: "2000-01-01T00:00:00Z" } },
	})
	assert.equal(calls.status, 200)
	assert.equal(calls.body.status, "unavailable")
	assert.equal(calls.body.code, "OFFER_EXPIRED")
})

test("refresh handler rejects malformed or mismatched provider offer identities", async () => {
	const calls = await invokeRefresh({
		payload: { data: { ...providerOffer, id: "off_another" } },
	})
	assert.equal(calls.status, 502)
	assert.equal(calls.body.code, "DUFFEL_INVALID_OFFER_RESPONSE")
})

test("refresh handler requires explicit acceptance when the fare amount changes", async () => {
	const calls = await invokeRefresh({
		payload: { data: { ...providerOffer, total_amount: "126.00" } },
	})
	assert.equal(calls.status, 200)
	assert.equal(calls.body.status, "price_changed")
	assert.equal(calls.body.previousPrice.amount, "125.50")
	assert.equal(calls.body.currentPrice.amount, "126.00")
})

test("refresh handler blocks material itinerary changes", async () => {
	const changedOffer = {
		...providerOffer,
		slices: [
			{
				...providerOffer.slices[0],
				destination: { iata_code: "KAN" },
			},
		],
	}
	const calls = await invokeRefresh({ payload: { data: changedOffer } })
	assert.equal(calls.status, 200)
	assert.equal(calls.body.status, "itinerary_changed")
	assert.deepEqual(calls.body.materialDifferences, ["slice_1_route"])
})


const selectedSeatFixture = {
	serviceId: "ase_seat1",
	passengerId: "pas_adult",
	segmentId: "seg_1",
	seatDesignator: "12A",
	expectedAmount: "25.00",
	expectedCurrency: "USD",
	expectedSeatName: "Window",
	expectedDisclosures: [],
}

function seatMapFixture({ amount = "25.00", currency = "USD", disclosures = [], serviceId = "ase_seat1", passengerId = "pas_adult", designator = "12A" } = {}) {
	return {
		id: "sea_1",
		segment_id: "seg_1",
		slice_id: "sli_1",
		cabins: [{
			id: "cab_1",
			rows: [{
				sections: [{
					elements: [{
						type: "seat",
						designator,
						name: "Window",
						disclosures,
						available_services: [{
							id: serviceId,
							passenger_id: passengerId,
							total_amount: amount,
							total_currency: currency,
						}],
					}],
				}],
			}],
		}],
	}
}

test("validates selected-seat requests and rejects duplicate passenger or seat assignments", () => {
	assert.equal(validateSeatServiceRequest({
		action: "validate-seat-services",
		offerId: "off_test123",
		selectedSeats: [selectedSeatFixture],
	}), null)
	assert.match(validateSeatServiceRequest({
		offerId: "off_test123",
		selectedSeats: [{ ...selectedSeatFixture, passengerId: "invalid" }],
	}), /provider identities/)
	assert.match(validateSeatServiceRequest({
		offerId: "off_test123",
		selectedSeats: [selectedSeatFixture, { ...selectedSeatFixture, serviceId: "ase_seat2", seatDesignator: "12B" }],
	}), /only one seat per segment/)
	assert.match(validateSeatServiceRequest({
		offerId: "off_test123",
		selectedSeats: [selectedSeatFixture, { ...selectedSeatFixture, serviceId: "ase_seat2", passengerId: "pas_child" }],
	}), /same seat on one segment/)
})

test("validates no-selection requests without requiring a provider lookup", () => {
	assert.equal(validateSeatServiceRequest({
		offerId: "off_test123",
		selectedSeats: [],
	}), null)
})

test("compares selected seats against fresh provider services by segment, seat, service and passenger", () => {
	const valid = compareSeatSelections([selectedSeatFixture], [seatMapFixture()])
	assert.equal(valid.status, "valid")
	assert.equal(valid.selections[0].current.serviceId, "ase_seat1")
	assert.equal(valid.selections[0].current.passengerId, "pas_adult")

	const wrongPassenger = compareSeatSelections(
		[selectedSeatFixture],
		[seatMapFixture({ passengerId: "pas_child" })],
	)
	assert.equal(wrongPassenger.status, "selection_changed")
	assert.equal(wrongPassenger.selections[0].reason, "service_unavailable")

	const wrongService = compareSeatSelections(
		[selectedSeatFixture],
		[seatMapFixture({ serviceId: "ase_replaced" })],
	)
	assert.equal(wrongService.status, "selection_changed")
})

test("classifies seat price and currency changes without floating-point arithmetic", () => {
	const price = compareSeatSelections(
		[selectedSeatFixture],
		[seatMapFixture({ amount: "25.50" })],
	)
	assert.equal(price.status, "price_changed")
	assert.equal(price.selections[0].current.amount, "25.50")
	assert.equal(price.selections[0].priceChanged, true)

	const currency = compareSeatSelections(
		[selectedSeatFixture],
		[seatMapFixture({ currency: "GBP" })],
	)
	assert.equal(currency.status, "price_changed")
	assert.equal(currency.selections[0].current.currency, "GBP")
})

test("requires review when seat disclosures change", () => {
	const result = compareSeatSelections(
		[selectedSeatFixture],
		[seatMapFixture({ disclosures: ["Exit row seat"] })],
	)
	assert.equal(result.status, "selection_changed")
	assert.equal(result.selections[0].reason, "seat_disclosures_changed")
	assert.deepEqual(result.selections[0].current.disclosures, ["Exit row seat"])
})

test("returns every selected seat result when only some selections remain available", () => {
	const second = {
		...selectedSeatFixture,
		serviceId: "ase_seat2",
		passengerId: "pas_child",
		seatDesignator: "12B",
	}
	const result = compareSeatSelections(
		[selectedSeatFixture, second],
		[seatMapFixture()],
	)
	assert.equal(result.status, "selection_changed")
	assert.equal(result.selections.length, 2)
	assert.equal(result.selections[0].status, "valid")
	assert.equal(result.selections[1].status, "selection_changed")
})

async function invokeSeatValidation({
	selectedSeats = [selectedSeatFixture],
	status = 200,
	payload = { data: [seatMapFixture()] },
	fetchError,
	inspectRequest,
} = {}) {
	const previousToken = process.env.DUFFEL_ACCESS_TOKEN
	const previousFetch = globalThis.fetch
	process.env.DUFFEL_ACCESS_TOKEN = "test-duffel-token"
	globalThis.fetch = async (url, options) => {
		inspectRequest?.(url, options)
		if (fetchError) throw fetchError
		return {
			ok: status >= 200 && status < 300,
			status,
			json: async () => payload,
		}
	}
	const calls = { body: null, status: 200, errors: [], logs: [], fetchCount: 0 }
	const res = {
		json(body, responseStatus = 200) {
			calls.body = body
			calls.status = responseStatus
			return body
		},
	}
	try {
		await flightSearchHandler({
			req: {
				method: "POST",
				bodyJson: {
					action: "validate-seat-services",
					offerId: "off_test123",
					selectedSeats,
				},
			},
			res,
			log: (message) => calls.logs.push(message),
			error: (message) => calls.errors.push(message),
		})
		return calls
	} finally {
		globalThis.fetch = previousFetch
		if (previousToken === undefined) delete process.env.DUFFEL_ACCESS_TOKEN
		else process.env.DUFFEL_ACCESS_TOKEN = previousToken
	}
}

test("seat validation fetches fresh Duffel seat maps with server credentials", async () => {
	const calls = await invokeSeatValidation({
		inspectRequest(url, options) {
			assert.equal(String(url), "https://api.duffel.com/air/seat_maps?offer_id=off_test123")
			assert.equal(options.method, "GET")
			assert.equal(options.headers.Authorization, "Bearer test-duffel-token")
			assert.equal(options.headers.Accept, "application/json")
			assert.equal(options.headers["Duffel-Version"], "v2")
		},
	})
	assert.equal(calls.status, 200)
	assert.equal(calls.body.status, "valid")
	assert.equal(calls.body.selections[0].current.amount, "25.00")
})

test("seat validation skips Duffel entirely when no seats were selected", async () => {
	const previousToken = process.env.DUFFEL_ACCESS_TOKEN
	const previousFetch = globalThis.fetch
	delete process.env.DUFFEL_ACCESS_TOKEN
	let fetchCount = 0
	globalThis.fetch = async () => {
		fetchCount += 1
		throw new Error("Should not fetch")
	}
	const calls = { body: null, status: 200 }
	const res = { json(body, status = 200) { calls.body = body; calls.status = status; return body } }
	try {
		await flightSearchHandler({
			req: { method: "POST", bodyJson: { action: "validate-seat-services", offerId: "off_test123", selectedSeats: [] } },
			res,
			log: () => {},
			error: () => {},
		})
	} finally {
		globalThis.fetch = previousFetch
		if (previousToken !== undefined) process.env.DUFFEL_ACCESS_TOKEN = previousToken
	}
	assert.equal(fetchCount, 0)
	assert.deepEqual(calls.body, { status: "not_selected", selections: [] })
})

test("seat validation treats provider failures as technical errors, not seat unavailability", async () => {
	const failed = await invokeSeatValidation({ status: 503, payload: { errors: [{ message: "Unavailable" }] } })
	assert.equal(failed.status, 502)
	assert.equal(failed.body.code, "DUFFEL_SEAT_VALIDATION_FAILED")

	const network = await invokeSeatValidation({ fetchError: new Error("network down") })
	assert.equal(network.status, 502)
	assert.equal(network.body.code, "DUFFEL_SEAT_VALIDATION_UNAVAILABLE")
})
