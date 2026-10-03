import { Feather, FontAwesome6, MaterialIcons, Octicons } from "@expo/vector-icons"
import clsx from "clsx"
import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

type TripType = "one-way" | "round" | "multi-city"

const TRIP_OPTIONS: { value: TripType; label: string }[] = [
	{ value: "one-way", label: "One Way" },
	{ value: "round", label: "Round" },
	{ value: "multi-city", label: "Multi City" },
]

export default function Index() {
	const { departureDate, returnDate } = useLocalSearchParams<{
		departureDate?: string
		returnDate?: string
	}>()

	const [tripType, setTripType] = useState<TripType>("one-way")

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
					{TRIP_OPTIONS.map((trip) => (
						<TouchableOpacity
							key={trip.value}
							onPress={() => setTripType(trip.value)}
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
				<View className="bg-white rounded-2xl px-4 py-6 gap-2 shadow">
					{/* Location */}
					<View className="relative mb-4">
						{/* From */}
						<View className="border border-border rounded-xl p-3 mb-6">
							<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
								From
							</Text>

							<View className="flex-row items-center mt-1 gap-3">
								<FontAwesome6 name="plane-departure" size={16} color="#555" />
								<View className="flex-1">
									<View className="flex-row items-baseline gap-2">
										<Text className="font-inter-semibold text-base text-black">Delhi</Text>
										<Text className="font-inter text-xs text-gray-200">DEL</Text>
									</View>
									<Text className="font-inter-light text-xs text-gray-100 mt-0.5" numberOfLines={1}>
										Indira Gandhi International Airport
									</Text>
								</View>
							</View>
						</View>

						<Pressable className="absolute right-6 top-[50px] z-10 bg-white border border-border p-2 rounded-full">
							<Octicons
								name="arrow-switch"
								size={24}
								color="#555"
								style={{ transform: [{ rotate: "90deg" }] }}
							/>
						</Pressable>

						{/* To */}
						<View className="border border-border rounded-xl p-3 mb-2">
							<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
								To
							</Text>

							<View className="flex-row items-center mt-1 gap-3">
								<FontAwesome6 name="plane-arrival" size={16} color="#555" />
								<View className="flex-1">
									<View className="flex-row items-baseline gap-2">
										<Text className="font-inter-semibold text-base text-black">Kolkata</Text>
										<Text className="font-inter text-xs text-gray-200">CCU</Text>
									</View>
									<Text className="font-inter-light text-xs text-gray-100 mt-0.5" numberOfLines={1}>
										Subhash Chandra International Airport
									</Text>
								</View>
							</View>
						</View>
					</View>

					{/* Date */}
					<View className="flex-row gap-3 mb-4">
						<Pressable
							onPress={() => router.push("/departure-date")}
							className="flex-1 w-1/2 border border-border rounded-xl p-3 relative"
						>
							<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
								Departure
							</Text>

							<View className="flex-row items-center mt-1 gap-3">
								<Feather name={departureDate ? "calendar" : "plus"} size={16} color="#555" />
								<Text className="font-inter-medium text-sm text-black">
									{departureDate ?? "Add Departure Date"}
								</Text>
							</View>
						</Pressable>

						<Pressable
							onPress={() => router.push("/return-date")}
							className="flex w-1/2 border border-border rounded-xl p-3 relative"
						>
							<Text className="absolute -top-2.5 left-4 bg-white px-1 text-xs font-inter-light text-gray-200">
								Return
							</Text>

							<View className="flex-row items-center mt-1 gap-3">
								<Feather name={returnDate ? "calendar" : "plus"} size={16} color="#555" />
								<Text className="font-inter-medium text-sm text-gray-200">
									{returnDate ?? "Add Return Date"}
								</Text>
							</View>
						</Pressable>
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
					<TouchableOpacity className="bg-primary w-full py-4 rounded-xl items-center">
						<Text className="text-white font-inter-medium text-lg">Search</Text>
					</TouchableOpacity>
				</View>

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
