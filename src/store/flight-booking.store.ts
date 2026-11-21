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
	getOrCreateCheckoutReviewSession as resolveCheckoutReviewSession,
	isCheckoutReviewSessionCurrent,
	transitionBookingSession,
} from "@/lib/booking/readiness/booking-session"
import {
	isOfferReviewAttemptCurrent,
	isOfferReviewLifecycleForSession,
	type OfferReviewAttempt,
	type OfferReviewLifecycle,
	type OfferReviewLifecycleIdentity,
	getOfferReviewOutcomeStatus,
} from "@/lib/booking/readiness/offer-review-lifecycle"
import type { OfferReviewOutcome } from "@/lib/booking/readiness/offer-review"
import type { FlightOffer,SelectedSeatService } from "@/lib/flights/types"
import { create } from "zustand"

interface FlightBookingState {
	selectedOutboundSeats: string[]
	selectedOutboundSeatServices: SelectedSeatService[]
	passengerCollection: PassengerCollection | null
	activeBookingSession: ActiveBookingSession | null
	checkoutReviewSession: CheckoutReviewSession | null
	offerReviewLifecycle: OfferReviewLifecycle | null

	setOutboundSeats: (seats: string[]) => void
	toggleOutboundSeat: (seat: string) => void
	clearOutboundSeats: () => void
	selectOutboundSeatService: (selection: SelectedSeatService) => void
	clearOutboundSeatServices: () => void

	beginBookingSession: (offer: Pick<FlightOffer, "id">) => string
	getOrCreateCheckoutReviewSession: (offerId: string) => CheckoutReviewSession | null
	startOfferReviewRefresh: () => OfferReviewAttempt | null
	completeOfferReviewRefresh: (attempt: OfferReviewAttempt, outcome: OfferReviewOutcome) => boolean
	failOfferReviewRefresh: (attempt: OfferReviewAttempt, message: string) => boolean
	clearOfferReviewLifecycle: () => void
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

export const useFlightBookingStore = create<FlightBookingState>((set, get) => ({
	selectedOutboundSeats: [],
	selectedOutboundSeatServices: [],
	passengerCollection: null,
	activeBookingSession: null,
	checkoutReviewSession: null,
	offerReviewLifecycle: null,

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
		set({ ...next, offerReviewLifecycle: null })
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

	startOfferReviewRefresh: () => {
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
		const current = state.offerReviewLifecycle
		if (isOfferReviewLifecycleForSession(current, identity)) {
			if (current.status === "refreshing" || current.status === "retry_exhausted" ||
				current.status === "itinerary_changed" || current.status === "unavailable") {
				return null
			}
		}

		const attemptNumber =
			isOfferReviewLifecycleForSession(current, identity) && current.status === "error"
				? current.attemptNumber + 1
				: 1
		if (attemptNumber > 3) {
			set({
				offerReviewLifecycle: {
					...identity,
					attemptId: current!.attemptId,
					attemptNumber: current!.attemptNumber,
					status: "retry_exhausted",
					outcome: null,
					errorMessage: "We couldn't verify this flight after three attempts. Your booking details are still saved.",
				},
			})
			return null
		}

		const attempt: OfferReviewAttempt = {
			...identity,
			attemptId: `offer-review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
			attemptNumber,
		}
		set({
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
		const current = get().offerReviewLifecycle
		if (!isOfferReviewAttemptCurrent(current, attempt)) return false
		set({
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
		const current = get().offerReviewLifecycle
		if (!isOfferReviewAttemptCurrent(current, attempt)) return false
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
	clearOfferReviewLifecycle: () => set({ offerReviewLifecycle: null }),
	abandonBookingSession: () =>
		set((state) => ({ ...clearBookingSessionState(state), offerReviewLifecycle: null })),
	completeBookingSession: () =>
		set((state) => ({ ...clearBookingSessionState(state), offerReviewLifecycle: null })),

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
