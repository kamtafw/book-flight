import { Feather } from "@expo/vector-icons"
import { router, useFocusEffect, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useMemo } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { isCheckoutReviewSessionCurrent } from "@/lib/booking/readiness/booking-session"
import { getCheckoutReviewEntryState } from "@/lib/booking/readiness/checkout-review"
import { createOfferReviewOutcome } from "@/lib/booking/readiness/offer-review"
import {
	isOfferReviewLifecycleForSession,
	shouldStartOfferReviewRefresh,
	type OfferReviewLifecycleIdentity,
} from "@/lib/booking/readiness/offer-review-lifecycle"
import { createSeatReviewOutcome } from "@/lib/booking/readiness/seat-review"
import { isSeatReviewLifecycleForSession } from "@/lib/booking/readiness/seat-review-lifecycle"
import { refreshOffer, validateSeatServices } from "@/lib/flights/api"
import { useFlightBookingStore } from "@/store/flight-booking.store"
import { useFlightOffersStore } from "@/store/flight-offers.store"

function formatProviderAmount(amount: string, currency: string) {
	return `${currency} ${amount}`
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
	)

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
		if (!flight) return
		const attempt = startOfferReviewRefresh()
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
	}, [completeOfferReviewRefresh, failOfferReviewRefresh, flight, startOfferReviewRefresh])

	const runSeatValidation = useCallback(
		async (retry = false) => {
			if (!flightId || !currentLifecycle?.outcome) return
			const offerOutcome = currentLifecycle.outcome
			if (offerOutcome.status !== "valid" && offerOutcome.status !== "price_changed") return
			const offerExpiry = offerOutcome.currentOffer.expiresAt
			const offerExpiryTime = offerExpiry ? Date.parse(offerExpiry) : Number.NaN
			if (!Number.isFinite(offerExpiryTime) || offerExpiryTime <= Date.now()) return
			const start = startSeatReviewValidation(offerOutcome.currentOffer.expiresAt, retry)
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

	if (currentSeatLifecycle?.status === "action_required") {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">
					Your seat selection needs attention
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					One or more selected seats are unavailable or have changed price or conditions. Return to
					seat selection to review them.
				</Text>
				<Pressable
					onPress={() =>
						flightId
							? router.replace({ pathname: "/choose-seat", params: { flightId } })
							: router.replace("/flight-results")
					}
					className="mt-6 rounded-xl bg-primary px-8 py-3"
				>
					<Text className="font-inter-semibold text-sm text-white">Review seat selection</Text>
				</Pressable>
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

			<View className="flex-1 px-6 pt-5">
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
							This updated fare will require your explicit acceptance later in checkout. You cannot
							proceed until the remaining review and acceptance steps are complete.
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

				<View className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
					<Text className="font-inter-medium text-sm text-black">What happens next</Text>
					<Text className="mt-1 font-inter text-xs leading-5 text-gray-200">
						Flight verification is complete. Selected seats, full booking details and the final
						pricing breakdown are handled by the next Checkout Review checkpoints. No booking or
						payment has been created.
					</Text>
				</View>

				<Pressable
					onPress={returnToPassengers}
					className="mt-6 h-14 items-center justify-center rounded-xl border border-primary"
				>
					<Text className="font-inter-semibold text-base text-primary">Edit passenger details</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	)
}
