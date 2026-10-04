import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"
import { FlatList, Pressable, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { airports } from "@/lib/data"
import clsx from "clsx"

export default function AirportSelectionScreen() {
	const { field, tripType, departureDate, returnDate, fromAirport, toAirport } =
		useLocalSearchParams<{
			field?: AppConfig.AirportField
			tripType?: string
			departureDate?: string
			returnDate?: string
			fromAirport?: string
			toAirport?: string
		}>()

	const [search, setSearch] = useState("")

	const isDeparture = field === "from"

	const title = isDeparture ? "Select Departure Airport" : "Select Arrival Airport"

	const filteredAirports = useMemo(() => {
		const query = search.trim().toLocaleLowerCase()

		if (!query) return airports

		return airports.filter((airport) =>
			[airport.code, airport.city, airport.name, airport.country].some((value) =>
				value.toLowerCase().includes(query),
			),
		)
	}, [search])

	const handleSelectAirport = (airport: AppConfig.Airport) => {
		router.replace({
			pathname: "/",
			params: {
				tripType,
				departureDate,
				returnDate,
				...(isDeparture
					? { fromAirport: airport.code, toAirport }
					: { toAirport: airport.code, fromAirport }),
			},
		})
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row items-center px-6 py-4">
				<Pressable onPress={() => router.back()} className="p-1 -ml-1">
					<Ionicons name="chevron-back" size={24} color="#191919" />
				</Pressable>
				<Text className="flex-1 text-center font-inter-bold text-xl text-black mr-6">{title}</Text>
			</View>

			{/* Search */}
			<View className="px-5 pb-5 mb-4">
				<View className="flex-row items-center border border-border bg-white rounded-xl px-4 h-12">
					<Feather name="search" size={18} color="#777" />

					<TextInput
						value={search}
						onChangeText={setSearch}
						placeholder="Search airport or city"
						placeholderTextColor="#999"
						autoCapitalize="none"
						autoCorrect={false}
						className="flex-1 ml-3 font-inter text-sm text-black"
					/>

					{search.length > 0 && (
						<Pressable onPress={() => setSearch("")}>
							<Feather name="x-circle" size={18} color="#777" />
						</Pressable>
					)}
				</View>
			</View>

			{/* Results */}
			<FlatList
				data={filteredAirports}
				keyExtractor={(airport) => airport.code}
				showsVerticalScrollIndicator={false}
				contentContainerClassName="px-5 pb-8"
				keyboardShouldPersistTaps="handled"
				ListHeaderComponent={
					<Text className="font-inter-semibold text-lg text-black mb-3">
						{search.trim() ? "Search Results" : "Popular Airports"}
					</Text>
				}
				ListEmptyComponent={
					<View className="items-center pt-16 px-8">
						<View className="h-14 w-14 rounded-full bg-gray-100 items-center justify-center mb-4">
							<Feather name="search" size={22} color="#777" />
						</View>

						<Text className="font-inter-semibold text-base text-black text-center">
							No airports found
						</Text>

						<Text className="font-inter text-sm text-gray-200 text-center mt-2">
							Try searching by city, airport name, or airport code.
						</Text>
					</View>
				}
				renderItem={({ item }) => {
					const isAlreadySelected =
						(isDeparture && item.code === toAirport) || (!isDeparture && item.code === fromAirport)

					return (
						<Pressable
							disabled={isAlreadySelected}
							onPress={() => handleSelectAirport(item)}
							className={clsx(
								"bg-white border border-border rounded-xl p-4 mb-3",
								isAlreadySelected ? "opacity-40" : "active:opacity-70",
							)}
						>
							<View className="flex-row items-center gap-2">
								<View className="h-10 w-10 p-1 rounded-xl bg-primary/10 items-center justify-center">
									<MaterialCommunityIcons name="airport" size={18} color="#EC441E" />
									<Text className="font-inter-bold text-xs text-primary">{item.code}</Text>
								</View>

								<View className="flex-1 gap-1">
									<View className="flex-row items-center gap-1">
										<Text className="font-inter-semibold text-base text-black">{item.city}</Text>
										<Text className="font-inter text-xs text-gray-100 mt-1">{item.country}</Text>
									</View>

									<Text className="font-inter text-xs text-gray-200" numberOfLines={2}>
										{item.name}
									</Text>

									{isAlreadySelected && (
										<Text className="font-inter-medium text-xs text-primary mt-1">
											Already selected as the other airport
										</Text>
									)}
								</View>

								{!isAlreadySelected && <Ionicons name="chevron-forward" size={18} color="#999" />}
							</View>
						</Pressable>
					)
				}}
			/>
		</SafeAreaView>
	)
}
