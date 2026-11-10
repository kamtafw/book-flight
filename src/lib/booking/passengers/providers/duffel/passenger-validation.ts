import type { FlightOffer } from "@/lib/flights/types"
import {
	validatePassengerRelationships,
	type Passenger,
	type PassengerCollection,
} from "../../passenger-domain"
import {
	extractDuffelPassengerRequirements,
	type DuffelPassengerRequirements,
} from "./passenger-requirements"

export type PassengerValidationStatus = "draft" | "locally_valid" | "provider_ready"
export type PassengerValidationStage = "local" | "provider"

export interface PassengerValidationIssue {
	code: string
	passengerId?: string
	field?: string
	severity: "error" | "warning"
	stage: PassengerValidationStage
	message: string
}

export interface PassengerValidationResult {
	status: PassengerValidationStatus
	issues: PassengerValidationIssue[]
}

export interface ValidateDuffelPassengersOptions {
	/** Injectable UTC date for deterministic expiry checks. Defaults to today. */
	today?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENDER_MAP: Readonly<Record<string, "m" | "f">> = {
	m: "m",
	male: "m",
	f: "f",
	female: "f",
}

function isCalendarDate(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
	const date = new Date(`${value}T00:00:00.000Z`)
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function calculateAge(dateOfBirth: string, onDate: string): number {
	const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number)
	const [year, month, day] = onDate.split("-").map(Number)
	return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0)
}

function normalizeGender(value: unknown): "m" | "f" | null {
	if (typeof value !== "string") return null
	return GENDER_MAP[value.trim().toLowerCase()] ?? null
}

function isValidPhone(value: string): boolean {
	const trimmed = value.trim()
	if (!trimmed || !/^[+\d\s().-]+$/.test(trimmed)) return false
	const digits = trimmed.replace(/\D/g, "")
	return digits.length >= 7 && digits.length <= 15
}

function addIssue(
	issues: PassengerValidationIssue[],
	code: string,
	stage: PassengerValidationStage,
	message: string,
	passengerId?: string,
	field?: string,
) {
	issues.push({
		code,
		stage,
		severity: "error",
		message,
		...(passengerId ? { passengerId } : {}),
		...(field ? { field } : {}),
	})
}

function providerPassengerType(requirements: DuffelPassengerRequirements, passenger: Passenger) {
	const reference = passenger.providerReferences.find(
		(item) => item.provider === "duffel" && item.offerId === requirements.offerId,
	)
	return requirements.passengers.find(
		(item) => item.providerPassengerId === reference?.providerPassengerId,
	)?.providerPassengerType
}

/**
 * Validates the in-memory passenger collection against the exact selected Duffel offer.
 * It is deliberately pure: no store access, network calls, logging, or input mutation.
 */
export function validateDuffelPassengers(
	offer: FlightOffer,
	collection: PassengerCollection,
	options: ValidateDuffelPassengersOptions = {},
): PassengerValidationResult {
	const requirements = extractDuffelPassengerRequirements(offer)
	const issues: PassengerValidationIssue[] = []
	const today = options.today ?? new Date().toISOString().slice(0, 10)
	const passengers = collection?.passengers

	if (!Array.isArray(passengers)) {
		addIssue(
			issues,
			"INVALID_PASSENGER_COLLECTION",
			"local",
			"Passenger information is unavailable.",
		)
		return { status: "draft", issues }
	}

	const internalIds = new Set<string>()
	for (const passenger of passengers) {
		if (!passenger.id || internalIds.has(passenger.id)) {
			addIssue(
				issues,
				"DUPLICATE_OR_INVALID_INTERNAL_ID",
				"local",
				"Each traveller must have a unique internal identity.",
			)
		}
		internalIds.add(passenger.id)
	}

	const offerIds = new Set(requirements.passengers.map((item) => item.providerPassengerId))
	const mappedIds = new Set<string>()
	for (const passenger of passengers) {
		if (!Array.isArray(passenger.providerReferences) || passenger.providerReferences.length !== 1) {
			addIssue(
				issues,
				"INVALID_PROVIDER_REFERENCE_COUNT",
				"local",
				"Each traveller must map to exactly one passenger identity on the selected offer.",
				passenger.id,
			)
			continue
		}
		const reference = passenger.providerReferences[0]
		if (reference.provider !== "duffel") {
			addIssue(
				issues,
				"WRONG_PROVIDER",
				"local",
				"A traveller is linked to an unsupported flight provider.",
				passenger.id,
			)
			continue
		}
		if (reference.offerId !== requirements.offerId) {
			addIssue(
				issues,
				"FOREIGN_OFFER_REFERENCE",
				"local",
				"A traveller is linked to a different flight offer.",
				passenger.id,
			)
			continue
		}
		if (!reference.providerPassengerId || !offerIds.has(reference.providerPassengerId)) {
			addIssue(
				issues,
				"MISMATCHED_PROVIDER_PASSENGER",
				"local",
				"A traveller does not match a passenger on the selected offer.",
				passenger.id,
			)
			continue
		}
		if (mappedIds.has(reference.providerPassengerId)) {
			addIssue(
				issues,
				"DUPLICATE_PROVIDER_PASSENGER_MAPPING",
				"local",
				"More than one traveller maps to the same offer passenger.",
				passenger.id,
			)
			continue
		}
		mappedIds.add(reference.providerPassengerId)
	}
	for (const providerId of offerIds) {
		if (!mappedIds.has(providerId)) {
			addIssue(
				issues,
				"MISSING_INTERNAL_PASSENGER",
				"local",
				"A passenger on the selected offer has no matching traveller details.",
			)
		}
	}
	if (mappedIds.size !== offerIds.size || passengers.length !== requirements.passengers.length) {
		addIssue(
			issues,
			"PASSENGER_SET_MISMATCH",
			"local",
			"Traveller details must match the selected offer's passenger list exactly.",
		)
	}

	for (const relationshipIssue of validatePassengerRelationships(
		passengers,
		collection.relationships ?? [],
	)) {
		addIssue(
			issues,
			relationshipIssue.code,
			"local",
			"Review the traveller relationship details; one or more relationships are missing or inconsistent.",
			relationshipIssue.passengerId,
		)
	}

	const passengerById = new Map(passengers.map((passenger) => [passenger.id, passenger]))
	const adultAssignedInfants = new Set<string>()
	const infantRelationships = (collection.relationships ?? []).filter(
		(item) => item.type === "responsible_adult",
	)

	for (const passenger of passengers) {
		const type = providerPassengerType(requirements, passenger)
		if (!type) {
			addIssue(
				issues,
				"PASSENGER_TYPE_UNKNOWN",
				"provider",
				"The selected offer does not identify this traveller's provider passenger type.",
				passenger.id,
				"passengerType",
			)
		}
		const isInfant = typeof type === "string" && type.startsWith("infant")
		const ownRelationships = infantRelationships.filter((item) => item.passengerId === passenger.id)
		if (isInfant && ownRelationships.length !== 1) {
			addIssue(
				issues,
				"INFANT_RESPONSIBLE_ADULT_REQUIRED",
				"provider",
				"Assign exactly one responsible adult to this infant.",
				passenger.id,
				"responsibleAdult",
			)
		}
		for (const relationship of ownRelationships) {
			const adult = passengerById.get(relationship.relatedPassengerId)
			const adultType = adult ? providerPassengerType(requirements, adult) : null
			if (!adult || adultType !== "adult") {
				addIssue(
					issues,
					"RESPONSIBLE_PASSENGER_NOT_ADULT",
					"provider",
					"The responsible traveller must be an adult on this offer.",
					passenger.id,
					"responsibleAdult",
				)
				continue
			}
			if (adultAssignedInfants.has(adult.id)) {
				addIssue(
					issues,
					"ADULT_ASSIGNED_MULTIPLE_INFANTS",
					"provider",
					"Each infant must have a different responsible adult.",
					passenger.id,
					"responsibleAdult",
				)
			}
			adultAssignedInfants.add(adult.id)
		}
	}
	for (const relationship of infantRelationships) {
		const passenger = passengerById.get(relationship.passengerId)
		const type = passenger ? providerPassengerType(requirements, passenger) : null
		if (type && !type.startsWith("infant")) {
			addIssue(
				issues,
				"RELATIONSHIP_OWNER_NOT_INFANT",
				"local",
				"Only an infant can have a responsible-adult relationship.",
				relationship.passengerId,
				"responsibleAdult",
			)
		}
	}

	for (const passenger of passengers) {
		const identity = passenger.identity ?? {}
		if (!identity.givenName?.trim()) {
			addIssue(
				issues,
				"GIVEN_NAME_REQUIRED",
				"local",
				"Enter this traveller's given name.",
				passenger.id,
				"givenName",
			)
		}
		if (!identity.familyName?.trim()) {
			addIssue(
				issues,
				"FAMILY_NAME_REQUIRED",
				"local",
				"Enter this traveller's family name.",
				passenger.id,
				"familyName",
			)
		}
		if (!isCalendarDate(identity.dateOfBirth)) {
			addIssue(
				issues,
				"INVALID_DATE_OF_BIRTH",
				"local",
				"Enter a real date of birth in YYYY-MM-DD format.",
				passenger.id,
				"dateOfBirth",
			)
		} else if (identity.dateOfBirth > today) {
			addIssue(
				issues,
				"DATE_OF_BIRTH_IN_FUTURE",
				"local",
				"Date of birth cannot be in the future.",
				passenger.id,
				"dateOfBirth",
			)
		} else {
			const type = providerPassengerType(requirements, passenger)
			const providerPassenger = requirements.passengers.find((item) =>
				passenger.providerReferences.some(
					(reference) => reference.providerPassengerId === item.providerPassengerId,
				),
			)
			if (providerPassenger?.age !== null && providerPassenger?.age !== undefined) {
				if (!requirements.lastFlightDate) {
					addIssue(
						issues,
						"AGE_CHECK_UNKNOWN",
						"provider",
						"The itinerary does not provide a reliable final-flight date for age verification.",
						passenger.id,
						"dateOfBirth",
					)
				} else if (
					calculateAge(identity.dateOfBirth, requirements.lastFlightDate) !== providerPassenger.age
				) {
					addIssue(
						issues,
						"PASSENGER_AGE_MISMATCH",
						"local",
						"Date of birth does not match the age returned for this passenger on the selected offer.",
						passenger.id,
						"dateOfBirth",
					)
				}
			} else if (type && type !== "adult") {
				// Adult search passengers are intentionally sent without ages. The offer's
				// adult classification is authoritative; missing adult age is not a blocker.
				// Age-dependent categories still require provider age for consistency checks.
				addIssue(
					issues,
					"AGE_CHECK_UNKNOWN",
					"provider",
					"The offer does not provide an age for this age-dependent passenger, so age consistency cannot be confirmed.",
					passenger.id,
					"dateOfBirth",
				)
			}
		}

		if (!normalizeGender(identity.gender)) {
			addIssue(
				issues,
				"UNSUPPORTED_GENDER",
				"local",
				"Select a gender value supported by the flight provider (male or female).",
				passenger.id,
				"gender",
			)
		}

		const contacts = passenger.contacts ?? []
		const emailContacts = contacts.filter((item) => item.type === "email")
		const phoneContacts = contacts.filter((item) => item.type === "phone")
		if (emailContacts.length !== 1) {
			addIssue(
				issues,
				"PASSENGER_EMAIL_REQUIRED",
				"provider",
				"Enter one valid email address belonging to this traveller.",
				passenger.id,
				"email",
			)
		} else {
			const email = emailContacts[0]
			if (
				email.belongsTo !== "passenger" ||
				!email.value.trim() ||
				!EMAIL_PATTERN.test(email.value.trim())
			) {
				addIssue(
					issues,
					"PASSENGER_OWN_EMAIL_REQUIRED",
					"provider",
					"A valid email address belonging to this traveller is required; another person's email cannot be used.",
					passenger.id,
					"email",
				)
			}
		}
		if (phoneContacts.length !== 1) {
			addIssue(
				issues,
				"PASSENGER_PHONE_REQUIRED",
				"provider",
				"Enter one valid phone number for this traveller.",
				passenger.id,
				"phone",
			)
		} else {
			const phone = phoneContacts[0]
			if (!isValidPhone(phone.value)) {
				addIssue(
					issues,
					"INVALID_PHONE",
					"provider",
					"Enter a valid phone number using 7 to 15 digits.",
					passenger.id,
					"phone",
				)
			} else if (phone.belongsTo === "other") {
				const owner = phone.relatedPersonPassengerId
					? passengerById.get(phone.relatedPersonPassengerId)
					: undefined
				const ownerType = owner ? providerPassengerType(requirements, owner) : null
				if (!owner || owner.id === passenger.id || ownerType !== "adult") {
					addIssue(
						issues,
						"INVALID_PHONE_OWNER",
						"provider",
						"Select a different adult traveller as the owner of this phone number.",
						passenger.id,
						"phone",
					)
				}
			} else if (phone.belongsTo !== "passenger") {
				addIssue(
					issues,
					"INVALID_PHONE_OWNERSHIP",
					"provider",
					"Identify who owns this phone number.",
					passenger.id,
					"phone",
				)
			}
		}

		const documents = passenger.travelDocuments ?? []
		if (documents.length > 1) {
			addIssue(
				issues,
				"MULTIPLE_DOCUMENTS_UNSUPPORTED",
				"provider",
				"This form currently supports one travel document per traveller.",
				passenger.id,
				"travelDocument",
			)
		}
		const document = documents[0]
		if (requirements.identityDocuments.status === "unknown") {
			addIssue(
				issues,
				"DOCUMENT_REQUIREMENT_UNKNOWN",
				"provider",
				"The selected offer's travel-document requirement is unknown; verify the offer before continuing.",
				passenger.id,
				"travelDocument",
			)
		} else if (
			requirements.identityDocuments.status === "required" &&
			!requirements.identityDocuments.supportedTypes
		) {
			addIssue(
				issues,
				"DOCUMENT_TYPES_UNKNOWN",
				"provider",
				"The offer requires a passport but does not provide its supported document types; this must be verified.",
				passenger.id,
				"travelDocument",
			)
		}
		if (requirements.identityDocuments.status === "required" && !document) {
			addIssue(
				issues,
				"PASSPORT_REQUIRED",
				"provider",
				"Add a passport for this traveller because the selected offer requires identity documents.",
				passenger.id,
				"travelDocument",
			)
		}
		if (document) {
			const documentType = document.type.trim().toLowerCase()
			if (
				!documentType ||
				!document.documentNumber?.trim() ||
				!document.issuingCountry?.trim() ||
				!document.expirationDate?.trim()
			) {
				addIssue(
					issues,
					"INCOMPLETE_TRAVEL_DOCUMENT",
					"provider",
					"Complete the document type, number, issuing country and expiry date.",
					passenger.id,
					"travelDocument",
				)
			} else {
				if (
					requirements.identityDocuments.supportedTypes &&
					!requirements.identityDocuments.supportedTypes.some(
						(item) => item.trim().toLowerCase() === documentType,
					)
				) {
					addIssue(
						issues,
						"UNSUPPORTED_DOCUMENT_TYPE",
						"provider",
						"The selected offer does not support this travel-document type.",
						passenger.id,
						"travelDocument",
					)
				} else if (!requirements.identityDocuments.supportedTypes) {
					addIssue(
						issues,
						"DOCUMENT_TYPE_SUPPORT_UNKNOWN",
						"provider",
						"The offer's supported travel-document types are unknown, so this document cannot yet be verified.",
						passenger.id,
						"travelDocument",
					)
				}
				if (requirements.identityDocuments.status === "required" && documentType !== "passport") {
					addIssue(
						issues,
						"PASSPORT_REQUIRED",
						"provider",
						"The selected offer requires a passport for this traveller.",
						passenger.id,
						"travelDocument",
					)
				}
				if (!/^[A-Z]{2}$/.test(document.issuingCountry.trim().toUpperCase())) {
					addIssue(
						issues,
						"INVALID_ISSUING_COUNTRY",
						"provider",
						"Use a two-letter ISO country code for the document's issuing country.",
						passenger.id,
						"travelDocument",
					)
				}
				if (!isCalendarDate(document.expirationDate)) {
					addIssue(
						issues,
						"INVALID_DOCUMENT_EXPIRY",
						"provider",
						"Enter a real document expiry date in YYYY-MM-DD format.",
						passenger.id,
						"travelDocument",
					)
				} else if (document.expirationDate < today) {
					addIssue(
						issues,
						"EXPIRED_DOCUMENT",
						"provider",
						"This travel document has expired.",
						passenger.id,
						"travelDocument",
					)
				}
			}
		}
	}

	const hasLocalErrors = issues.some(
		(issue) => issue.stage === "local" && issue.severity === "error",
	)
	if (hasLocalErrors) return { status: "draft", issues }
	if (issues.some((issue) => issue.severity === "error")) return { status: "locally_valid", issues }
	return { status: "provider_ready", issues }
}
