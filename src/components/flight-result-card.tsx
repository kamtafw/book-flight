import { Feather,FontAwesome5 } from "@expo/vector-icons"
import { Pressable,Text,View } from "react-native"

interface FlightResultCardProps {
	flight: AppConfig.Flight
	departureAirport: string
	arrivalAirport: string
	cabinLabel: string
	onCheck: () => void
}

export default function FlightResultCard({
	flight,
	departureAirport,
	arrivalAirport,
	cabinLabel,
	onCheck,
}: FlightResultCardProps) {
	return (
		<View className="bg-white rounded-2xl shadow-md elevation-5 overflow-hidden">
			{/* Airline + flight number + duration */}
			<View className="flex-row items-center px-5 pt-5">
				<View className="flex-row items-center flex-1 gap-3">
					<View className="h-10 w-10 rounded-lg border border-border items-center justify-center">
						<Text className="font-inter-semibold text-xs text-primary">
							{flight.airline.slice(0, 2).toUpperCase()}
						</Text>
					</View>

					<Text className="font-inter-semibold text-base text-black">{flight.flightNumber}</Text>
				</View>

				<Text className="font-inter text-sm text-gray-200">{flight.duration}</Text>
			</View>

			{/* Route */}
			<View className="flex-row items-center px-5 py-5">
				<View className="flex-1">
					<Text className="font-inter-semibold text-xl text-black">{flight.departureTime}</Text>
					<Text className="font-inter text-xs text-gray-200 mt-1">{departureAirport}</Text>
				</View>

				<View className="flex-row items-center flex-1 px-2">
					<View className="h-2 w-2 rounded-full bg-gray-300" />
					<View className="flex-1 h-[1px] bg-gray-300" />

					<View className="h-10 w-10 rounded-full bg-primary items-center justify-center shadow-md shadow-primary/30 elevation-5">
						<FontAwesome5 name="plane" size={14} color="white" />
					</View>

					<View className="flex-1 h-[1px] bg-gray-300" />
					<View className="h-2 w-2 rounded-full bg-gray-300" />
				</View>

				<View className="flex-1 items-end">
					<Text className="font-inter-semibold text-xl text-black">{flight.arrivalTime}</Text>
					<Text className="font-inter text-xs text-gray-200 mt-1">{arrivalAirport}</Text>
				</View>
			</View>

			<View className="h-[1px] bg-border" />

			{/* Cabin + price */}
			<View className="flex-row items-center justify-between px-5 py-4">
				<View className="flex-row items-baseline gap-2">
					<Feather name="briefcase" size={17} color="#555" />
					<Text className="font-inter text-xs text-gray-200">{cabinLabel}</Text>
				</View>

				<View className="flex-row items-baseline gap-1">
					<Text className="font-inter text-xs text-gray-100">From</Text>

					<Text className="font-inter-semibold text-xl text-black">
						{flight.currency}
						{flight.price}
					</Text>
				</View>
			</View>

			{/* Check */}
			<Pressable
				onPress={onCheck}
				className="mx-5 mb-5 rounded-xl bg-primary py-3.5 items-center active:opacity-90"
			>
				<Text className="font-inter-medium text-base text-white">Check</Text>
			</Pressable>
		</View>
	)
}
