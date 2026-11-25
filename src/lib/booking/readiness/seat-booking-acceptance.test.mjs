import assert from "node:assert/strict"
import test from "node:test"
import { createOfferReviewOutcome } from "./offer-review"
import { useFlightBookingStore } from "@/store/flight-booking.store"

function offer(id) {
	return {
		id,
		airline: "Example Air",
		flightNumber: "EA 101",
		departureTime: "2027-05-21T08:30:00Z",
		arrivalTime: "2027-05-21T09:45:00Z",
		duration: "1h 15m",
		price: 100,
		priceAmount: "100.00",
		currency: "USD",
		expiresAt: "2027-05-21T10:00:00Z",
		operatingCarrierNames: ["Example Air"],
		passengers: [{ id: "pas-1", type: "adult", age: 30 }],
		slices: [{
			originCode: "LOS",
			destinationCode: "ABV",
			duration: "1h 15m",
			segments: [{
				id: "seg-1",
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

function seat(id, passengerId, designator, amount = "25.00") {
	return {
		id,
		passengerId,
		totalAmount: amount,
		totalCurrency: "USD",
		offerId: "offer-selected",
		segmentId: "seg-1",
		seatDesignator: designator,
		seatName: "Window",
		disclosures: ["Original disclosure"],
	}
}

function validated(selection, overrides = {}) {
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

function priceChanged(selection, amount) {
	return {
		status: "price_changed",
		selection,
		current: validated(selection, { amount }),
	}
}

function disclosuresChanged(selection, disclosures) {
	return {
		status: "disclosures_changed",
		selection,
		current: validated(selection, { disclosures }),
		priceChanged: false,
	}
}

function valid(selection) {
	return { status: "valid", selection, current: validated(selection) }
}

function prepareStore(selections, seatOutcomeSelections) {
	const store = useFlightBookingStore
	store.getState().abandonBookingSession()
	const original = offer("offer-selected")
	const refreshed = offer("offer-current")
	store.getState().beginBookingSession({ id: original.id })
	store.getState().getOrCreateCheckoutReviewSession(original.id)
	const offerAttempt = store.getState().startOfferReviewRefresh()
	assert.ok(offerAttempt)
	const offerOutcome = createOfferReviewOutcome(original, { status: "valid", offer: refreshed })
	assert.equal(store.getState().completeOfferReviewRefresh(offerAttempt, offerOutcome), true)

	for (const selection of selections) store.getState().selectOutboundSeatService(selection)
	const seatAttempt = store.getState().startSeatReviewValidation("2027-05-21T10:00:00Z")
	assert.equal(seatAttempt.kind, "started")
	assert.equal(
		store.getState().completeSeatReviewValidation(seatAttempt.attempt, {
			status: seatOutcomeSelections.every((item) => item.status === "valid") ? "valid" : "action_required",
			selections: seatOutcomeSelections,
		}),
		true,
	)
	return store
}

test("store requires price acceptance and disclosure acknowledgement independently", () => {
	const selected = seat("service-1", "pas-1", "12A")
	const store = prepareStore(
		[selected],
		[{
			status: "disclosures_and_price_changed",
			selection: selected,
			current: validated(selected, {
				amount: "30.00",
				disclosures: ["Updated exit-row responsibility"],
			}),
		}],
	)
	const [requirement] = store.getState().getCurrentSeatAcceptanceRequirements()
	assert.equal(store.getState().areCurrentSeatRequirementsSatisfied(), false)

	assert.equal(
		store.getState().acceptCurrentSeatPriceChange(requirement.componentKey, "2026-11-25T03:00:00.000Z"),
		true,
	)
	assert.equal(store.getState().areCurrentSeatRequirementsSatisfied(), false)

	assert.equal(
		store.getState().acknowledgeCurrentSeatDisclosures(requirement.componentKey, "2026-11-25T03:01:00.000Z"),
		true,
	)
	assert.equal(store.getState().areCurrentSeatRequirementsSatisfied(), true)
})

test("unrelated accepted seat components remain accepted when another seat selection changes", () => {
	const first = seat("service-1", "pas-1", "12A")
	const second = seat("service-2", "pas-2", "14C")
	const store = prepareStore(
		[first, second],
		[priceChanged(first, "30.00"), priceChanged(second, "35.00")],
	)
	const [firstRequirement, secondRequirement] = store.getState().getCurrentSeatAcceptanceRequirements()
	assert.equal(store.getState().acceptCurrentSeatPriceChange(firstRequirement.componentKey), true)
	assert.equal(store.getState().areCurrentSeatRequirementsSatisfied(), false)

	const replacement = seat("service-3", "pas-2", "15A")
	store.getState().selectOutboundSeatService(replacement)
	const nextAttempt = store.getState().startSeatReviewValidation("2027-05-21T10:00:00Z")
	assert.equal(nextAttempt.kind, "started")
	assert.equal(
		store.getState().completeSeatReviewValidation(nextAttempt.attempt, {
			status: "action_required",
			selections: [priceChanged(first, "30.00"), valid(replacement)],
		}),
		true,
	)

	const requirements = store.getState().getCurrentSeatAcceptanceRequirements()
	assert.equal(requirements.length, 2)
	assert.equal(store.getState().seatPriceAcceptances.length, 1)
	assert.equal(store.getState().areCurrentSeatRequirementsSatisfied(), true)
	assert.equal(store.getState().acceptCurrentSeatPriceChange(secondRequirement.componentKey), false)
})

test("a fresh offer refresh invalidates all seat price and disclosure acceptances", () => {
	const selected = seat("service-1", "pas-1", "12A")
	const store = prepareStore(
		[selected],
		[{
			status: "disclosures_and_price_changed",
			selection: selected,
			current: validated(selected, {
				amount: "30.00",
				disclosures: ["Updated disclosure"],
			}),
		}],
	)
	const [requirement] = store.getState().getCurrentSeatAcceptanceRequirements()
	store.getState().acceptCurrentSeatPriceChange(requirement.componentKey)
	store.getState().acknowledgeCurrentSeatDisclosures(requirement.componentKey)
	assert.equal(store.getState().areCurrentSeatRequirementsSatisfied(), true)

	const attempt = store.getState().startOfferReviewRefresh()
	assert.ok(attempt)
	assert.equal(store.getState().seatPriceAcceptances.length, 0)
	assert.equal(store.getState().seatDisclosureAcknowledgements.length, 0)
	assert.equal(store.getState().getCurrentSeatAcceptanceRequirements(), null)
})

test("unavailable seats and missing current validation cannot be accepted", () => {
	const selected = seat("service-1", "pas-1", "12A")
	const store = prepareStore(
		[selected],
		[{ status: "unavailable", selection: selected, reason: "seat_unavailable" }],
	)
	const [requirement] = store.getState().getCurrentSeatAcceptanceRequirements()
	assert.equal(requirement.status, "unavailable")
	assert.equal(store.getState().acceptCurrentSeatPriceChange(requirement.componentKey), false)
	assert.equal(store.getState().acknowledgeCurrentSeatDisclosures(requirement.componentKey), false)
	assert.equal(store.getState().areCurrentSeatRequirementsSatisfied(), false)
})

test("a review with no selected seats has no seat acceptance requirements", () => {
	const store = useFlightBookingStore
	store.getState().abandonBookingSession()
	const original = offer("offer-selected")
	const refreshed = offer("offer-current")
	store.getState().beginBookingSession({ id: original.id })
	store.getState().getOrCreateCheckoutReviewSession(original.id)
	const offerAttempt = store.getState().startOfferReviewRefresh()
	assert.ok(offerAttempt)
	const offerOutcome = createOfferReviewOutcome(original, { status: "valid", offer: refreshed })
	assert.equal(store.getState().completeOfferReviewRefresh(offerAttempt, offerOutcome), true)

	const seatStart = store.getState().startSeatReviewValidation("2027-05-21T10:00:00Z")
	assert.equal(seatStart.kind, "not_selected")
	assert.deepEqual(store.getState().getCurrentSeatAcceptanceRequirements(), [])
	assert.equal(store.getState().areCurrentSeatRequirementsSatisfied(), true)
})
