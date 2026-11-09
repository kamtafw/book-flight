import type { FlightOffer } from "@/lib/flights/types"

export type DuffelDocumentRequirementStatus = "required" | "not_required" | "unknown"

export interface DuffelPassengerRequirement {
	providerPassengerId: string
	providerPassengerType: string | null
	age: number | null
}

export interface DuffelPassengerRequirements {
	provider: "duffel"
	offerId: string
	passengers: DuffelPassengerRequirement[]
	lastFlightDate: string | null
	identityDocuments: {
		status: DuffelDocumentRequirementStatus
		supportedTypes: readonly string[] | null
	}
	acceptedGenderValues: readonly ["m", "f"]
}

export type DuffelPassengerRequirementsErrorCode =
	| "INVALID_OFFER_ID"
	| "MISSING_OFFER_PASSENGERS"
	| "INVALID_PROVIDER_PASSENGER_ID"
	| "DUPLICATE_PROVIDER_PASSENGER_ID"

export class DuffelPassengerRequirementsError extends Error {
	readonly code: DuffelPassengerRequirementsErrorCode

	constructor(message: string, code: DuffelPassengerRequirementsErrorCode) {
		super(message)
		this.name = "DuffelPassengerRequirementsError"
		this.code = code
	}
}

function isCalendarDate(value: string): boolean {
	if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false
	const parsed = new Date(`${value}T00:00:00.000Z`)
	return (
		Number.isFinite(parsed.getTime()) &&
		parsed.toISOString().slice(0, 10) === value
	)
}

function getLastFlightDate(offer: FlightOffer): string | null {
	const slices = offer.slices
	if (!Array.isArray(slices) || slices.length === 0) return null

	const lastSlice = slices[slices.length - 1]
	const segments = lastSlice?.segments
	if (!Array.isArray(segments) || segments.length === 0) return null

	const arrivalAt = segments[segments.length - 1]?.arrivalAt
	if (typeof arrivalAt !== "string") return null

	const date = arrivalAt.slice(0, 10)
	return isCalendarDate(date) ? date : null
}

/**
 * Extracts the known Duffel passenger requirements from the normalized offer.
 * Unknown document metadata remains unknown; it is never defaulted to false.
 * This function is pure and does not modify the offer or passenger collection.
 */
export function extractDuffelPassengerRequirements(
	offer: FlightOffer,
): DuffelPassengerRequirements {
	if (typeof offer.id !== "string" || !offer.id.trim()) {
		throw new DuffelPassengerRequirementsError(
			"A valid selected offer ID is required.",
			"INVALID_OFFER_ID",
		)
	}

	if (!Array.isArray(offer.passengers) || offer.passengers.length === 0) {
		throw new DuffelPassengerRequirementsError(
			"The selected offer does not contain passenger identities.",
			"MISSING_OFFER_PASSENGERS",
		)
	}

	const providerPassengerIds = new Set<string>()
	const passengers = offer.passengers.map((passenger) => {
		if (
			typeof passenger.id !== "string" ||
			!passenger.id.trim()
		) {
			throw new DuffelPassengerRequirementsError(
				"An offer passenger is missing a valid provider passenger ID.",
				"INVALID_PROVIDER_PASSENGER_ID",
			)
		}
		if (providerPassengerIds.has(passenger.id)) {
			throw new DuffelPassengerRequirementsError(
				"The offer contains duplicate provider passenger IDs.",
				"DUPLICATE_PROVIDER_PASSENGER_ID",
			)
		}
		providerPassengerIds.add(passenger.id)

		return {
			providerPassengerId: passenger.id,
			providerPassengerType:
				typeof passenger.type === "string" ? passenger.type : null,
			age:
				typeof passenger.age === "number" &&
				Number.isFinite(passenger.age) &&
				passenger.age >= 0
					? passenger.age
					: null,
		}
	})

	const documentRequired = offer.passengerIdentityDocumentsRequired
	const supportedTypes = offer.supportedPassengerIdentityDocumentTypes

	return {
		provider: "duffel",
		offerId: offer.id,
		passengers,
		lastFlightDate: getLastFlightDate(offer),
		identityDocuments: {
			status:
				documentRequired === true
					? "required"
					: documentRequired === false
						? "not_required"
						: "unknown",
			supportedTypes: Array.isArray(supportedTypes)
				? [...supportedTypes]
				: null,
		},
		acceptedGenderValues: ["m", "f"],
	}
}
