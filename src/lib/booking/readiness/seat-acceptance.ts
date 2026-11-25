import { addMoney, type Money } from "./pricing"
import type { SeatReviewOutcome, SeatReviewSelectionOutcome } from "./seat-review"

export interface SeatAcceptanceIdentity {
	reviewSessionId: string
	bookingSessionId: string
	selectedOfferId: string
	currentOfferId: string
	serviceId: string
	passengerId: string
	segmentId: string
	seatDesignator: string
}

export interface SeatPriceAcceptance {
	identity: SeatAcceptanceIdentity
	previousPrice: Money
	currentPrice: Money
	acceptedAt: string
}

export interface SeatDisclosureAcknowledgement {
	identity: SeatAcceptanceIdentity
	previousDisclosures: string[]
	currentDisclosures: string[]
	acknowledgedAt: string
}

export type SeatAcceptanceRequirement =
	| {
			status: "valid"
			componentKey: string
			identity: SeatAcceptanceIdentity
			selection: SeatReviewSelectionOutcome & { status: "valid" }
			priceAcceptanceRequired: false
			disclosureAcknowledgementRequired: false
	  }
	| {
			status: "price_changed"
			componentKey: string
			identity: SeatAcceptanceIdentity
			selection: SeatReviewSelectionOutcome & { status: "price_changed" }
			previousPrice: Money
			currentPrice: Money
			priceAcceptanceRequired: true
			disclosureAcknowledgementRequired: false
	  }
	| {
			status: "disclosures_changed"
			componentKey: string
			identity: SeatAcceptanceIdentity
			selection: SeatReviewSelectionOutcome & { status: "disclosures_changed" }
			previousDisclosures: string[]
			currentDisclosures: string[]
			priceAcceptanceRequired: false
			disclosureAcknowledgementRequired: true
	  }
	| {
			status: "disclosures_and_price_changed"
			componentKey: string
			identity: SeatAcceptanceIdentity
			selection: SeatReviewSelectionOutcome & { status: "disclosures_and_price_changed" }
			previousPrice: Money
			currentPrice: Money
			previousDisclosures: string[]
			currentDisclosures: string[]
			priceAcceptanceRequired: true
			disclosureAcknowledgementRequired: true
	  }
	| {
			status: "unavailable"
			componentKey: string
			identity: SeatAcceptanceIdentity
			selection: SeatReviewSelectionOutcome & { status: "unavailable" }
			priceAcceptanceRequired: false
			disclosureAcknowledgementRequired: false
	  }

export interface SeatAcceptanceContext {
	reviewSessionId: string
	bookingSessionId: string
	selectedOfferId: string
	currentOfferId: string
}

function validateIdentity(identity: SeatAcceptanceIdentity): SeatAcceptanceIdentity {
	const values = [
		identity.reviewSessionId,
		identity.bookingSessionId,
		identity.selectedOfferId,
		identity.currentOfferId,
		identity.serviceId,
		identity.passengerId,
		identity.segmentId,
		identity.seatDesignator,
	]
	if (values.some((value) => typeof value !== "string" || !value.trim())) {
		throw new Error("Seat acceptance requires a complete session, offer and seat identity.")
	}
	return { ...identity }
}

export function createSeatAcceptanceComponentKey(identity: SeatAcceptanceIdentity): string {
	const valid = validateIdentity(identity)
	return JSON.stringify([
		valid.reviewSessionId,
		valid.bookingSessionId,
		valid.selectedOfferId,
		valid.currentOfferId,
		valid.serviceId,
		valid.passengerId,
		valid.segmentId,
		valid.seatDesignator,
	])
}

function validateDisclosures(disclosures: string[]): string[] {
	if (!Array.isArray(disclosures) || disclosures.some((item) => typeof item !== "string")) {
		throw new Error("Seat disclosures must be a list of text values.")
	}
	return [...disclosures]
}

function snapshotMoney(money: Money): Money {
	addMoney(money, { amount: "0", currency: money.currency })
	return { ...money }
}

function validateCurrentSeatIdentity(
	selection: SeatReviewSelectionOutcome["selection"],
	current: {
		serviceId: string
		passengerId: string
		segmentId: string
		seatDesignator: string
		disclosures: string[]
	},
): void {
	if (
		current.serviceId !== selection.id ||
		current.passengerId !== selection.passengerId ||
		current.segmentId !== selection.segmentId ||
		current.seatDesignator !== selection.seatDesignator
	) {
		throw new Error("Current seat details do not match the selected seat identity.")
	}
	validateDisclosures(current.disclosures)
}

function sameIdentity(left: SeatAcceptanceIdentity, right: SeatAcceptanceIdentity): boolean {
	return (
		left.reviewSessionId === right.reviewSessionId &&
		left.bookingSessionId === right.bookingSessionId &&
		left.selectedOfferId === right.selectedOfferId &&
		left.currentOfferId === right.currentOfferId &&
		left.serviceId === right.serviceId &&
		left.passengerId === right.passengerId &&
		left.segmentId === right.segmentId &&
		left.seatDesignator === right.seatDesignator
	)
}

function canonicalDisclosures(disclosures: string[]): string[] {
	return [...disclosures].sort()
}

function sameDisclosureSet(left: string[], right: string[]): boolean {
	return JSON.stringify(canonicalDisclosures(left)) === JSON.stringify(canonicalDisclosures(right))
}

function timestampOrThrow(timestamp: string): string {
	if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) {
		throw new Error("A valid acceptance timestamp is required.")
	}
	return timestamp
}

/**
 * Creates one independently actionable requirement for every validated seat.
 * Price acceptance and disclosure acknowledgement are deliberately separate.
 */
export function createSeatAcceptanceRequirements(
	context: SeatAcceptanceContext,
	outcome: SeatReviewOutcome,
): SeatAcceptanceRequirement[] {
	const contextValues = [
		context.reviewSessionId,
		context.bookingSessionId,
		context.selectedOfferId,
		context.currentOfferId,
	]
	if (contextValues.some((value) => typeof value !== "string" || !value.trim())) {
		throw new Error("Seat acceptance requires a complete review and offer context.")
	}
	if (outcome.status === "not_selected") return []

	return outcome.selections.map((selectionOutcome) => {
		const selection = selectionOutcome.selection
		if (selection.offerId !== context.selectedOfferId) {
			throw new Error("Seat selection does not belong to the selected offer.")
		}
		const identity = validateIdentity({
			...context,
			serviceId: selection.id,
			passengerId: selection.passengerId,
			segmentId: selection.segmentId,
			seatDesignator: selection.seatDesignator,
		})
		const componentKey = createSeatAcceptanceComponentKey(identity)
		if (selectionOutcome.status !== "unavailable") {
			validateCurrentSeatIdentity(selection, selectionOutcome.current)
		}

		switch (selectionOutcome.status) {
			case "valid":
				return {
					status: "valid",
					componentKey,
					identity,
					selection: selectionOutcome,
					priceAcceptanceRequired: false,
					disclosureAcknowledgementRequired: false,
				}
			case "price_changed":
				return {
					status: "price_changed",
					componentKey,
					identity,
					selection: selectionOutcome,
					previousPrice: snapshotMoney({
						amount: selection.totalAmount,
						currency: selection.totalCurrency,
					}),
					currentPrice: snapshotMoney({
						amount: selectionOutcome.current.amount,
						currency: selectionOutcome.current.currency,
					}),
					priceAcceptanceRequired: true,
					disclosureAcknowledgementRequired: false,
				}
			case "disclosures_changed":
				return {
					status: "disclosures_changed",
					componentKey,
					identity,
					selection: selectionOutcome,
					previousDisclosures: validateDisclosures(selection.disclosures),
					currentDisclosures: validateDisclosures(selectionOutcome.current.disclosures),
					priceAcceptanceRequired: false,
					disclosureAcknowledgementRequired: true,
				}
			case "disclosures_and_price_changed":
				return {
					status: "disclosures_and_price_changed",
					componentKey,
					identity,
					selection: selectionOutcome,
					previousPrice: snapshotMoney({
						amount: selection.totalAmount,
						currency: selection.totalCurrency,
					}),
					currentPrice: snapshotMoney({
						amount: selectionOutcome.current.amount,
						currency: selectionOutcome.current.currency,
					}),
					previousDisclosures: validateDisclosures(selection.disclosures),
					currentDisclosures: validateDisclosures(selectionOutcome.current.disclosures),
					priceAcceptanceRequired: true,
					disclosureAcknowledgementRequired: true,
				}
			case "unavailable":
				return {
					status: "unavailable",
					componentKey,
					identity,
					selection: selectionOutcome,
					priceAcceptanceRequired: false,
					disclosureAcknowledgementRequired: false,
				}
		}
	})
}

export function acceptSeatPriceChange(
	requirement: SeatAcceptanceRequirement,
	acceptedAt = new Date().toISOString(),
): SeatPriceAcceptance {
	if (!requirement.priceAcceptanceRequired || !("previousPrice" in requirement)) {
		throw new Error("This seat component has no price change requiring acceptance.")
	}
	return {
		identity: { ...requirement.identity },
		previousPrice: { ...requirement.previousPrice },
		currentPrice: { ...requirement.currentPrice },
		acceptedAt: timestampOrThrow(acceptedAt),
	}
}

export function acknowledgeSeatDisclosures(
	requirement: SeatAcceptanceRequirement,
	acknowledgedAt = new Date().toISOString(),
): SeatDisclosureAcknowledgement {
	if (
		!requirement.disclosureAcknowledgementRequired ||
		!("previousDisclosures" in requirement)
	) {
		throw new Error("This seat component has no changed disclosures requiring acknowledgement.")
	}
	return {
		identity: { ...requirement.identity },
		previousDisclosures: [...requirement.previousDisclosures],
		currentDisclosures: [...requirement.currentDisclosures],
		acknowledgedAt: timestampOrThrow(acknowledgedAt),
	}
}

export function isSeatPriceAcceptanceCurrent(
	requirement: SeatAcceptanceRequirement,
	acceptance: SeatPriceAcceptance | null,
): boolean {
	return Boolean(
		requirement.priceAcceptanceRequired &&
		"previousPrice" in requirement &&
		acceptance &&
		sameIdentity(requirement.identity, acceptance.identity) &&
		requirement.previousPrice.amount === acceptance.previousPrice.amount &&
		requirement.previousPrice.currency === acceptance.previousPrice.currency &&
		requirement.currentPrice.amount === acceptance.currentPrice.amount &&
		requirement.currentPrice.currency === acceptance.currentPrice.currency,
	)
}

export function isSeatDisclosureAcknowledgementCurrent(
	requirement: SeatAcceptanceRequirement,
	acknowledgement: SeatDisclosureAcknowledgement | null,
): boolean {
	return Boolean(
		requirement.disclosureAcknowledgementRequired &&
		"previousDisclosures" in requirement &&
		acknowledgement &&
		sameIdentity(requirement.identity, acknowledgement.identity) &&
		sameDisclosureSet(requirement.previousDisclosures, acknowledgement.previousDisclosures) &&
		sameDisclosureSet(requirement.currentDisclosures, acknowledgement.currentDisclosures),
	)
}

export function areSeatAcceptanceRequirementsSatisfied(
	requirements: SeatAcceptanceRequirement[],
	priceAcceptances: SeatPriceAcceptance[],
	disclosureAcknowledgements: SeatDisclosureAcknowledgement[],
): boolean {
	return requirements.every((requirement) => {
		if (requirement.status === "unavailable") return false
		const priceAccepted =
			!requirement.priceAcceptanceRequired ||
			isSeatPriceAcceptanceCurrent(
				requirement,
				priceAcceptances.find((item) => sameIdentity(item.identity, requirement.identity)) ?? null,
			)
		const disclosuresAcknowledged =
			!requirement.disclosureAcknowledgementRequired ||
			isSeatDisclosureAcknowledgementCurrent(
				requirement,
				disclosureAcknowledgements.find((item) =>
					sameIdentity(item.identity, requirement.identity),
				) ?? null,
			)
		return priceAccepted && disclosuresAcknowledged
	})
}
