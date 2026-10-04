import { tripOptions } from "@/constants"
import { airports } from "@/lib/data"
import { Feather, FontAwesome5, MaterialIcons, Octicons } from "@expo/vector-icons"
import clsx from "clsx"
import { router, useLocalSearchParams } from "expo-router"
import { Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function Index() {
	const {
		tripType: tripTypeParam,
		departureDate,
		returnDate,
		fromAirport,
		toAirport,
	} = useLocalSearchParams<{
		tripType?: AppConfig.TripType
		departureDate?: string
		returnDate?: string
		fromAirport?: string
		toAirport?: string
	}>()

	const tripType = tripTypeParam ?? "one-way"

	const selectedFromAirport = airports.find((airport) => airport.code === fromAirport)
	const selectedToAirport = airports.find((airport) => airport.code === toAirport)

	const handleTripTypeChange = (type: AppConfig.TripType) => {
		router.setParams({
			tripType: type,
			returnDate: type === "one-way" ? "" : (returnDate ?? ""),
		})
	}

	const handleSelectAirport = (field: AppConfig.AirportField) => {
		router.push({
			pathname: "/airport-selection",
			params: {
				field,
				tripType,
				departureDate,
				returnDate,
				fromAirport,
				toAirport,
			},
		})
	}

	const handleSelectDate = () => {
		router.push({
			pathname: "/date-selection",
			params: {
				tripType,
				departureDate,
				returnDate,
				fromAirport,
				toAirport,
			},
		})
	}

	const handleSwapAirports = () => {
		if (!fromAirport || !toAirport) return

		router.setParams({
			fromAirport: toAirport,
			toAirport: fromAirport,
		})
	}

	const canSearch =
		tripType === "one-way"
			? !!departureDate
			: tripType === "round"
				? !!departureDate && !!returnDate
				: false

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row items-center justify-between px-6 py-4">
				<View className="w-6" />

				<Text className="font-inter-medium text-xl text-black">Book Flight</Text>

				<TouchableOpacity>
					<Feather name="menu" size={24} />
				</TouchableOpacity>
			</View>

			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerClassName="flex gap-8 px-8 pt-8 pb-28"
			>
				{/* Trip Type */}
				<View className="flex-row bg-white rounded-full mx-4 p-1 shadow">
					{tripOptions.map((trip) => (
						<TouchableOpacity
							key={trip.value}
							onPress={() => handleTripTypeChange(trip.value)}
							className={clsx(
								"flex-1 py-2.5 rounded-full items-center",
								tripType === trip.value && "bg-primary",
							)}
						>
							<Text
								className={clsx(
									"font-inter text-sm",
									tripType === trip.value ? "text-white" : "text-gray-100",
								)}
							>
								{trip.label}
							</Text>
						</TouchableOpacity>
					))}
				</View>

				{/* Booking Form */}
				{tripType !== "multi-city" ? (
					<View className="bg-white rounded-2xl px-4 py-6 gap-2 shadow">
						{/* Airport */}
						<View className="relative mb-4">
							{/* From */}
							<Pressable
								onPress={() => handleSelectAirport("from")}
								className="border border-border rounded-xl p-3 mb-6"
							>
								<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
									From
								</Text>

								<View className="flex-row items-center mt-1 gap-3">
									<FontAwesome5 name="plane-departure" size={16} color="#555" />
									<View className="flex-1">
										<View className="flex-row items-baseline gap-2">
											<Text className="font-inter-semibold text-base text-black">
												{selectedFromAirport?.city}
											</Text>
											<Text className="font-inter text-xs text-gray-200">
												{selectedFromAirport?.code}
											</Text>
										</View>
										<Text
											className="font-inter-light text-xs text-gray-100 mt-0.5"
											numberOfLines={1}
										>
											{selectedFromAirport?.name}
										</Text>
									</View>
								</View>
							</Pressable>

							<Pressable
								disabled={!fromAirport || !toAirport}
								onPress={handleSwapAirports}
								className={clsx(
									"absolute right-6 top-[50px] z-10 bg-white border border-border p-2 rounded-full",
									(!fromAirport || !toAirport) && "opacity-40",
								)}
							>
								<Octicons
									name="arrow-switch"
									size={24}
									color="#555"
									style={{ transform: [{ rotate: "90deg" }] }}
								/>
							</Pressable>

							{/* To */}
							<Pressable
								onPress={() => handleSelectAirport("to")}
								className="border border-border rounded-xl p-3 mb-2"
							>
								<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
									To
								</Text>

								<View className="flex-row items-center mt-1 gap-3">
									<FontAwesome5 name="plane-arrival" size={16} color="#555" />
									<View className="flex-1">
										<View className="flex-row items-baseline gap-2">
											<Text className="font-inter-semibold text-base text-black">
												{selectedToAirport?.city}
											</Text>
											<Text className="font-inter text-xs text-gray-200">
												{selectedToAirport?.code}
											</Text>
										</View>
										<Text
											className="font-inter-light text-xs text-gray-100 mt-0.5"
											numberOfLines={1}
										>
											{selectedToAirport?.name}
										</Text>
									</View>
								</View>
							</Pressable>
						</View>

						{/* Date */}
						<View className="flex-row gap-3 mb-4">
							{/* Departure */}
							<Pressable
								onPress={handleSelectDate}
								className={clsx(
									"border border-border rounded-xl p-3 relative",
									tripType === "one-way" ? "flex-1" : "flex-1 w-1/2 ",
								)}
							>
								<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
									Departure
								</Text>

								<View className="flex-row items-center mt-1 gap-3">
									<Feather name={departureDate ? "calendar" : "plus"} size={16} color="#555" />
									<Text
										className={clsx(
											"font-inter-medium text-sm",
											departureDate ? "text-black" : "text-gray-200",
										)}
									>
										{departureDate || "Add Departure Date"}
									</Text>
								</View>
							</Pressable>

							{/* Return */}
							{tripType === "round" && (
								<Pressable
									onPress={handleSelectDate}
									className="flex w-1/2 border border-border rounded-xl p-3 relative"
								>
									<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
										Return
									</Text>

									<View className="flex-row items-center mt-1 gap-3">
										<Feather name={returnDate ? "calendar" : "plus"} size={16} color="#555" />
										<Text
											className={clsx(
												"font-inter-medium text-sm",
												returnDate ? "text-black" : "text-gray-200",
											)}
										>
											{returnDate || "Add Return Date"}
										</Text>
									</View>
								</Pressable>
							)}
						</View>

						{/* Metadata (Passenger & Cabin Class) */}
						<View className="flex-row gap-3 mb-6">
							<View className="flex-1 w-1/2 border border-border rounded-xl p-3 relative">
								<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
									Traveller
								</Text>

								<View className="flex-row items-center mt-1">
									<Text className="font-inter-medium text-sm text-black">1 Adult</Text>
								</View>
							</View>

							<View className="flex w-1/2 border border-border rounded-xl p-3 relative">
								<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
									Class
								</Text>

								<View className="flex-row items-center mt-1 gap-3">
									<Text className="font-inter-medium text-sm text-black">Economy</Text>
								</View>
							</View>
						</View>

						{/* Submit */}
						<TouchableOpacity
							disabled={!canSearch}
							className={clsx(
								"w-full py-4 rounded-xl items-center",
								canSearch ? "bg-primary active:opacity-90" : "bg-gray-300",
							)}
						>
							<Text className="text-white font-inter-medium text-lg">Search</Text>
						</TouchableOpacity>
					</View>
				) : (
					<View className="bg-white rounded-2xl px-5 py-6 shadow">
						<Text className="font-inter-semibold text-base text-black">Multi City</Text>

						<Text className="font-inter text-sm text-gray-200 mt-2">
							Multi-city flight planning will be implemented next.
						</Text>
					</View>
				)}

				{/* Separator */}
				<View className="border-hairline border-border" />

				{/* Hot Offers */}
				<View>
					<View className="flex-row justify-between items-center mb-4">
						<Text className="font-inter-semibold text-lg text-black">Hot offer</Text>
						<TouchableOpacity>
							<Text className="font-inter-medium text-sm text-primary">See all</Text>
						</TouchableOpacity>
					</View>

					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerClassName="flex-row gap-4"
					>
						{/* Mastercard */}
						<View className="flex-row bg-white rounded-2xl p-4 h-[120px] w-[280px] items-center gap-1 shadow elevation-5">
							<View className="flex items-center justify-center border-r border-border w-1/4">
								<View className="flex-row">
									<View className="w-6 h-6 rounded-full bg-[#EB001B] z-10" />
									<View className="w-6 h-6 rounded-full bg-[#F59E0B] -ml-3" />
								</View>
								<Text className="font-inter-semibold text-[8px] text-black text-center mb-2">
									mastercard
								</Text>
								<Text className="font-inter-bold text-sm text-black text-center">15% OFF</Text>
							</View>

							<View className="flex-1 pl-4">
								<Text className="font-inter-semibold text-sm text-black leading-tight">
									15% discount with mastercard
								</Text>
								<Text className="font-inter-light text-xs text-gray-200 mt-1" numberOfLines={2}>
									Lorem ipsum dolor sit am etet adip
								</Text>
							</View>
						</View>

						{/* Visa */}
						<View className="flex-row bg-[#E6E1F2] rounded-2xl p-4 h-[120px] w-[280px] items-center gap-1 shadow elevation-5">
							<View className="flex items-center justify-center border-r border-blue-200 w-1/4">
								<View className="p-1 mb-2 border-y-2 border-t-[#1B2073] border-b-[#F7B802]">
									<Text className="font-inter-semibold text-xl text-[#1B2073] tracking-wider">
										VISA
									</Text>
								</View>

								<Text className="font-inter-bold text-sm text-black text-center">23% OFF</Text>
							</View>
							<View className="flex-1 pl-4">
								<Text className="font-inter-semibold text-sm text-black leading-tight">
									Exclusive Visa Flight Deals
								</Text>
								<Text className="font-inter-light text-xs text-gray-200 mt-1" numberOfLines={2}>
									Enjoy premium discount values today.
								</Text>
							</View>
						</View>
					</ScrollView>
				</View>
			</ScrollView>

			{/* Bottom navigation */}
			<View className="absolute bottom-0 left-0 right-0 bg-primary flex-row justify-around pt-3 pb-6 border-t border-primary/20">
				<TouchableOpacity className="items-center">
					<MaterialIcons name="home" size={24} color="#FFFFFF" />
					<Text className="font-inter-semibold text-xs text-white mt-1">Home</Text>
				</TouchableOpacity>
				<TouchableOpacity className="items-center opacity-70">
					<MaterialIcons name="assignment" size={24} color="#FFFFFF" />
					<Text className="font-inter text-xs text-white mt-1">Booking</Text>
				</TouchableOpacity>
				<TouchableOpacity className="items-center opacity-70">
					<Feather name="gift" size={23} color="#FFFFFF" />
					<Text className="font-inter text-xs text-white mt-1">Offer</Text>
				</TouchableOpacity>
				<TouchableOpacity className="items-center opacity-70">
					<MaterialIcons name="mail-outline" size={24} color="#FFFFFF" />
					<Text className="font-inter text-xs text-white mt-1">Inbox</Text>
				</TouchableOpacity>
				<TouchableOpacity className="items-center opacity-70">
					<Feather name="user" size={23} color="#FFFFFF" />
					<Text className="font-inter text-xs text-white mt-1">Profile</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
