import { airports, mockFlights } from "@/lib/data"
import { useFlightSearchStore } from "@/store/flight-search.store"
import { Feather, FontAwesome5 } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function FlightDetails() {
	const { flightId } = useLocalSearchParams<{ flightId?: string }>()

	const { departureDate, fromAirport, toAirport, cabinClass } = useFlightSearchStore()

	const flight = mockFlights.find((item) => item.id === flightId)
	const departureAirport = airports.find((airport) => airport.code === fromAirport)
	const arrivalAirport = airports.find((airport) => airport.code === toAirport)

	const handleCancel = () => {
		router.back()
	}

	const handleConfirm = () => {
		router.push({
			pathname: "/choose-seat",
			params: { flightId },
		})
	}

	if (!flight || !departureAirport || !arrivalAirport) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-1 items-center justify-center px-8">
					<Text className="font-inter-semibold text-lg text-black text-center">
						Flight unavailable
					</Text>

					<Pressable onPress={handleCancel} className="mt-5 rounded-xl bg-primary px-6 py-3">
						<Text className="font-inter-medium text-white">Go Back</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		)
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row items-center px-6 py-4">
				<Pressable
					onPress={handleCancel}
					className="h-10 w-10 items-center justify-center"
					hitSlop={8}
				>
					<Feather name="chevron-left" size={28} color="#191919" />
				</Pressable>
				<Text className="flex-1 text-center font-inter-medium text-xl text-black mr-6">
					Flight Details
				</Text>
			</View>

			<ScrollView className="px-6 pt-12 pb-8">
				{/* Details Card */}
				<View className="overflow-hidden bg-white rounded-2xl shadow">
					{/* Airline */}
					<View className="items-center justify-center px-5 py-7">
						<View className="h-28 w-40 items-center justify-center rounded-lg border border-border">
							<Text className="font-inter-bold text-3xl text-primary">{flight.airline}</Text>
						</View>
					</View>

					<View className="h-px bg-border" />

					{/* Route */}
					<View className="px-5 py-7">
						<View className="flex-row items-start">
							{/* Departure */}
							<View className="flex-1">
								<Text className="font-inter-semibold text-3xl text-black">
									{flight.departureTime}
								</Text>
								<Text className="mt-1 font-inter-medium text-lg text-black">
									{departureAirport.code}
								</Text>
								<Text className="mt-5 font-inter text-sm leading-5 text-gray-200" numberOfLines={3}>
									{departureAirport.name}
								</Text>
							</View>

							<View className="flex-[1.15] px-2 pt-5">
								<View className="flex-row items-center">
									<View className="h-2.5 w-2.5 rounded-full bg-gray-300" />
									<View className="h-px flex-1 bg-gray-300" />

									<View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
										<FontAwesome5 name="plane" size={20} color="white" />
									</View>

									<View className="h-px flex-1 bg-gray-300" />
									<View className="h-2.5 w-2.5 rounded-full bg-gray-300" />
								</View>
							</View>

							{/* Arrival */}
							<View className="flex-1 items-end">
								<Text className="font-inter-semibold text-3xl text-black">
									{flight.arrivalTime}
								</Text>
								<Text className=" mt-1 font-inter-medium text-lg text-black">
									{arrivalAirport.code}
								</Text>
								<Text
									className="mt-5 text-right font-inter text-sm leading-5 text-gray-200"
									numberOfLines={3}
								>
									{arrivalAirport.name}
								</Text>
							</View>
						</View>
					</View>

					<View className="h-px bg-border" />

					{/* Date + Time */}
					<View className="flex-row gap-4 px-5 py-7">
						<View className="flex-1">
							<Text className="mb-2 ml-3 font-inter text-sm text-gray-200">Date</Text>
							<View className="flex-row items-center gap-3 rounded-xl border border-border px-4 py-4">
								<Feather name="calendar" size={20} color="#555" />
								<Text className="font-inter-medium text-base text-black">{departureDate}</Text>
							</View>
						</View>

						<View className="flex-1">
							<Text className="mb-2 ml-3 font-inter text-sm text-gray-200">Time</Text>
							<View className="flex-row items-center gap-3 rounded-xl border border-border px-4 py-4">
								<Feather name="clock" size={20} color="#555" />
								<Text className="font-inter-medium text-base text-black">
									{flight.departureTime}
								</Text>
							</View>
						</View>
					</View>

					<View className="h-px bg-border" />

					{/* Price */}
					<View className="flex-row items-baseline justify-center gap-3 px-5 py-7">
						<Text className="font-inter-light text-2xl text-black">Price</Text>
						<Text className="font-inter-bold text-4xl text-black">
							{flight.currency}
							{flight.price}
						</Text>
					</View>
				</View>

				{/* Actions */}
				<View className="mt-10 flex-row gap-4">
					<Pressable
						onPress={handleCancel}
						className="flex-1 items-center justify-center rounded-xl border border-primary py-4 active:opacity-90"
					>
						<Text className="font-inter-medium text-lg text-primary">Cancel</Text>
					</Pressable>

					<Pressable
						onPress={handleConfirm}
						className="flex-1 items-center justify-center rounded-xl bg-primary py-4 active:opacity-90"
					>
						<Text className="font-inter-medium text-lg text-white">Confirm</Text>
					</Pressable>
				</View>
			</ScrollView>
		</SafeAreaView>
	)
}
