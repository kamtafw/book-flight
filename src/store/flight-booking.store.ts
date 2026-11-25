import type {
	Passenger,
	PassengerCollection,
	PassengerContactType,
	TravelDocument,
} from "@/lib/booking/passengers/passenger-domain"
import { createPassengerCollectionFromOffer } from "@/lib/booking/passengers/passenger-domain"
import {
	type ActiveBookingSession,
	type CheckoutReviewSession,
	clearBookingSessionState,
	isCheckoutReviewSessionCurrent,
	getOrCreateCheckoutReviewSession as resolveCheckoutReviewSession,
	transitionBookingSession,
} from "@/lib/booking/readiness/booking-session"
import {
	acceptFlightFareChange as createFlightFareAcceptance,
	createFlightFareReview,
	type FlightFareAcceptance,
	type FlightFareReview,
	isFlightFareAcceptanceCurrent,
} from "@/lib/booking/readiness/flight-fare-review"
import type { OfferReviewOutcome } from "@/lib/booking/readiness/offer-review"
import {
	getOfferReviewOutcomeStatus,
	isOfferReviewAttemptCurrent,
	isOfferReviewLifecycleForSession,
	type OfferReviewAttempt,
	type OfferReviewLifecycle,
	type OfferReviewLifecycleIdentity,
	shouldStartOfferReviewRefresh,
} from "@/lib/booking/readiness/offer-review-lifecycle"
import {
	acceptSeatPriceChange,
	acknowledgeSeatDisclosures,
	areSeatAcceptanceRequirementsSatisfied,
	createSeatAcceptanceComponentKey,
	createSeatAcceptanceRequirements,
	type SeatAcceptanceRequirement,
	type SeatDisclosureAcknowledgement,
	type SeatPriceAcceptance,
} from "@/lib/booking/readiness/seat-acceptance"
import type { SeatReviewOutcome } from "@/lib/booking/readiness/seat-review"
import {
	completeSeatReviewValidation,
	createSeatReviewSnapshotKey,
	failSeatReviewValidation,
	type SeatReviewAttempt,
	type SeatReviewLifecycle,
	type SeatReviewLifecycleIdentity,
	startSeatReviewValidation,
} from "@/lib/booking/readiness/seat-review-lifecycle"
import type { FlightOffer, SelectedSeatService } from "@/lib/flights/types"
import { create } from "zustand"

interface FlightBookingState {
	selectedOutboundSeats: string[]
	selectedOutboundSeatServices: SelectedSeatService[]
	passengerCollection: PassengerCollection | null
	activeBookingSession: ActiveBookingSession | null
	checkoutReviewSession: CheckoutReviewSession | null
	offerReviewLifecycle: OfferReviewLifecycle | null
	seatReviewLifecycle: SeatReviewLifecycle | null
	flightFareAcceptance: FlightFareAcceptance | null
	seatPriceAcceptances: SeatPriceAcceptance[]
	seatDisclosureAcknowledgements: SeatDisclosureAcknowledgement[]

	setOutboundSeats: (seats: string[]) => void
	toggleOutboundSeat: (seat: string) => void
	clearOutboundSeats: () => void
	selectOutboundSeatService: (selection: SelectedSeatService) => void
	clearOutboundSeatServices: () => void

	beginBookingSession: (offer: Pick<FlightOffer, "id">) => string
	getOrCreateCheckoutReviewSession: (offerId: string) => CheckoutReviewSession | null
	startOfferReviewRefresh: (
		expectedIdentity?: OfferReviewLifecycleIdentity,
		force?: boolean,
	) => OfferReviewAttempt | null
	completeOfferReviewRefresh: (attempt: OfferReviewAttempt, outcome: OfferReviewOutcome) => boolean
	failOfferReviewRefresh: (attempt: OfferReviewAttempt, message: string) => boolean
	clearOfferReviewLifecycle: () => void
	getCurrentFlightFareReview: () => FlightFareReview | null
	acceptCurrentFlightFareChange: (acceptedAt?: string) => boolean
	isCurrentFlightFareAccepted: () => boolean
	getCurrentSeatAcceptanceRequirements: () => SeatAcceptanceRequirement[] | null
	acceptCurrentSeatPriceChange: (componentKey: string, acceptedAt?: string) => boolean
	acknowledgeCurrentSeatDisclosures: (componentKey: string, acknowledgedAt?: string) => boolean
	areCurrentSeatRequirementsSatisfied: () => boolean
	startSeatReviewValidation: (
		offerExpiresAt: string | null,
		retry?: boolean,
		expectedContext?: SeatReviewRequestContext,
	) => { kind: "not_selected" | "reuse" | "blocked" | "started"; attempt?: SeatReviewAttempt }
	completeSeatReviewValidation: (attempt: SeatReviewAttempt, outcome: SeatReviewOutcome) => boolean
	failSeatReviewValidation: (attempt: SeatReviewAttempt, message: string) => boolean
	abandonBookingSession: () => void
	completeBookingSession: () => void
	initializePassengerCollection: (offer: FlightOffer) => void
	updatePassengerIdentity: (passengerId: string, identity: Partial<Passenger["identity"]>) => void
	setPassengerContact: (
		passengerId: string,
		type: PassengerContactType,
		value: string,
		belongsTo: "passenger" | "other",
		relatedPersonPassengerId?: string,
	) => void
	setPassengerTravelDocument: (passengerId: string, document: Omit<TravelDocument, "id">) => void
	setResponsibleAdult: (infantPassengerId: string, adultPassengerId: string | null) => void
	clearPassengerInformation: () => void
}

interface SeatReviewRequestContext extends SeatReviewLifecycleIdentity {
	snapshotKey: string
	offerReviewAttemptId: string
}

function createInternalPassengerId() {
	return `passenger-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createCheckoutReviewSessionId() {
	return `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getPassengerCategory(type: string | null): Passenger["category"] {
	if (type === "adult") return "adult"
	if (type === "child") return "child"
	if (type?.startsWith("infant")) return "infant"
	return "unknown"
}

function collectionMatchesOffer(collection: PassengerCollection | null, offer: FlightOffer) {
	if (!collection || !Array.isArray(offer.passengers)) return false
	if (collection.passengers.length !== offer.passengers.length) return false

	const mappedIds = new Set(
		collection.passengers.flatMap((passenger) =>
			passenger.providerReferences
				.filter((reference) => reference.provider === "duffel" && reference.offerId === offer.id)
				.map((reference) => reference.providerPassengerId),
		),
	)
	return (
		mappedIds.size === offer.passengers.length &&
		offer.passengers.every((passenger) => mappedIds.has(passenger.id))
	)
}

function resolveCurrentFlightFareReview(
	state: Pick<
		FlightBookingState,
		"checkoutReviewSession" | "activeBookingSession" | "offerReviewLifecycle"
	>,
): FlightFareReview | null {
	const reviewSession = state.checkoutReviewSession
	const bookingSession = state.activeBookingSession
	const lifecycle = state.offerReviewLifecycle
	const outcome = lifecycle?.outcome
	if (
		!reviewSession ||
		!bookingSession ||
		!lifecycle ||
		!outcome ||
		reviewSession.bookingSessionId !== bookingSession.id ||
		reviewSession.offerId !== bookingSession.offerId ||
		lifecycle.reviewSessionId !== reviewSession.id ||
		lifecycle.bookingSessionId !== bookingSession.id ||
		lifecycle.offerId !== reviewSession.offerId ||
		(outcome.status !== "valid" && outcome.status !== "price_changed")
	) {
		return null
	}

	const previousPrice =
		outcome.status === "price_changed"
			? outcome.previousPrice
			: outcome.originalOffer.priceAmount
				? { amount: outcome.originalOffer.priceAmount, currency: outcome.originalOffer.currency }
				: null
	const currentPrice =
		outcome.status === "price_changed"
			? outcome.currentPrice
			: outcome.currentOffer.priceAmount
				? { amount: outcome.currentOffer.priceAmount, currency: outcome.currentOffer.currency }
				: null
	if (!previousPrice || !currentPrice) return null

	try {
		return createFlightFareReview({
			identity: {
				reviewSessionId: reviewSession.id,
				bookingSessionId: bookingSession.id,
				selectedOfferId: reviewSession.offerId,
			},
			currentOfferId: outcome.currentOffer.id,
			previousPrice,
			currentPrice,
		})
	} catch {
		return null
	}
}

function resolveCurrentSeatAcceptanceRequirements(
	state: Pick<
		FlightBookingState,
		| "checkoutReviewSession"
		| "activeBookingSession"
		| "offerReviewLifecycle"
		| "seatReviewLifecycle"
		| "selectedOutboundSeatServices"
	>,
): SeatAcceptanceRequirement[] | null {
	const reviewSession = state.checkoutReviewSession
	const bookingSession = state.activeBookingSession
	const offerLifecycle = state.offerReviewLifecycle
	const seatLifecycle = state.seatReviewLifecycle
	const offerOutcome = offerLifecycle?.outcome
	const seatOutcome = seatLifecycle?.outcome

	if (
		!reviewSession ||
		!bookingSession ||
		!offerLifecycle ||
		!seatLifecycle ||
		!offerOutcome ||
		!seatOutcome ||
		!seatLifecycle.offerExpiresAt ||
		!Number.isFinite(Date.parse(seatLifecycle.offerExpiresAt)) ||
		Date.parse(seatLifecycle.offerExpiresAt) <= Date.now() ||
		reviewSession.bookingSessionId !== bookingSession.id ||
		reviewSession.offerId !== bookingSession.offerId ||
		offerLifecycle.reviewSessionId !== reviewSession.id ||
		offerLifecycle.bookingSessionId !== bookingSession.id ||
		offerLifecycle.offerId !== reviewSession.offerId ||
		(offerOutcome.status !== "valid" && offerOutcome.status !== "price_changed") ||
		seatLifecycle.reviewSessionId !== reviewSession.id ||
		seatLifecycle.bookingSessionId !== bookingSession.id ||
		seatLifecycle.offerId !== reviewSession.offerId ||
		(seatLifecycle.status !== "not_selected" &&
			seatLifecycle.status !== "valid" &&
			seatLifecycle.status !== "action_required") ||
		seatLifecycle.snapshotKey !== createSeatReviewSnapshotKey(state.selectedOutboundSeatServices)
	) {
		return null
	}

	try {
		return createSeatAcceptanceRequirements(
			{
				reviewSessionId: reviewSession.id,
				bookingSessionId: bookingSession.id,
				selectedOfferId: reviewSession.offerId,
				currentOfferId: offerOutcome.currentOffer.id,
			},
			seatOutcome,
		)
	} catch {
		return null
	}
}

export const useFlightBookingStore = create<FlightBookingState>((set, get) => ({
	selectedOutboundSeats: [],
	selectedOutboundSeatServices: [],
	passengerCollection: null,
	activeBookingSession: null,
	checkoutReviewSession: null,
	offerReviewLifecycle: null,
	seatReviewLifecycle: null,
	flightFareAcceptance: null,
	seatPriceAcceptances: [],
	seatDisclosureAcknowledgements: [],

	setOutboundSeats: (seats) => {
		set({ selectedOutboundSeats: seats })
	},

	toggleOutboundSeat: (seat) => {
		set((state) => ({
			selectedOutboundSeats: state.selectedOutboundSeats.includes(seat)
				? state.selectedOutboundSeats.filter((selected) => selected !== seat)
				: [...state.selectedOutboundSeats, seat],
		}))
	},

	clearOutboundSeats: () => {
		set({ selectedOutboundSeats: [], selectedOutboundSeatServices: [] })
	},

	selectOutboundSeatService: (selection) =>
		set((state) => {
			if (
				!selection.id ||
				!selection.offerId ||
				!selection.passengerId ||
				!selection.segmentId ||
				!selection.seatDesignator ||
				!/^[A-Z]{3}$/.test(selection.totalCurrency) ||
				!selection.totalAmount.trim() ||
				!Number.isFinite(Number(selection.totalAmount)) ||
				Number(selection.totalAmount) < 0
			) {
				return state
			}

			const existing = state.selectedOutboundSeatServices.find(
				(item) =>
					item.segmentId === selection.segmentId && item.passengerId === selection.passengerId,
			)
			if (existing?.id === selection.id) {
				const remaining = state.selectedOutboundSeatServices.filter(
					(item) =>
						item.segmentId !== selection.segmentId || item.passengerId !== selection.passengerId,
				)
				return {
					selectedOutboundSeatServices: remaining,
					selectedOutboundSeats: [...new Set(remaining.map((item) => item.seatDesignator))],
				}
			}
			const seatAlreadyAssigned = state.selectedOutboundSeatServices.some(
				(item) =>
					item.segmentId === selection.segmentId &&
					item.seatDesignator === selection.seatDesignator &&
					item.passengerId !== selection.passengerId,
			)
			if (seatAlreadyAssigned) return state

			const next = [
				...state.selectedOutboundSeatServices.filter(
					(item) =>
						item.segmentId !== selection.segmentId || item.passengerId !== selection.passengerId,
				),
				selection,
			]
			return {
				selectedOutboundSeatServices: next,
				selectedOutboundSeats: [...new Set(next.map((item) => item.seatDesignator))],
			}
		}),
	clearOutboundSeatServices: () =>
		set({ selectedOutboundSeatServices: [], selectedOutboundSeats: [] }),

	beginBookingSession: (offer) => {
		const current = get().activeBookingSession
		if (current?.offerId === offer.id) return current.id

		const next = transitionBookingSession(get(), offer.id, createInternalPassengerId)
		set({
			...next,
			offerReviewLifecycle: null,
			seatReviewLifecycle: null,
			flightFareAcceptance: null,
			seatPriceAcceptances: [],
			seatDisclosureAcknowledgements: [],
		})
		return next.activeBookingSession!.id
	},

	getOrCreateCheckoutReviewSession: (offerId) => {
		const state = get()
		const next = resolveCheckoutReviewSession(
			state.activeBookingSession,
			state.checkoutReviewSession,
			offerId,
			createCheckoutReviewSessionId,
		)
		if (next && next !== state.checkoutReviewSession) set({ checkoutReviewSession: next })
		return next
	},

	startOfferReviewRefresh: (expectedIdentity, force = false) => {
		const state = get()
		const reviewSession = state.checkoutReviewSession
		const bookingSession = state.activeBookingSession
		if (
			!reviewSession ||
			!bookingSession ||
			!isCheckoutReviewSessionCurrent(reviewSession, bookingSession, reviewSession.offerId)
		) {
			return null
		}

		const identity: OfferReviewLifecycleIdentity = {
			reviewSessionId: reviewSession.id,
			bookingSessionId: bookingSession.id,
			offerId: reviewSession.offerId,
		}
		if (
			expectedIdentity &&
			(expectedIdentity.reviewSessionId !== identity.reviewSessionId ||
				expectedIdentity.bookingSessionId !== identity.bookingSessionId ||
				expectedIdentity.offerId !== identity.offerId)
		) {
			return null
		}
		const current = state.offerReviewLifecycle
		if (isOfferReviewLifecycleForSession(current, identity)) {
			if (
				current.status === "refreshing" ||
				current.status === "retry_exhausted" ||
				current.status === "itinerary_changed" ||
				current.status === "unavailable"
			) {
				return null
			}
			if (
				!force &&
				(current.status === "ready" || current.status === "price_changed") &&
				!shouldStartOfferReviewRefresh(current, identity)
			) {
				return null
			}
		}

		const attemptNumber =
			isOfferReviewLifecycleForSession(current, identity) && current.status === "error"
				? current.attemptNumber + 1
				: 1
		if (attemptNumber > 3) return null

		const attempt: OfferReviewAttempt = {
			...identity,
			attemptId: `offer-review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
			attemptNumber,
		}
		set({
			flightFareAcceptance: null,
			seatReviewLifecycle: null,
			seatPriceAcceptances: [],
			seatDisclosureAcknowledgements: [],
			offerReviewLifecycle: {
				...attempt,
				status: "refreshing",
				outcome: null,
				errorMessage: null,
			},
		})
		return attempt
	},
	completeOfferReviewRefresh: (attempt, outcome) => {
		const state = get()
		if (
			state.checkoutReviewSession?.id !== attempt.reviewSessionId ||
			state.activeBookingSession?.id !== attempt.bookingSessionId ||
			!isCheckoutReviewSessionCurrent(
				state.checkoutReviewSession,
				state.activeBookingSession,
				attempt.offerId,
			) ||
			!isOfferReviewAttemptCurrent(state.offerReviewLifecycle, attempt)
		) {
			return false
		}
		set({
			flightFareAcceptance: null,
			seatReviewLifecycle: null,
			seatPriceAcceptances: [],
			seatDisclosureAcknowledgements: [],
			offerReviewLifecycle: {
				...attempt,
				status: getOfferReviewOutcomeStatus(outcome),
				outcome,
				errorMessage: null,
			},
		})
		return true
	},
	failOfferReviewRefresh: (attempt, message) => {
		const state = get()
		if (
			state.checkoutReviewSession?.id !== attempt.reviewSessionId ||
			state.activeBookingSession?.id !== attempt.bookingSessionId ||
			!isCheckoutReviewSessionCurrent(
				state.checkoutReviewSession,
				state.activeBookingSession,
				attempt.offerId,
			) ||
			!isOfferReviewAttemptCurrent(state.offerReviewLifecycle, attempt)
		) {
			return false
		}
		set({
			offerReviewLifecycle: {
				...attempt,
				status: attempt.attemptNumber >= 3 ? "retry_exhausted" : "error",
				outcome: null,
				errorMessage: message,
			},
		})
		return true
	},
	clearOfferReviewLifecycle: () =>
		set({
			offerReviewLifecycle: null,
			seatReviewLifecycle: null,
			flightFareAcceptance: null,
			seatPriceAcceptances: [],
			seatDisclosureAcknowledgements: [],
		}),
	getCurrentFlightFareReview: () => resolveCurrentFlightFareReview(get()),
	acceptCurrentFlightFareChange: (acceptedAt) => {
		const review = resolveCurrentFlightFareReview(get())
		if (!review || review.status !== "acceptance_required") return false
		try {
			const acceptance = createFlightFareAcceptance(review, acceptedAt)
			set({ flightFareAcceptance: acceptance })
			return true
		} catch {
			return false
		}
	},
	isCurrentFlightFareAccepted: () => {
		const state = get()
		const review = resolveCurrentFlightFareReview(state)
		if (!review) return false
		if (review.status === "unchanged") return true
		return isFlightFareAcceptanceCurrent(review, state.flightFareAcceptance)
	},
	getCurrentSeatAcceptanceRequirements: () => resolveCurrentSeatAcceptanceRequirements(get()),
	acceptCurrentSeatPriceChange: (componentKey, acceptedAt) => {
		const requirements = resolveCurrentSeatAcceptanceRequirements(get())
		const requirement = requirements?.find((item) => item.componentKey === componentKey)
		if (!requirement?.priceAcceptanceRequired) return false
		try {
			const acceptance = acceptSeatPriceChange(requirement, acceptedAt)
			set((state) => ({
				seatPriceAcceptances: [
					...state.seatPriceAcceptances.filter(
						(item) => createSeatAcceptanceComponentKey(item.identity) !== componentKey,
					),
					acceptance,
				],
			}))
			return true
		} catch {
			return false
		}
	},
	acknowledgeCurrentSeatDisclosures: (componentKey, acknowledgedAt) => {
		const requirements = resolveCurrentSeatAcceptanceRequirements(get())
		const requirement = requirements?.find((item) => item.componentKey === componentKey)
		if (!requirement?.disclosureAcknowledgementRequired) return false
		try {
			const acknowledgement = acknowledgeSeatDisclosures(requirement, acknowledgedAt)
			set((state) => ({
				seatDisclosureAcknowledgements: [
					...state.seatDisclosureAcknowledgements.filter(
						(item) => createSeatAcceptanceComponentKey(item.identity) !== componentKey,
					),
					acknowledgement,
				],
			}))
			return true
		} catch {
			return false
		}
	},
	areCurrentSeatRequirementsSatisfied: () => {
		const state = get()
		const requirements = resolveCurrentSeatAcceptanceRequirements(state)
		if (!requirements) return false
		return areSeatAcceptanceRequirementsSatisfied(
			requirements,
			state.seatPriceAcceptances,
			state.seatDisclosureAcknowledgements,
		)
	},
	startSeatReviewValidation: (offerExpiresAt, retry = false, expectedContext) => {
		const state = get()
		const reviewSession = state.checkoutReviewSession
		const bookingSession = state.activeBookingSession
		if (!reviewSession || !bookingSession || reviewSession.offerId !== bookingSession.offerId) {
			return { kind: "blocked" }
		}
		const identity: SeatReviewLifecycleIdentity = {
			reviewSessionId: reviewSession.id,
			bookingSessionId: bookingSession.id,
			offerId: reviewSession.offerId,
		}
		if (expectedContext) {
			const offerLifecycle = state.offerReviewLifecycle
			const offerOutcome = offerLifecycle?.outcome
			const currentSnapshotKey = createSeatReviewSnapshotKey(state.selectedOutboundSeatServices)
			if (
				expectedContext.reviewSessionId !== identity.reviewSessionId ||
				expectedContext.bookingSessionId !== identity.bookingSessionId ||
				expectedContext.offerId !== identity.offerId ||
				expectedContext.snapshotKey !== currentSnapshotKey ||
				!isOfferReviewLifecycleForSession(offerLifecycle, identity) ||
				offerLifecycle.attemptId !== expectedContext.offerReviewAttemptId ||
				(offerLifecycle.status !== "ready" && offerLifecycle.status !== "price_changed") ||
				!offerOutcome ||
				(offerOutcome.status !== "valid" && offerOutcome.status !== "price_changed")
			) {
				return { kind: "blocked" }
			}
		}
		const result = startSeatReviewValidation(
			state.seatReviewLifecycle,
			identity,
			state.selectedOutboundSeatServices,
			offerExpiresAt,
			Date.now(),
			retry,
		)
		set({ seatReviewLifecycle: result.lifecycle })
		return result.kind === "started"
			? { kind: "started", attempt: result.attempt }
			: { kind: result.kind }
	},
	completeSeatReviewValidation: (attempt, outcome) => {
		const state = get()
		if (
			state.checkoutReviewSession?.id !== attempt.reviewSessionId ||
			state.activeBookingSession?.id !== attempt.bookingSessionId ||
			state.checkoutReviewSession.offerId !== attempt.offerId ||
			state.activeBookingSession.offerId !== attempt.offerId
		)
			return false
		const next = completeSeatReviewValidation(
			state.seatReviewLifecycle,
			attempt,
			createSeatReviewSnapshotKey(state.selectedOutboundSeatServices),
			outcome,
		)
		if (!next) return false
		set({ seatReviewLifecycle: next })
		return true
	},
	failSeatReviewValidation: (attempt, message) => {
		const state = get()
		if (
			state.checkoutReviewSession?.id !== attempt.reviewSessionId ||
			state.activeBookingSession?.id !== attempt.bookingSessionId ||
			state.checkoutReviewSession.offerId !== attempt.offerId ||
			state.activeBookingSession.offerId !== attempt.offerId
		)
			return false
		const next = failSeatReviewValidation(
			state.seatReviewLifecycle,
			attempt,
			createSeatReviewSnapshotKey(state.selectedOutboundSeatServices),
			message,
		)
		if (!next) return false
		set({ seatReviewLifecycle: next })
		return true
	},
	abandonBookingSession: () =>
		set((state) => ({
			...clearBookingSessionState(state),
			offerReviewLifecycle: null,
			seatReviewLifecycle: null,
			flightFareAcceptance: null,
			seatPriceAcceptances: [],
			seatDisclosureAcknowledgements: [],
		})),
	completeBookingSession: () =>
		set((state) => ({
			...clearBookingSessionState(state),
			offerReviewLifecycle: null,
			seatReviewLifecycle: null,
			flightFareAcceptance: null,
			seatPriceAcceptances: [],
			seatDisclosureAcknowledgements: [],
		})),

	initializePassengerCollection: (offer) =>
		set((state) => {
			if (state.activeBookingSession?.offerId !== offer.id) return state

			if (collectionMatchesOffer(state.passengerCollection, offer)) return state

			const passengerCollection = createPassengerCollectionFromOffer(offer, {
				provider: "duffel",
				createInternalId: createInternalPassengerId,
				getCategory: (passenger) => getPassengerCategory(passenger.type),
			})
			return { passengerCollection }
		}),

	updatePassengerIdentity: (passengerId, identity) =>
		set((state) => {
			if (!state.passengerCollection) return state
			const passenger = state.passengerCollection.passengers.find((item) => item.id === passengerId)
			if (!passenger) return state

			return {
				passengerCollection: {
					...state.passengerCollection,
					passengers: state.passengerCollection.passengers.map((item) =>
						item.id === passengerId
							? { ...item, identity: { ...item.identity, ...identity } }
							: item,
					),
				},
			}
		}),

	setPassengerContact: (passengerId, type, value, belongsTo, relatedPersonPassengerId) =>
		set((state) => {
			if (!state.passengerCollection) return state
			const passenger = state.passengerCollection.passengers.find((item) => item.id === passengerId)
			if (!passenger) return state

			if (
				belongsTo === "other" &&
				relatedPersonPassengerId &&
				(passengerId === relatedPersonPassengerId ||
					!state.passengerCollection.passengers.some(
						(item) => item.id === relatedPersonPassengerId,
					))
			) {
				return state
			}

			const contacts = passenger.contacts.filter((contact) => contact.type !== type)
			contacts.push({
				id:
					passenger.contacts.find((contact) => contact.type === type)?.id ??
					createInternalPassengerId(),
				type,
				value: value.trim(),
				belongsTo,
				...(belongsTo === "other" && relatedPersonPassengerId ? { relatedPersonPassengerId } : {}),
			})

			return {
				passengerCollection: {
					...state.passengerCollection,
					passengers: state.passengerCollection.passengers.map((item) =>
						item.id === passengerId ? { ...item, contacts } : item,
					),
				},
			}
		}),

	setPassengerTravelDocument: (passengerId, document) =>
		set((state) => {
			if (!state.passengerCollection) return state
			const passenger = state.passengerCollection.passengers.find((item) => item.id === passengerId)
			if (!passenger) return state

			const existingDocument = passenger.travelDocuments[0]
			const hasValue = Boolean(
				document.type.trim() ||
				document.documentNumber?.trim() ||
				document.issuingCountry?.trim() ||
				document.expirationDate?.trim(),
			)
			const travelDocuments = hasValue
				? [
						{
							id: existingDocument?.id ?? createInternalPassengerId(),
							...document,
						},
						...passenger.travelDocuments.slice(1),
					]
				: []

			return {
				passengerCollection: {
					...state.passengerCollection,
					passengers: state.passengerCollection.passengers.map((item) =>
						item.id === passengerId ? { ...item, travelDocuments } : item,
					),
				},
			}
		}),

	setResponsibleAdult: (infantPassengerId, adultPassengerId) =>
		set((state) => {
			if (!state.passengerCollection) return state
			const passengers = state.passengerCollection.passengers
			if (!passengers.some((item) => item.id === infantPassengerId)) return state
			const infant = passengers.find((item) => item.id === infantPassengerId)
			if (adultPassengerId) {
				const adult = passengers.find((item) => item.id === adultPassengerId)
				if (
					infant?.category !== "infant" ||
					adult?.category !== "adult" ||
					adultPassengerId === infantPassengerId
				) {
					return state
				}
			}

			const relationships = state.passengerCollection.relationships.filter(
				(relationship) =>
					relationship.type !== "responsible_adult" ||
					relationship.passengerId !== infantPassengerId,
			)
			if (adultPassengerId) {
				relationships.push({
					passengerId: infantPassengerId,
					relatedPassengerId: adultPassengerId,
					type: "responsible_adult",
				})
			}

			return {
				passengerCollection: { ...state.passengerCollection, relationships },
			}
		}),

	clearPassengerInformation: () => set({ passengerCollection: null }),
}))
