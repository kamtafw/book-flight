import { Feather } from "@expo/vector-icons"
import { router, useFocusEffect, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useMemo } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { isCheckoutReviewSessionCurrent } from "@/lib/booking/readiness/booking-session"
import { getCheckoutReviewEntryState } from "@/lib/booking/readiness/checkout-review"
import { createOfferReviewOutcome } from "@/lib/booking/readiness/offer-review"
import {
	isOfferReviewLifecycleForSession,
	shouldStartOfferReviewRefresh,
	type OfferReviewLifecycleIdentity,
} from "@/lib/booking/readiness/offer-review-lifecycle"
import { buildCheckoutPricingPresentation } from "@/lib/booking/readiness/checkout-pricing-presentation"
import { createSeatReviewOutcome } from "@/lib/booking/readiness/seat-review"
import { buildSeatReviewPresentation, type SeatReviewPresentationGroup } from "@/lib/booking/readiness/seat-review-presentation"
import { createSeatReviewSnapshotKey, isSeatReviewLifecycleForSession } from "@/lib/booking/readiness/seat-review-lifecycle"
import { refreshOffer, validateSeatServices } from "@/lib/flights/api"
import type { PassengerCollection } from "@/lib/booking/passengers/passenger-domain"
import type { FlightOffer } from "@/lib/flights/types"
import { useFlightBookingStore } from "@/store/flight-booking.store"
import { useFlightOffersStore } from "@/store/flight-offers.store"

function formatProviderAmount(amount: string, currency: string) {
	return `${currency} ${amount}`
}

const seatStatusLabels = {
	valid: "Available",
	price_changed: "Price changed",
	unavailable: "Unavailable",
	disclosures_changed: "Conditions changed",
	disclosures_and_price_changed: "Price and conditions changed",
} as const

function SeatReviewSection({
	groups,
	notSelected = false,
}: {
	groups: SeatReviewPresentationGroup[]
	notSelected?: boolean
}) {
	return (
		<View className="mt-5 rounded-2xl border border-border bg-white p-4">
			<Text className="font-inter-semibold text-base text-black">Selected seats</Text>
			{notSelected ? (
				<Text className="mt-2 font-inter text-sm leading-5 text-gray-200">
					No seats selected. You can continue without seat selections.
				</Text>
			) : groups.length === 0 ? (
				<Text className="mt-2 font-inter text-sm leading-5 text-gray-200">
					Seat details are not available for this review.
				</Text>
			) : (
				groups.map((group) => (
					<View key={group.passengerId ?? "unmatched"} className="mt-4 border-t border-border pt-4">
						<Text className="font-inter-semibold text-sm text-black">
							{group.passengerLabel}
							{group.passengerCategory ? ` · ${group.passengerCategory}` : ""}
						</Text>
						{group.associationWarning ? (
							<Text className="mt-1 font-inter text-xs leading-5 text-orange-700">
								This seat could not be matched to exactly one passenger. Do not rely on this
								association until the passenger details are corrected.
							</Text>
						) : null}
						{group.seats.map((seat) => (
							<View
								key={`${seat.segmentId}-${seat.seatDesignator}-${seat.passengerId ?? "unknown"}`}
								className="mt-3 rounded-xl bg-gray-50 p-3"
							>
								<View className="flex-row items-start justify-between">
									<View className="flex-1 pr-3">
										<Text className="font-inter-semibold text-sm text-black">
											Seat {seat.seatDesignator} · {seat.seatName}
										</Text>
										<Text className="mt-1 font-inter text-xs text-gray-200">
											{seat.segmentLabel}
										</Text>
									</View>
									<Text
										className={`font-inter-semibold text-xs ${
											seat.status === "valid" ? "text-green-700" : "text-orange-700"
										}`}
									>
										{seatStatusLabels[seat.status]}
									</Text>
								</View>

								{seat.status === "price_changed" ||
								seat.status === "disclosures_and_price_changed" ? (
									<View className="mt-3">
										<View className="flex-row justify-between">
											<Text className="font-inter text-xs text-gray-200">Previously selected</Text>
											<Text className="font-inter text-xs text-black">
												{formatProviderAmount(seat.originalAmount, seat.originalCurrency)}
											</Text>
										</View>
										<View className="mt-1 flex-row justify-between">
											<Text className="font-inter-medium text-xs text-gray-200">Current provider price</Text>
											<Text className="font-inter-semibold text-xs text-black">
												{seat.currentAmount && seat.currentCurrency
													? formatProviderAmount(seat.currentAmount, seat.currentCurrency)
													: "Unavailable"}
											</Text>
										</View>
									</View>
								) : seat.status === "unavailable" ? (
									<Text className="mt-2 font-inter text-xs leading-5 text-orange-800">
										{seat.unavailableReason === "segment_unavailable"
											? "This flight segment is no longer available."
											: seat.unavailableReason === "service_unavailable"
												? "The selected seat service is no longer available."
												: "This seat is no longer available."}
									</Text>
								) : seat.currentAmount && seat.currentCurrency ? (
									<Text className="mt-2 font-inter text-xs text-gray-200">
										Current price: {formatProviderAmount(seat.currentAmount, seat.currentCurrency)}
									</Text>
								) : null}

								{seat.disclosures.length > 0 ? (
									<View className="mt-3">
										<Text className="font-inter-medium text-xs text-black">Seat conditions</Text>
										{seat.disclosures.map((disclosure, index) => (
											<Text
												key={`${index}-${disclosure}`}
												className="mt-1 font-inter text-xs leading-5 text-gray-200"
											>
												• {disclosure}
											</Text>
										))}
									</View>
								) : null}

								{seat.status === "price_changed" ? (
									<Text className="mt-2 font-inter text-xs leading-5 text-orange-800">
										The updated seat price will require your explicit acceptance before checkout can
										continue.
									</Text>
								) : null}
								{seat.status === "disclosures_changed" ||
								seat.status === "disclosures_and_price_changed" ? (
									<Text className="mt-2 font-inter text-xs leading-5 text-orange-800">
										The provider returned updated seat conditions. They must be reviewed and
										acknowledged before checkout can continue.
									</Text>
								) : null}
							</View>
						))}
					</View>
				))
			)}
		</View>
	)
}

function CheckoutPricingSection({
	presentation,
	onAcceptFare,
	onAcceptSeatPrice,
	onAcknowledgeSeatDisclosures,
}: {
	presentation: ReturnType<typeof buildCheckoutPricingPresentation>
	onAcceptFare: () => void
	onAcceptSeatPrice: (componentKey: string) => void
	onAcknowledgeSeatDisclosures: (componentKey: string) => void
}) {
	return (
		<View className="mt-5 rounded-2xl border border-border bg-white p-4">
			<Text className="font-inter-semibold text-base text-black">Pricing and acceptance</Text>
			{presentation.flightFare ? (
				<View className="mt-4 rounded-xl bg-gray-50 p-3">
					<Text className="font-inter-medium text-sm text-black">Flight fare</Text>
					{presentation.flightFare.acceptanceRequired ? (
						<>
							<View className="mt-2 flex-row justify-between">
								<Text className="font-inter text-xs text-gray-200">Previously selected</Text>
								<Text className="font-inter text-xs text-black">
									{formatProviderAmount(
										presentation.flightFare.previousPrice.amount,
										presentation.flightFare.previousPrice.currency,
									)}
								</Text>
							</View>
							<View className="mt-2 flex-row justify-between">
								<Text className="font-inter-medium text-xs text-gray-200">Current provider fare</Text>
								<Text className="font-inter-semibold text-sm text-black">
									{formatProviderAmount(
										presentation.flightFare.currentPrice.amount,
										presentation.flightFare.currentPrice.currency,
									)}
								</Text>
							</View>
							<Pressable
								onPress={onAcceptFare}
								disabled={presentation.flightFare.accepted}
								className={`mt-3 items-center rounded-lg px-4 py-3 ${
									presentation.flightFare.accepted ? "bg-green-50" : "bg-primary"
								}`}
							>
								<Text
									className={`font-inter-semibold text-xs ${
										presentation.flightFare.accepted ? "text-green-700" : "text-white"
									}`}
								>
									{presentation.flightFare.accepted ? "Updated fare accepted" : "Accept updated flight fare"}
								</Text>
							</Pressable>
						</>
					) : (
						<View className="mt-2 flex-row items-center justify-between">
							<Text className="font-inter text-xs text-gray-200">Confirmed fare</Text>
							<Text className="font-inter-semibold text-sm text-black">
								{formatProviderAmount(
									presentation.flightFare.currentPrice.amount,
									presentation.flightFare.currentPrice.currency,
								)}
							</Text>
						</View>
					)}
				</View>
			) : (
				<Text className="mt-2 font-inter text-sm text-orange-800">
					Flight pricing is not ready. Retry verification before continuing.
				</Text>
			)}

			{presentation.seatLines.map((line) => (
				<View key={line.componentKey} className="mt-3 rounded-xl border border-border p-3">
					<Text className="font-inter-medium text-sm text-black">{line.label}</Text>
					{!line.passengerAssociationResolved ? (
						<Text className="mt-2 font-inter text-xs leading-5 text-orange-800">
							This seat could not be matched to exactly one passenger. Checkout is blocked until the
							passenger association can be established.
						</Text>
					) : null}
					{line.status === "unavailable" ? (
						<Text className="mt-2 font-inter text-xs text-orange-800">
							This seat is unavailable and must be replaced or removed.
						</Text>
					) : (
						<>
							{line.priceAcceptanceRequired ? (
								<>
									<View className="mt-2 flex-row justify-between">
										<Text className="font-inter text-xs text-gray-200">Previously selected</Text>
										<Text className="font-inter text-xs text-black">
											{line.previousPrice
												? formatProviderAmount(line.previousPrice.amount, line.previousPrice.currency)
												: "Not available"}
										</Text>
									</View>
									<View className="mt-1 flex-row justify-between">
										<Text className="font-inter-medium text-xs text-gray-200">Current seat price</Text>
										<Text className="font-inter-semibold text-xs text-black">
											{line.currentPrice
												? formatProviderAmount(line.currentPrice.amount, line.currentPrice.currency)
												: "Not available"}
										</Text>
									</View>
									<Pressable
										onPress={() => onAcceptSeatPrice(line.componentKey)}
										disabled={line.priceAccepted}
										className={`mt-3 items-center rounded-lg px-4 py-3 ${
											line.priceAccepted ? "bg-green-50" : "bg-primary"
										}`}
									>
										<Text
											className={`font-inter-semibold text-xs ${
												line.priceAccepted ? "text-green-700" : "text-white"
											}`}
										>
											{line.priceAccepted ? "Seat price accepted" : "Accept updated seat price"}
										</Text>
									</Pressable>
								</>
							) : (
								<Text className="mt-2 font-inter text-xs text-gray-200">
									Current price: {line.currentPrice
										? formatProviderAmount(line.currentPrice.amount, line.currentPrice.currency)
										: "Not available"}
								</Text>
							)}

							{line.disclosureAcknowledgementRequired ? (
								<View className="mt-3 border-t border-border pt-3">
									<Text className="font-inter-medium text-xs text-black">Previous conditions</Text>
									{line.previousDisclosures.length > 0 ? line.previousDisclosures.map((item, index) => (
										<Text key={`old-${index}`} className="mt-1 font-inter text-xs leading-5 text-gray-200">
											• {item}
										</Text>
									)) : (
										<Text className="mt-1 font-inter text-xs text-gray-200">No previous conditions were supplied.</Text>
									)}
									<Text className="mt-3 font-inter-medium text-xs text-black">Updated conditions</Text>
									{line.currentDisclosures.length > 0 ? line.currentDisclosures.map((item, index) => (
										<Text key={`new-${index}`} className="mt-1 font-inter text-xs leading-5 text-gray-200">
											• {item}
										</Text>
									)) : (
										<Text className="mt-1 font-inter text-xs text-gray-200">
											The provider removed the previous conditions. Acknowledgement is still required.
										</Text>
									)}
									<Pressable
										onPress={() => onAcknowledgeSeatDisclosures(line.componentKey)}
										disabled={line.disclosuresAcknowledged}
										className={`mt-3 items-center rounded-lg px-4 py-3 ${
											line.disclosuresAcknowledged ? "bg-green-50" : "bg-primary"
										}`}
									>
										<Text
											className={`font-inter-semibold text-xs ${
												line.disclosuresAcknowledged ? "text-green-700" : "text-white"
											}`}
										>
											{line.disclosuresAcknowledged
												? "Updated conditions acknowledged"
												: "Acknowledge updated seat conditions"}
										</Text>
									</Pressable>
								</View>
							) : null}
						</>
					)}
				</View>
			))}

			<View className="mt-4 border-t border-border pt-4">
				<Text className="font-inter-semibold text-sm text-black">Price breakdown</Text>
				{presentation.status === "mixed_currency" && presentation.pricing?.status === "mixed_currency" ? (
					<>
						{presentation.pricing.components.map((component) => (
							<View key={component.id} className="mt-2 flex-row justify-between">
								<Text className="mr-3 flex-1 font-inter text-xs text-gray-200">{component.label}</Text>
								<Text className="font-inter-medium text-xs text-black">
									{formatProviderAmount(component.money.amount, component.money.currency)}
								</Text>
							</View>
						))}
						<Text className="mt-3 font-inter text-xs leading-5 text-orange-800">
							These components use different currencies. No combined total can be calculated, so checkout
							cannot continue.
						</Text>
					</>
				) : presentation.status === "blocked" ? (
					<Text className="mt-2 font-inter text-xs leading-5 text-orange-800">
						{presentation.reason === "seat_unavailable"
							? "The total is unavailable until every selected seat has been resolved."
							: "The current pricing validation is incomplete. Retry verification before continuing."}
					</Text>
				) : presentation.pricing?.status === "complete" ? (
					<>
						{presentation.pricing.components.map((component) => (
							<View key={component.id} className="mt-2 flex-row justify-between">
								<Text className="mr-3 flex-1 font-inter text-xs text-gray-200">{component.label}</Text>
								<Text className="font-inter-medium text-xs text-black">
									{formatProviderAmount(component.money.amount, component.money.currency)}
								</Text>
							</View>
						))}
						<View className="mt-3 border-t border-border pt-3">
							<View className="flex-row justify-between">
								<Text className="font-inter text-xs text-gray-200">Seat subtotal</Text>
								<Text className="font-inter-medium text-xs text-black">
									{formatProviderAmount(
										presentation.pricing.seatSubtotal.amount,
										presentation.pricing.seatSubtotal.currency,
									)}
								</Text>
							</View>
							<View className="mt-2 flex-row justify-between">
								<Text className="font-inter text-xs text-gray-200">Additional services</Text>
								<Text className="font-inter-medium text-xs text-black">
									{formatProviderAmount(
										presentation.pricing.additionalServicesSubtotal.amount,
										presentation.pricing.additionalServicesSubtotal.currency,
									)}
								</Text>
							</View>
							<View className="mt-3 flex-row justify-between">
								<Text className="font-inter-semibold text-sm text-black">Total</Text>
								<Text className="font-inter-semibold text-base text-black">
									{formatProviderAmount(
										presentation.pricing.total.amount,
										presentation.pricing.total.currency,
									)}
								</Text>
							</View>
						</View>
					</>
				) : null}
			</View>
			<View
				className={`mt-4 rounded-lg p-3 ${
					presentation.allAcceptancesSatisfied && presentation.status === "ready"
						? "bg-green-50"
						: "bg-orange-50"
				}`}
			>
				<Text
					className={`font-inter-medium text-xs ${
						presentation.allAcceptancesSatisfied && presentation.status === "ready"
							? "text-green-800"
							: "text-orange-800"
					}`}
				>
					{presentation.allAcceptancesSatisfied && presentation.status === "ready"
						? "All required prices and seat conditions have been accepted."
						: "Checkout cannot continue until pricing is consistent and every required acceptance is complete."}
				</Text>
			</View>
		</View>
	)
}

function maskDocumentNumber(value: string | undefined): string {
	if (!value?.trim()) return "Not supplied"
	const normalized = value.trim()
	return normalized.length <= 4 ? "••••" : `••••${normalized.slice(-4)}`
}

function formatLayoverDuration(arrivalAt: string, departureAt: string): string | null {
	const hasExplicitTimezone = (value: string) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
	if (!hasExplicitTimezone(arrivalAt) || !hasExplicitTimezone(departureAt)) return null
	const arrival = Date.parse(arrivalAt)
	const departure = Date.parse(departureAt)
	if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure < arrival) return null
	const minutes = Math.round((departure - arrival) / 60_000)
	const hours = Math.floor(minutes / 60)
	const remainingMinutes = minutes % 60
	return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`
}

function PassengerAndItinerarySection({
	flight,
	passengers,
}: {
	flight: FlightOffer | undefined
	passengers: PassengerCollection | null
}) {
	const passengerName = (passenger: NonNullable<typeof passengers>["passengers"][number]) => {
		const name = [
			passenger.identity.givenName,
			passenger.identity.middleName,
			passenger.identity.familyName,
		].filter((part): part is string => Boolean(part?.trim())).join(" ")
		return name || "Name not supplied"
	}
	return (
		<View className="mt-5 rounded-2xl border border-border bg-white p-4">
			<Text className="font-inter-semibold text-base text-black">Passengers</Text>
			{passengers?.passengers.map((passenger) => (
				<View key={passenger.id} className="mt-3 rounded-xl bg-gray-50 p-3">
					<View className="flex-row justify-between">
						<Text className="font-inter-medium text-sm text-black">{passengerName(passenger)}</Text>
						<Text className="font-inter text-xs capitalize text-gray-200">{passenger.category}</Text>
					</View>
					{passenger.contacts.map((contact) => (
						<Text key={contact.id} className="mt-2 font-inter text-xs text-gray-200">
							{contact.type === "email" ? "Email" : "Phone"}: {contact.value}
							{contact.belongsTo === "other" ? " · supplied by another contact" : ""}
						</Text>
					))}
					{passenger.travelDocuments.map((document) => (
						<View key={document.id} className="mt-2 border-t border-border pt-2">
							<Text className="font-inter-medium text-xs text-black">
								{document.type || "Travel document"} · {maskDocumentNumber(document.documentNumber)}
							</Text>
							<Text className="mt-1 font-inter text-xs text-gray-200">
								{document.issuingCountry ? `Issued by ${document.issuingCountry}` : "Issuing country not supplied"}
								{document.expirationDate ? ` · Expires ${document.expirationDate}` : ""}
							</Text>
						</View>
					))}
				</View>
			))}
			<Text className="mt-5 font-inter-semibold text-base text-black">Flight itinerary</Text>
			{(() => {
				const segments = flight?.slices.flatMap((slice) => slice.segments) ?? []
				return segments.map((segment, index) => {
					const nextSegment = segments[index + 1]
					const layover =
						nextSegment && segment.arrivalAirportCode === nextSegment.departureAirportCode
							? formatLayoverDuration(segment.arrivalAt, nextSegment.departureAt)
							: null
					return (
						<View key={segment.id}>
							<View className="mt-3 rounded-lg bg-gray-50 p-3">
								<Text className="font-inter-medium text-sm text-black">
									{segment.departureAirportCode} → {segment.arrivalAirportCode}
								</Text>
								<Text className="mt-1 font-inter text-xs text-gray-200">
									{segment.marketingCarrierName} · {segment.marketingCarrierCode} {segment.flightNumber}
								</Text>
								<Text className="mt-1 font-inter text-xs text-gray-200">
									{new Date(segment.departureAt).toLocaleString()} – {new Date(segment.arrivalAt).toLocaleString()}
								</Text>
								<Text className="mt-1 font-inter text-xs text-gray-200">Flight segment {index + 1}</Text>
							</View>
							{layover ? (
								<Text className="mt-2 text-center font-inter text-xs text-gray-200">
									{layover} layover in {segment.arrivalAirportCode}
								</Text>
							) : null}
						</View>
					)
				})
			})()}
		</View>
	)
}

export default function CheckoutReviewScreen() {
	const { flightId } = useLocalSearchParams<{ flightId?: string }>()
	const flight = useFlightOffersStore((state) =>
		state.offers.find((offer) => offer.id === flightId),
	)
	const activeBookingSession = useFlightBookingStore((state) => state.activeBookingSession)
	const passengerCollection = useFlightBookingStore((state) => state.passengerCollection)
	const checkoutReviewSession = useFlightBookingStore((state) => state.checkoutReviewSession)
	const offerReviewLifecycle = useFlightBookingStore((state) => state.offerReviewLifecycle)
	const selectedSeats = useFlightBookingStore((state) => state.selectedOutboundSeatServices)
	const seatReviewLifecycle = useFlightBookingStore((state) => state.seatReviewLifecycle)
	const getOrCreateCheckoutReviewSession = useFlightBookingStore(
		(state) => state.getOrCreateCheckoutReviewSession,
	)
	const startOfferReviewRefresh = useFlightBookingStore((state) => state.startOfferReviewRefresh)
	const completeOfferReviewRefresh = useFlightBookingStore(
		(state) => state.completeOfferReviewRefresh,
	)
	const failOfferReviewRefresh = useFlightBookingStore((state) => state.failOfferReviewRefresh)
	const startSeatReviewValidation = useFlightBookingStore(
		(state) => state.startSeatReviewValidation,
	)
	const completeSeatReviewValidation = useFlightBookingStore(
		(state) => state.completeSeatReviewValidation,
	)
	const failSeatReviewValidation = useFlightBookingStore((state) => state.failSeatReviewValidation)
	const clearOfferReviewLifecycle = useFlightBookingStore(
		(state) => state.clearOfferReviewLifecycle,
	);
	const getCurrentFlightFareReview = useFlightBookingStore(
		(state) => state.getCurrentFlightFareReview,
	)
	const isCurrentFlightFareAccepted = useFlightBookingStore(
		(state) => state.isCurrentFlightFareAccepted,
	)
	const acceptCurrentFlightFareChange = useFlightBookingStore(
		(state) => state.acceptCurrentFlightFareChange,
	)
	const getCurrentSeatAcceptanceRequirements = useFlightBookingStore(
		(state) => state.getCurrentSeatAcceptanceRequirements,
	)
	const acceptCurrentSeatPriceChange = useFlightBookingStore(
		(state) => state.acceptCurrentSeatPriceChange,
	)
	const acknowledgeCurrentSeatDisclosures = useFlightBookingStore(
		(state) => state.acknowledgeCurrentSeatDisclosures,
	)
	const seatPriceAcceptances = useFlightBookingStore((state) => state.seatPriceAcceptances)
	const seatDisclosureAcknowledgements = useFlightBookingStore(
		(state) => state.seatDisclosureAcknowledgements,
	)
	const flightFareAcceptance = useFlightBookingStore((state) => state.flightFareAcceptance)
	const entryState = useMemo(
		() => getCheckoutReviewEntryState(flightId, flight, activeBookingSession, passengerCollection),
		[activeBookingSession, flight, flightId, passengerCollection],
	)
	const canOpenReview = entryState === "ready"
	const hasReviewSession = isCheckoutReviewSessionCurrent(
		checkoutReviewSession,
		activeBookingSession,
		flightId,
	)

	useEffect(() => {
		if (canOpenReview && flightId) getOrCreateCheckoutReviewSession(flightId)
	}, [canOpenReview, flightId, getOrCreateCheckoutReviewSession])

	const reviewIdentity = useMemo<OfferReviewLifecycleIdentity | null>(() => {
		if (!checkoutReviewSession || !activeBookingSession || !flightId) return null
		return {
			reviewSessionId: checkoutReviewSession.id,
			bookingSessionId: activeBookingSession.id,
			offerId: flightId,
		}
	}, [activeBookingSession, checkoutReviewSession, flightId])

	const lifecycleMatchesSession = Boolean(
		reviewIdentity && isOfferReviewLifecycleForSession(offerReviewLifecycle, reviewIdentity),
	)
	const currentLifecycle = lifecycleMatchesSession ? offerReviewLifecycle : null

	const runOfferRefresh = useCallback(async () => {
		if (!flight || !reviewIdentity || flight.id !== reviewIdentity.offerId) return
		const attempt = startOfferReviewRefresh(reviewIdentity)
		if (!attempt) return

		try {
			const response = await refreshOffer(flight)
			const outcome = createOfferReviewOutcome(flight, response)
			completeOfferReviewRefresh(attempt, outcome)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "We couldn't verify this flight. Please try again."
			failOfferReviewRefresh(attempt, message)
		}
	}, [completeOfferReviewRefresh, failOfferReviewRefresh, flight, reviewIdentity, startOfferReviewRefresh])

	const runSeatValidation = useCallback(
		async (retry = false) => {
			if (!flightId || !reviewIdentity || !currentLifecycle?.outcome) return
			const offerOutcome = currentLifecycle.outcome
			if (offerOutcome.status !== "valid" && offerOutcome.status !== "price_changed") return
			const offerExpiry = offerOutcome.currentOffer.expiresAt
			const offerExpiryTime = offerExpiry ? Date.parse(offerExpiry) : Number.NaN
			if (!Number.isFinite(offerExpiryTime) || offerExpiryTime <= Date.now()) return
			const start = startSeatReviewValidation(offerOutcome.currentOffer.expiresAt, retry, {
				...reviewIdentity,
				snapshotKey: createSeatReviewSnapshotKey(selectedSeats),
				offerReviewAttemptId: currentLifecycle.attemptId,
			})
			if (start.kind !== "started" || !start.attempt) return

			try {
				const response = await validateSeatServices(flightId, selectedSeats)
				const outcome = createSeatReviewOutcome(selectedSeats, response)
				completeSeatReviewValidation(start.attempt, outcome)
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "We couldn't verify your selected seats. Please try again."
				failSeatReviewValidation(start.attempt, message)
			}
		},
		[
			completeSeatReviewValidation,
			currentLifecycle,
			reviewIdentity,
			failSeatReviewValidation,
			flightId,
			selectedSeats,
			startSeatReviewValidation,
		],
	)

	const seatLifecycleMatchesSession = Boolean(
		reviewIdentity && isSeatReviewLifecycleForSession(seatReviewLifecycle, reviewIdentity),
	)
	const currentSeatLifecycle = seatLifecycleMatchesSession ? seatReviewLifecycle : null

	const flightFareReview = getCurrentFlightFareReview()
	const currentSeatRequirements = getCurrentSeatAcceptanceRequirements()
	const flightFareAccepted = isCurrentFlightFareAccepted()
	const passengerLabels = useMemo(() => {
		const labels: Record<string, string> = {}
		passengerCollection?.passengers.forEach((passenger) => {
			const displayName = [
				passenger.identity.givenName,
				passenger.identity.middleName,
				passenger.identity.familyName,
			].filter((part): part is string => Boolean(part?.trim())).join(" ")
			passenger.providerReferences
				.filter((reference) => reference.provider === "duffel" && reference.offerId === flightId)
				.forEach((reference) => {
					labels[reference.providerPassengerId] = displayName || "Passenger"
				})
		})
		return labels
	}, [flightId, passengerCollection])
	const segmentLabels = useMemo(() => {
		const labels: Record<string, string> = {}
		let index = 0
		flight?.slices.forEach((slice) => {
			slice.segments.forEach((segment) => {
				index += 1
				labels[segment.id] = `Segment ${index} · ${segment.departureAirportCode} → ${segment.arrivalAirportCode}`
			})
		})
		return labels
	}, [flight])
	const pricingPresentation = useMemo(
		() =>
			buildCheckoutPricingPresentation({
				flightFareReview,
				flightFareAccepted,
				seatRequirements: currentSeatRequirements,
				seatPriceAcceptances,
				seatDisclosureAcknowledgements,
				passengerLabels,
				segmentLabels,
			}),
		[
			currentSeatRequirements,
			flightFareAccepted,
			flightFareReview,
			passengerLabels,
			seatDisclosureAcknowledgements,
			seatPriceAcceptances,
			segmentLabels,
		],
	)

	const seatReviewGroups = useMemo(() => {
		if (
			selectedSeats.length===0||
			!currentSeatLifecycle?.outcome ||
			!passengerCollection ||
			!flight ||
			currentSeatLifecycle.outcome.status === "not_selected"
		) {
			return []
		}
		return buildSeatReviewPresentation(
			currentSeatLifecycle.outcome,
			selectedSeats,
			passengerCollection,
			flight,
		)
	}, [currentSeatLifecycle, flight, passengerCollection, selectedSeats])

	useFocusEffect(
		useCallback(() => {
			if (!canOpenReview || !hasReviewSession || !flight || !reviewIdentity) return
			if (!shouldStartOfferReviewRefresh(offerReviewLifecycle, reviewIdentity)) return
			void runOfferRefresh()
		}, [
			canOpenReview,
			flight,
			hasReviewSession,
			offerReviewLifecycle,
			reviewIdentity,
			runOfferRefresh,
		]),
	)

	useFocusEffect(
		useCallback(() => {
			if (!currentLifecycle?.outcome || !reviewIdentity) return
			if (
				currentLifecycle.outcome.status !== "valid" &&
				currentLifecycle.outcome.status !== "price_changed"
			)
				return
			void runSeatValidation()
		}, [currentLifecycle, reviewIdentity, runSeatValidation]),
	)

	const returnToPassengers = () => {
		if (!flightId) {
			router.replace("/flight-results")
			return
		}
		router.push({ pathname: "/personal-information", params: { flightId, returnToReview: "true" } })
	}

	const returnToSearch = () => {
		clearOfferReviewLifecycle()
		router.replace("/flight-results")
	}

	const continueToPaymentPlaceholder = () => {
		const state = useFlightBookingStore.getState()
		if (
			getCheckoutReviewEntryState(
				flightId,
				flight,
				state.activeBookingSession,
				state.passengerCollection,
			) !== "ready"
		) {
			return
		}
		const currentFareReview = state.getCurrentFlightFareReview()
		const currentSeatRequirements = state.getCurrentSeatAcceptanceRequirements()
		const currentPricing = buildCheckoutPricingPresentation({
			flightFareReview: currentFareReview,
			flightFareAccepted: state.isCurrentFlightFareAccepted(),
			seatRequirements: currentSeatRequirements,
			seatPriceAcceptances: state.seatPriceAcceptances,
			seatDisclosureAcknowledgements: state.seatDisclosureAcknowledgements,
			passengerLabels,
			segmentLabels,
		})
		if (
			currentPricing.status !== "ready" ||
			!currentPricing.allAcceptancesSatisfied ||
			currentPricing.pricing?.status !== "complete" ||
			!state.areCurrentSeatRequirementsSatisfied() ||
			!state.isCurrentFlightFareAccepted()
		) {
			return
		}
		router.push("/payment")
	}

	if (entryState === "flight_unavailable") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">Flight unavailable</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					This flight is no longer in the current search results. Return to your search and select
					an available flight.
				</Text>
				<Pressable onPress={returnToSearch} className="mt-5 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Back to search</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (entryState === "booking_session_unavailable") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">Booking session unavailable</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					This review is not connected to an active booking session. Return to your search and
					select the flight again.
				</Text>
				<Pressable onPress={returnToSearch} className="mt-5 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Back to search</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (entryState === "passenger_details_incomplete") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">
					Passenger details need attention
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					Complete and validate the required traveller information before reviewing this booking.
				</Text>
				<Pressable onPress={returnToPassengers} className="mt-5 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Return to passenger details</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (!hasReviewSession || !reviewIdentity || !currentLifecycle) {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" color="#EC441E" />
				<Text className="mt-3 font-inter text-sm text-gray-200">Preparing checkout review…</Text>
			</SafeAreaView>
		)
	}

	if (currentLifecycle.status === "refreshing") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<ActivityIndicator size="large" color="#EC441E" />
				<Text className="mt-4 font-inter-semibold text-base text-black">Verifying your flight</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					We&apos;re checking the latest availability, itinerary and fare with the flight provider.
				</Text>
				<Text className="mt-2 font-inter text-xs text-gray-200">
					Attempt {currentLifecycle.attemptNumber} of 3
				</Text>
			</SafeAreaView>
		)
	}

	if (currentLifecycle.status === "error") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<View className="h-12 w-12 items-center justify-center rounded-full bg-orange-50">
					<Feather name="wifi-off" size={22} color="#C2410C" />
				</View>
				<Text className="mt-4 font-inter-semibold text-lg text-black">
					We couldn&apos;t verify this flight
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					{currentLifecycle.errorMessage ?? "A temporary problem prevented flight verification."}
				</Text>
				<Text className="mt-2 font-inter text-xs text-gray-200">
					Attempt {currentLifecycle.attemptNumber} of 3. Your passenger and seat selections are
					still saved.
				</Text>
				<Pressable
					onPress={() => void runOfferRefresh()}
					className="mt-6 h-12 items-center justify-center rounded-xl bg-primary px-8"
				>
					<Text className="font-inter-semibold text-sm text-white">Retry verification</Text>
				</Pressable>
				<Pressable onPress={returnToSearch} className="mt-4 px-6 py-2">
					<Text className="font-inter-medium text-sm text-primary">Return to search</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (currentLifecycle.status === "retry_exhausted") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">
					Flight verification unavailable
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					We couldn&apos;t verify this flight after three attempts. Your booking details have not
					been deleted. Return to search to select a flight and begin a fresh review.
				</Text>
				<Pressable onPress={returnToSearch} className="mt-6 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Return to search</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (currentLifecycle.status === "unavailable") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">
					This flight is no longer available
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					The provider can no longer offer the selected flight. Return to search and choose another
					available option.
				</Text>
				<Pressable onPress={returnToSearch} className="mt-6 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Back to search</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (currentLifecycle.status === "itinerary_changed") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">
					Your flight itinerary has changed
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					The provider returned a materially different itinerary. We won&apos;t replace your
					original selection automatically. Return to search and select a flight again.
				</Text>
				<Pressable onPress={returnToSearch} className="mt-6 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Choose another flight</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	const outcome = currentLifecycle.outcome
	if (!outcome || (outcome.status !== "valid" && outcome.status !== "price_changed")) {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">Review needs to be restarted</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					The flight verification state is incomplete. Return to search and select the flight again.
				</Text>
				<Pressable onPress={returnToSearch} className="mt-6 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Back to search</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (!currentSeatLifecycle) {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<ActivityIndicator size="large" color="#EC441E" />
				<Text className="mt-3 font-inter text-sm text-gray-200">Preparing seat review…</Text>
			</SafeAreaView>
		)
	}

	if (currentSeatLifecycle?.status === "validating") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<ActivityIndicator size="large" color="#EC441E" />
				<Text className="mt-4 font-inter-semibold text-base text-black">
					Verifying selected seats
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					We&apos;re checking each selected seat against the current flight offer.
				</Text>
				<Text className="mt-2 font-inter text-xs text-gray-200">
					Attempt {currentSeatLifecycle.attemptNumber} of 3
				</Text>
			</SafeAreaView>
		)
	}

	if (
		currentSeatLifecycle?.status === "error" ||
		currentSeatLifecycle?.status === "retry_exhausted"
	) {
		const exhausted = currentSeatLifecycle.status === "retry_exhausted"
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">
					{exhausted ? "Seat verification unavailable" : "We couldn't verify your seats"}
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					{currentSeatLifecycle.errorMessage ?? "A temporary problem prevented seat verification."}
				</Text>
				<Text className="mt-2 font-inter text-xs text-gray-200">
					Attempt {currentSeatLifecycle.attemptNumber} of 3. Your seat selections are still saved.
				</Text>
				{!exhausted ? (
					<Pressable
						onPress={() => void runSeatValidation(true)}
						className="mt-6 rounded-xl bg-primary px-8 py-3"
					>
						<Text className="font-inter-semibold text-sm text-white">Retry seat verification</Text>
					</Pressable>
				) : null}
				<Pressable onPress={returnToSearch} className="mt-4 px-6 py-2">
					<Text className="font-inter-medium text-sm text-primary">Return to search</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (
		currentSeatLifecycle?.status === "action_required" &&
		currentSeatRequirements?.some((requirement) => requirement.status === "unavailable")
	) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<ScrollView className="flex-1 px-6 pt-8" contentContainerStyle={{ paddingBottom: 32 }}>
					<Text className="font-inter-semibold text-xl text-black">
						Your seat selection needs attention
					</Text>
					<Text className="mt-2 font-inter text-sm leading-5 text-gray-200">
						Review the provider&apos;s latest result for each selected seat. Unavailable seats must be
						replaced or removed. Changed prices and conditions remain unaccepted at this stage.
					</Text>
					<SeatReviewSection groups={seatReviewGroups} />
					<Pressable
						onPress={() =>
							flightId
								? router.replace({ pathname: "/choose-seat", params: { flightId } })
								: router.replace("/flight-results")
						}
						className="mt-6 h-14 items-center justify-center rounded-xl bg-primary"
					>
						<Text className="font-inter-semibold text-base text-white">Return to seat selection</Text>
					</Pressable>
					<Pressable onPress={returnToSearch} className="mt-3 items-center py-3">
						<Text className="font-inter-medium text-sm text-primary">Return to search</Text>
					</Pressable>
				</ScrollView>
			</SafeAreaView>
		)
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-row items-center px-5 py-4">
				<Pressable
					onPress={() => router.back()}
					className="h-10 w-10 items-center justify-center"
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel="Go back"
				>
					<Feather name="chevron-left" size={28} color="#191919" />
				</Pressable>
				<Text className="mr-10 flex-1 text-center font-inter-medium text-xl text-black">
					Checkout review
				</Text>
			</View>

			<ScrollView className="flex-1 px-6 pt-5" contentContainerStyle={{ paddingBottom: 32 }}>
				<View className="rounded-2xl border border-border bg-white p-5">
					<View className="h-11 w-11 items-center justify-center rounded-full bg-green-50">
						<Feather name="check" size={22} color="#15803D" />
					</View>
					<Text className="mt-4 font-inter-semibold text-lg text-black">Flight offer verified</Text>
					<Text className="mt-2 font-inter text-sm leading-6 text-gray-200">
						The provider confirmed that the selected itinerary is still available. The original
						flight selection has been preserved.
					</Text>
				</View>

				{outcome.status === "price_changed" ? (
					<View className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
						<Text className="font-inter-semibold text-sm text-black">
							The flight price has changed
						</Text>
						<View className="mt-3 flex-row justify-between">
							<Text className="font-inter text-xs text-gray-200">Original fare</Text>
							<Text className="font-inter-medium text-sm text-black">
								{formatProviderAmount(outcome.previousPrice.amount, outcome.previousPrice.currency)}
							</Text>
						</View>
						<View className="mt-2 flex-row justify-between">
							<Text className="font-inter text-xs text-gray-200">Current fare</Text>
							<Text className="font-inter-semibold text-sm text-black">
								{formatProviderAmount(outcome.currentPrice.amount, outcome.currentPrice.currency)}
							</Text>
						</View>
						<Text className="mt-3 font-inter text-xs leading-5 text-gray-200">
							The updated fare requires your explicit acceptance in the pricing section below.
						</Text>
					</View>
				) : (
					<View className="mt-4 rounded-xl border border-border bg-white p-4">
						<Text className="font-inter-medium text-sm text-black">Fare unchanged</Text>
						<Text className="mt-1 font-inter text-xs leading-5 text-gray-200">
							The provider confirmed the selected fare without a price change.
						</Text>
					</View>
				)}

				<PassengerAndItinerarySection flight={flight} passengers={passengerCollection} />

				<SeatReviewSection
					groups={seatReviewGroups}
					notSelected={selectedSeats.length===0}
				/>

				<CheckoutPricingSection
					presentation={pricingPresentation}
					onAcceptFare={() => acceptCurrentFlightFareChange()}
					onAcceptSeatPrice={(componentKey) => acceptCurrentSeatPriceChange(componentKey)}
					onAcknowledgeSeatDisclosures={(componentKey) =>
						acknowledgeCurrentSeatDisclosures(componentKey)
					}
				/>

				<Pressable
					onPress={returnToPassengers}
					className="mt-6 h-14 items-center justify-center rounded-xl border border-primary"
				>
					<Text className="font-inter-semibold text-base text-primary">Edit passenger details</Text>
				</Pressable>
				<Pressable
					onPress={continueToPaymentPlaceholder}
					disabled={
						pricingPresentation.status !== "ready" ||
						!pricingPresentation.allAcceptancesSatisfied ||
						pricingPresentation.pricing?.status !== "complete"
					}
					className={`mt-3 h-14 items-center justify-center rounded-xl ${
						pricingPresentation.status === "ready" &&
						pricingPresentation.allAcceptancesSatisfied &&
						pricingPresentation.pricing?.status === "complete"
							? "bg-primary"
							: "bg-gray-300"
					}`}
				>
					<Text className="font-inter-semibold text-base text-white">Continue to payment</Text>
				</Pressable>
				<Text className="mt-3 text-center font-inter text-xs leading-5 text-gray-200">
					Continuing opens the existing payment placeholder only. No order, reservation or payment is
					created in this checkpoint.
				</Text>
			</ScrollView>
		</SafeAreaView>
	)
}