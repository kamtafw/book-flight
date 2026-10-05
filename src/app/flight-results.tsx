import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { FlatList, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FlightResultCard from "@/components/flight-result-card"
import { cabinOptions } from "@/constants"
import { airports, mockFlights } from "@/lib/data"
import { useFlightSearchStore } from "@/store/flight-search.store"

export default function FlightResultsScreen() {
	const { tripType, departureDate, returnDate, fromAirport, toAirport, passengers, cabinClass } =
		useFlightSearchStore()

	const selectedFromAirport = airports.find((airport) => airport.code === fromAirport)

	const selectedToAirport = airports.find((airport) => airport.code === toAirport)

	const cabinLabel = cabinOptions.find((cabin) => cabin.value === cabinClass)?.label ?? "Economy"

	const travellerSummary = [
		`${passengers.adults} Adult${passengers.adults !== 1 ? "s" : ""}`,
		passengers.children > 0
			? `${passengers.children} Child${passengers.children !== 1 ? "ren" : ""}`
			: null,
		passengers.infants > 0
			? `${passengers.infants} Infant${passengers.infants !== 1 ? "s" : ""}`
			: null,
	]
		.filter(Boolean)
		.join(", ")

	const handleCheck = (flightId: string) => {
		router.push({
			pathname: "/flight-details",
			params: { flightId },
		})
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-row items-center px-6 py-4">
				<Pressable onPress={() => router.back()} className="p-1 -ml-1">
					<Ionicons name="chevron-back" size={24} color="#191919" />
				</Pressable>
				<Text className="flex-1 text-center font-inter-bold text-xl text-black mr-6">
					Search Result
				</Text>
			</View>

			{/* Search summary */}
			<View className="px-6 pb-5">
				<View className="bg-white rounded-xl border border-border px-4 py-3 items-center">
					<View className="flex-row items-center">
						<Text className="font-inter-semibold text-sm text-black">
							{selectedFromAirport?.code}
						</Text>

						<Text className="mx-2 font-inter text-gray-200">→</Text>

						<Text className="font-inter-semibold text-sm text-black">
							{selectedToAirport?.code}
						</Text>
					</View>

					<Text className="mt-1 font-inter text-xs text-gray-200">
						{departureDate}
						{tripType === "round" && returnDate ? ` · ${returnDate}` : ""}
						{" · "}
						{travellerSummary}
						{" · "}
						{cabinLabel}
					</Text>
				</View>
			</View>

			<FlatList
				data={mockFlights}
				keyExtractor={(flight) => flight.id}
				contentContainerClassName="gap-4 px-6 pb-10"
				showsVerticalScrollIndicator={false}
				renderItem={({ item }) => (
					<FlightResultCard
						flight={item}
						cabinLabel={cabinLabel}
						departureAirport={`${selectedFromAirport?.code} (${selectedFromAirport?.city})`}
						arrivalAirport={`${selectedToAirport?.code} (${selectedToAirport?.city})`}
						onCheck={() => handleCheck(item.id)}
					/>
				)}
			/>
		</SafeAreaView>
	)
}
