import { Feather } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { getSeatMaps } from "@/lib/flights/api"
import { FlightSearchError, type FlightOffer, type FlightSeatMap, type SeatMapElement } from "@/lib/flights/types"
import { useFlightBookingStore } from "@/store/flight-booking.store"
import { useFlightOffersStore } from "@/store/flight-offers.store"
import { useFlightSearchStore } from "@/store/flight-search.store"

function formatSeatPrice(amount: string, currency: string) {
	const value = Number(amount)
	if (!Number.isFinite(value) || !currency) return "Price unavailable"
	if (value === 0) return "Included"
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			maximumFractionDigits: 2,
		}).format(value)
	} catch {
		return `${currency} ${value.toFixed(2)}`
	}
}

function segmentTitle(flight: FlightOffer | undefined, segmentId: string, index: number) {
	const segment = flight?.slices.flatMap((slice) => slice.segments).find((item) => item.id === segmentId)
	return segment
		? `${segment.departureAirportCode} → ${segment.arrivalAirportCode}`
		: `Flight segment ${index + 1}`
}

function collectPassengerIds(seatMaps: FlightSeatMap[]) {
	const ids: string[] = []
	for (const seatMap of seatMaps) {
		for (const cabin of seatMap.cabins) {
			for (const row of cabin.rows) {
				for (const section of row.sections) {
					for (const element of section.elements) {
						for (const service of element.availableServices) {
							if (!ids.includes(service.passengerId)) ids.push(service.passengerId)
						}
					}
				}
			}
		}
	}
	return ids
}

function SeatElement({
	element,
	segmentId,
	activePassengerId,
	selected,
	occupiedByOtherPassenger,
	onPress,
}: {
	element: SeatMapElement
	segmentId: string
	activePassengerId: string
	selected: boolean
	occupiedByOtherPassenger: boolean
	onPress: (element: SeatMapElement, segmentId: string, passengerId: string) => void
}) {
	if (element.type !== "seat" || !element.designator) {
		const labels: Record<string, string> = {
			exit_row: "Exit row",
			lavatory: "Lavatory",
			galley: "Galley",
			bassinet: "Bassinet",
		}
		const label = labels[element.type]
		if (!label) return <View className="h-10 min-w-5 flex-1" />
		return (
			<View className="mx-1 h-10 min-w-10 items-center justify-center rounded-md bg-gray-100 px-1">
				<Text className="text-center font-inter text-[9px] text-gray-200">{label}</Text>
			</View>
		)
	}

	const service = element.availableServices.find((item) => item.passengerId === activePassengerId)
	const unavailable = !service || occupiedByOtherPassenger
	return (
		<Pressable
			disabled={unavailable}
			onPress={() => onPress(element, segmentId, activePassengerId)}
			accessibilityRole="button"
			accessibilityLabel={
				unavailable
					? `Seat ${element.designator} unavailable for this traveller`
					: `Seat ${element.designator}, ${formatSeatPrice(service.totalAmount, service.totalCurrency)}`
			}
			className={[
				"m-0.5 h-10 w-10 items-center justify-center rounded-md border",
				selected ? "border-primary bg-primary" : unavailable ? "border-gray-200 bg-gray-200" : "border-gray-300 bg-white",
			].join(" ")}
		>
			<Text className={["font-inter-semibold text-xs", selected ? "text-white" : unavailable ? "text-gray-400" : "text-black"].join(" ")}>
				{element.designator}
			</Text>
		</Pressable>
	)
}

export default function ChooseSeatScreen() {
	const { flightId } = useLocalSearchParams<{ flightId?: string }>()
	const flight = useFlightOffersStore((state) => state.offers.find((item) => item.id === flightId))
	const passengers = useFlightSearchStore((state) => state.passengers)
	const selectedSeats = useFlightBookingStore((state) => state.selectedOutboundSeatServices)
	const selectSeat = useFlightBookingStore((state) => state.selectOutboundSeatService)
	const clearSeats = useFlightBookingStore((state) => state.clearOutboundSeatServices)

	const [seatMaps, setSeatMaps] = useState<FlightSeatMap[]>([])
	const [loading, setLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [activePassengerId, setActivePassengerId] = useState<string | null>(null)

	useEffect(() => {
		let active = true
		clearSeats()
		setSeatMaps([])
		setErrorMessage(null)
		setLoading(true)

		if (!flightId || !flight) {
			setErrorMessage("This flight is no longer available. Go back and select a flight again.")
			setLoading(false)
			return () => {
				active = false
			}
		}

		void getSeatMaps(flightId)
			.then((result) => {
				if (!active) return
				setSeatMaps(result.seatMaps)
				const passengerIds = collectPassengerIds(result.seatMaps)
				setActivePassengerId(passengerIds[0] ?? null)
			})
			.catch((cause) => {
				if (!active) return
				setErrorMessage(
					cause instanceof FlightSearchError
						? cause.message
						: "We couldn't load seat maps for this flight.",
				)
			})
			.finally(() => {
				if (active) setLoading(false)
			})

		return () => {
			active = false
		}
	}, [flightId, flight?.id, clearSeats])

	const passengerIds = useMemo(() => collectPassengerIds(seatMaps), [seatMaps])
	const passengerLabels = useMemo(() => {
		const labels = [
			...Array.from({ length: passengers.adults }, (_, index) => `Adult ${index + 1}`),
			...Array.from({ length: passengers.children }, (_, index) => `Child ${index + 1}`),
			...Array.from({ length: passengers.infants }, (_, index) => `Infant ${index + 1}`),
		]
		return passengerIds.map((id, index) => ({ id, label: labels[index] ?? `Traveller ${index + 1}` }))
	}, [passengerIds, passengers.adults, passengers.children, passengers.infants])

	const handleSeatPress = (element: SeatMapElement, segmentId: string, passengerId: string) => {
		const service = element.availableServices.find((item) => item.passengerId === passengerId)
		if (!service || !element.designator) return
		selectSeat({
			...service,
			segmentId,
			seatDesignator: element.designator,
		})
	}

	const handleContinue = () => router.push("/personal-information-2")

	return (
		<SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
			<View className="flex-row items-center px-6 py-4">
				<Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center" hitSlop={8}>
					<Feather name="chevron-left" size={28} color="#191919" />
				</Pressable>
				<Text className="mr-6 flex-1 text-center font-inter-medium text-xl text-black">Choose Seat</Text>
			</View>

			<View className="mb-4 flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4">
				<LegendItem color="bg-white border border-gray-300" label="Available" />
				<LegendItem color="bg-primary" label="Selected" />
				<LegendItem color="bg-gray-200" label="Unavailable" />
			</View>

			{loading ? (
				<View className="flex-1 items-center justify-center px-8">
					<ActivityIndicator size="large" color="#EC441E" />
					<Text className="mt-4 text-center font-inter-medium text-base text-black">Loading airline seat maps…</Text>
					<Text className="mt-2 text-center font-inter text-sm text-gray-200">Seat maps are not provided for every flight.</Text>
				</View>
			) : (
				<ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pb-6">
					{errorMessage ? (
						<View className="rounded-xl border border-border bg-white p-4">
							<Text className="font-inter-semibold text-base text-black">Seat maps unavailable</Text>
							<Text className="mt-2 font-inter text-sm leading-5 text-gray-200">{errorMessage}</Text>
							<Text className="mt-2 font-inter text-sm leading-5 text-gray-200">You can continue without choosing seats.</Text>
						</View>
					) : seatMaps.length === 0 ? (
						<View className="rounded-xl border border-border bg-white p-5">
							<Text className="font-inter-semibold text-base text-black">Seat selection isn't available for this flight</Text>
							<Text className="mt-2 font-inter text-sm leading-5 text-gray-200">
								The airline hasn't supplied a seat map for this offer. You can continue; this doesn't mean the flight itself is unavailable.
							</Text>
						</View>
					) : (
						<>
							<Text className="mb-3 text-center font-inter text-sm leading-5 text-gray-200">
								Choose a traveller, then select an available seat. Seat selection is optional and may have an additional cost.
							</Text>
							{passengerLabels.length === 0 && (
								<View className="mb-4 rounded-lg bg-gray-100 p-3">
									<Text className="font-inter text-sm leading-5 text-gray-200">
										The airline supplied a cabin layout but no selectable seat services for this offer. You can continue without choosing seats.
									</Text>
								</View>
							)}
							{passengerLabels.length > 0 && (
								<ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
									<View className="flex-row gap-2">
										{passengerLabels.map((passenger) => (
											<Pressable
												key={passenger.id}
												onPress={() => setActivePassengerId(passenger.id)}
												className={[
													"rounded-full border px-4 py-2",
													activePassengerId === passenger.id ? "border-primary bg-primary" : "border-border bg-white",
												].join(" ")}
											>
												<Text className={["font-inter-medium text-sm", activePassengerId === passenger.id ? "text-white" : "text-black"].join(" ")}>
													{passenger.label}
												</Text>
											</Pressable>
										))}
									</View>
								</ScrollView>
							)}
							{seatMaps.map((seatMap, mapIndex) => (
								<View key={seatMap.id || seatMap.segmentId || mapIndex} className="mb-5 rounded-2xl border border-border bg-white p-3">
									<Text className="mb-4 font-inter-semibold text-base text-black">
										{segmentTitle(flight, seatMap.segmentId, mapIndex)}
									</Text>
									{seatMap.cabins.length === 0 ? (
										<Text className="font-inter text-sm text-gray-200">No cabin layout was supplied for this segment.</Text>
									) : seatMap.cabins.map((cabin, cabinIndex) => (
										<View key={cabin.id || `${seatMap.id}-cabin-${cabinIndex}`} className="mb-4">
											<Text className="mb-3 font-inter-medium text-sm text-gray-200">
												{seatMap.cabins.length > 1 ? `Cabin ${cabinIndex + 1}` : "Aircraft cabin"}
												{cabin.deck > 0 ? ` · Deck ${cabin.deck + 1}` : ""}
											</Text>
											<ScrollView horizontal showsHorizontalScrollIndicator={false}>
												<View className="gap-2 px-1">
													{cabin.rows.map((row) => (
														<View key={row.index} className="flex-row items-center gap-3">
															{row.sections.map((section, sectionIndex) => (
																<View key={sectionIndex} className="flex-row items-center gap-0.5">
																	{section.elements.map((element, elementIndex) => {
																		const service = element.availableServices.find((item) => item.passengerId === activePassengerId)
																		const selected = Boolean(service && selectedSeats.some(
																			(item) => item.segmentId === seatMap.segmentId && item.passengerId === activePassengerId && item.id === service.id,
																		))
																		const occupiedByOtherPassenger = Boolean(element.designator && selectedSeats.some(
																			(item) => item.segmentId === seatMap.segmentId && item.seatDesignator === element.designator && item.passengerId !== activePassengerId,
																		))
																		return (
																			<SeatElement
																				key={element.designator ?? `${element.type}-${row.index}-${sectionIndex}-${elementIndex}`}
																				element={element}
																				segmentId={seatMap.segmentId}
																				activePassengerId={activePassengerId ?? ""}
																				selected={selected}
																				occupiedByOtherPassenger={occupiedByOtherPassenger}
																				onPress={handleSeatPress}
																			/>
																		)
																	})}
																</View>
															))}
														</View>
													))}
												</View>
											</ScrollView>
										</View>
									))}
								</View>
							))}
						</>
					)}

					{selectedSeats.length > 0 && (
						<View className="rounded-xl border border-border bg-white p-4">
							<Text className="font-inter-semibold text-base text-black">Selected seats</Text>
							{selectedSeats.map((seat) => (
								<View key={seat.id} className="mt-2 flex-row items-center justify-between gap-3">
									<Text className="flex-1 font-inter text-sm text-black">
										{passengerLabels.find((passenger) => passenger.id === seat.passengerId)?.label ?? "Traveller"} · {segmentTitle(flight, seat.segmentId, 0)} · {seat.seatDesignator}
									</Text>
									<Text className="font-inter-medium text-sm text-black">{formatSeatPrice(seat.totalAmount, seat.totalCurrency)}</Text>
								</View>
							))}
						</View>
					)}
				</ScrollView>
			)}

			<View className="px-5 pb-5 pt-3">
				<Pressable onPress={handleContinue} className="w-full items-center rounded-2xl bg-primary py-4 active:opacity-90">
					<Text className="font-inter-semibold text-base text-white">Continue</Text>
				</Pressable>
				<Text className="mt-2 text-center font-inter text-xs text-gray-200">You can continue without selecting a seat.</Text>
			</View>
		</SafeAreaView>
	)
}

function LegendItem({ color, label }: { color: string; label: string }) {
	return (
		<View className="flex-row items-center gap-2">
			<View className={`h-3 w-3 rounded-sm ${color}`} />
			<Text className="font-inter text-xs text-gray-200">{label}</Text>
		</View>
	)
}
