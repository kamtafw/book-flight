import { Feather } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { getCheckoutReviewEntryState } from "@/lib/booking/readiness/checkout-review"
import { isCheckoutReviewSessionCurrent } from "@/lib/booking/readiness/booking-session"
import { useFlightBookingStore } from "@/store/flight-booking.store"
import { useFlightOffersStore } from "@/store/flight-offers.store"

export default function CheckoutReviewScreen() {
	const { flightId } = useLocalSearchParams<{ flightId?: string }>()
	const flight = useFlightOffersStore((state) =>
		state.offers.find((offer) => offer.id === flightId),
	)
	const activeBookingSession = useFlightBookingStore((state) => state.activeBookingSession)
	const passengerCollection = useFlightBookingStore((state) => state.passengerCollection)
	const checkoutReviewSession = useFlightBookingStore((state) => state.checkoutReviewSession)
	const getOrCreateCheckoutReviewSession = useFlightBookingStore(
		(state) => state.getOrCreateCheckoutReviewSession,
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

	const returnToPassengers = () => {
		if (!flightId) {
			router.replace("/flight-results")
			return
		}
		router.push({ pathname: "/personal-information", params: { flightId } })
	}

	const returnToSearch = () => router.replace("/flight-results")

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
				<Text className="font-inter-semibold text-lg text-black">Passenger details need attention</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					Complete and validate the required traveller information before reviewing this booking.
				</Text>
				<Pressable onPress={returnToPassengers} className="mt-5 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Return to passenger details</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (!hasReviewSession) {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" color="#EC441E" />
				<Text className="mt-3 font-inter text-sm text-gray-200">Preparing checkout review…</Text>
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
					<Text className="mt-4 font-inter-semibold text-lg text-black">
						Passenger details are ready
					</Text>
					<Text className="mt-2 font-inter text-sm leading-6 text-gray-200">
						Your traveller information is ready for review. The next step will verify the latest
						flight offer and any selected seats before showing the final price.
					</Text>
				</View>

				<View className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
					<Text className="font-inter-medium text-sm text-black">Review setup</Text>
					<Text className="mt-1 font-inter text-xs leading-5 text-gray-200">
						Your booking draft is preserved while you move between passenger details and this
						screen. No booking or payment has been created.
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
