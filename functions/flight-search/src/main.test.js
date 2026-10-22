import assert from "node:assert/strict"
import test from "node:test"

import { formatDuration, mapOffer, mapPassengers, mapSeatMaps, validateRequest } from "./main.js"

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
	assert.equal(offer.currency, "USD")
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

test("normalizes unavailable seat maps to an empty list", () => {
	assert.deepEqual(mapSeatMaps([]), [])
	assert.deepEqual(mapSeatMaps(null), [])
})
