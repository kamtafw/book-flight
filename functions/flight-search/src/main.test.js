import test from "node:test"
import assert from "node:assert/strict"

import { formatDuration, mapOffer, validateRequest } from "./main.js"

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
    slices: [{
      duration: "PT1H15M",
      origin: { iata_code: "LOS" },
      destination: { iata_code: "ABV" },
      segments: [{
        id: "seg_1",
        origin: { iata_code: "LOS", name: "Murtala Muhammed International Airport" },
        destination: { iata_code: "ABV", name: "Nnamdi Azikiwe International Airport" },
        departing_at: "2099-05-21T08:30:00",
        arriving_at: "2099-05-21T09:45:00",
        duration: "PT1H15M",
        marketing_carrier: { name: "Example Airways", iata_code: "EA" },
        operating_carrier: { name: "Regional Partner", iata_code: "RP" },
        marketing_carrier_flight_number: "123",
      }],
    }],
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
