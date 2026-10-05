import { airports, mockFlights } from "@/lib/data"
import { useFlightSearchStore } from "@/store/flight-search.store"
import { Feather, FontAwesome5, Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { Pressable, Text, TouchableOpacity, View } from "react-native"
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

	const handleConfirm = () => {}

	if (!flight || !departureAirport || !arrivalAirport) {
		return (
			<SafeAreaView className="flex-1 bg-background">
				<View className="flex-1 items-center justify-center px-8">
					<Text className="font-inter-semibold text-lg text-black">Flight unavailable</Text>

					<Pressable onPress={() => router.back()} className="mt-5 rounded-xl bg-primary px-6 py-3">
						<Text className="font-inter-medium text-white">Go Back</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		)
	}
	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-row items-center px-6 py-4">
				<Pressable onPress={() => router.back()} className="p-1 -ml-1">
					<Ionicons name="chevron-back" size={24} color="#191919" />
				</Pressable>
				<Text className="flex-1 text-center font-inter-bold text-xl text-black mr-6">
					Flight Details
				</Text>
			</View>

			<View className="bg-white rounded-2xl mx-6 mt-8 mb-6 shadow-md elevation-5">
				<View className="items-center py-6 border-b border-border">
					<View className="h-28 w-40 items-center justify-center rounded-lg border border-border">
						<Text className="font-inter-bold text-3xl text-primary">{flight.airline}</Text>
					</View>
				</View>

				<View className="px-5 py-7 border-b border-border">
					<View className="flex-row items-start">
						<View className="flex-1">
							<Text className="font-inter-semibold text-2xl text-black">
								{flight.departureTime}
							</Text>
							<Text className="font-inter-medium text-base text-black mt-1">
								{departureAirport.code}
							</Text>
							<Text className="font-inter text-sm text-gray-200 mt-4" numberOfLines={3}>
								{departureAirport.name}
							</Text>
						</View>

						<View className="flex-1 px-2 pt-3">
							<View className="flex-row items-center">
								<View className="h-2.5 w-2.5 rounded-full bg-gray-300" />
								<View className="flex-1 h-[1px] bg-gray-300" />

								<View className="h-12 w-12 rounded-full bg-primary items-center justify-center shadow-md shadow-primary/30 elevation-5">
									<FontAwesome5 name="plane" size={18} color="white" />
								</View>

								<View className="flex-1 h-[1px] bg-gray-300" />
								<View className="h-2.5 w-2.5 rounded-full bg-gray-300" />
							</View>
						</View>

						<View className="flex-1 items-end">
							<Text className="font-inter-semibold text-2xl text-black">{flight.arrivalTime}</Text>
							<Text className="font-inter-medium text-base text-black mt-1">
								{arrivalAirport.code}
							</Text>
							<Text className="font-inter text-sm text-gray-200 mt-4 text-right" numberOfLines={3}>
								{arrivalAirport.name}
							</Text>
						</View>
					</View>
				</View>

				{/* Flight Date & Time */}
				<View className="flex-row gap-4 px-5 py-6 border-b border-border">
					<View className="flex-1 border border-border rounded-xl p-3 relative">
						<Text className="absolute -top-2.5 left-4 bg-white px-1 font-inter-light text-xs text-gray-200">
							Date
						</Text>
						<View className="flex-row items-center mt-1 gap-3">
							<Feather name="calendar" size={20} color="#555" />
							<Text className="font-inter-medium text-base text-black">{departureDate}</Text>
						</View>
					</View>

					<View className="flex-1 border border-border rounded-xl p-3 relative">
						<Text className="absolute -top-2.5 left-4 bg-white px-1 font-inter-light text-xs text-gray-200">
							Time
						</Text>
						<View className="flex-row items-center mt-1 gap-3">
							<Feather name="clock" size={20} color="#555" />
							<Text className="font-inter-medium text-base text-black">{flight.departureTime}</Text>
						</View>
					</View>
				</View>

				{/* Price */}
				<View className="items-center py-8">
					<View className="flex-row items-baseline gap-2">
						<Text className="font-inter-light text-2xl text-black">Price</Text>

						<Text className="font-inter-bold text-4xl text-black">
							{flight.currency}
							{flight.price}
						</Text>
					</View>
				</View>
			</View>

			<View className="flex-row gap-4 px-6 py-4">
				<TouchableOpacity
					onPress={handleCancel}
					className="flex-1 w-1/2 py-4 rounded-xl items-center border border-primary active:opacity-90"
				>
					<Text className="text-primary font-inter-medium text-lg">Cancel</Text>
				</TouchableOpacity>

				<TouchableOpacity className="flex-1 w-1/2 py-4 rounded-xl items-center bg-primary active:opacity-90">
					<Text className="text-white font-inter-medium text-lg">Confirm</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
