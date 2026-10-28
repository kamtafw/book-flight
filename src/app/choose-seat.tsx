import { Feather } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { getSeatMaps } from "@/lib/flights/api"
import {
	FlightSearchError,
	type FlightOffer,
	type FlightSeatMap,
	type SeatMapElement,
	type SelectedSeatService,
} from "@/lib/flights/types"
import { useFlightBookingStore } from "@/store/flight-booking.store"
import { useFlightOffersStore } from "@/store/flight-offers.store"
import { useFlightSearchStore } from "@/store/flight-search.store"

const BRAND = "#EC441E"
const INK = "#191919"
const MUTED = "#737373"
const BORDER = "#E7E5E4"

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

function formatSeatPriceCompact(amount: string, currency: string) {
	const value = Number(amount)
	if (!Number.isFinite(value) || !currency) return "—"
	if (value === 0) return "Free"
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			currencyDisplay: "narrowSymbol",
			maximumFractionDigits: 0,
		}).format(value)
	} catch {
		return `${currency} ${Math.round(value)}`
	}
}

function segmentTitle(flight: FlightOffer | undefined, segmentId: string, index: number) {
	const segment = flight?.slices.flatMap((slice) => slice.segments).find((item) => item.id === segmentId)
	return segment
		? `${segment.departureAirportCode} → ${segment.arrivalAirportCode}`
		: `Flight segment ${index + 1}`
}

function requiresAdult(disclosures: string[]) {
	return disclosures.some((disclosure) =>
		/\b(passenger|traveller|traveler)s? must be an adult\b|\badults only\b|\badult passengers only\b/i.test(disclosure),
	)
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

function LegendItem({
	kind,
	label,
}: {
	kind: "available" | "selected" | "unavailable"
	label: string
}) {
	return (
		<View className="flex-row items-center gap-2">
			<View
				className={[
					"h-4 w-4 rounded-[5px] border",
					kind === "available"
						? "border-stone-300 bg-white"
						: kind === "selected"
							? "border-primary bg-primary"
							: "border-stone-600 bg-stone-600",
				].join(" ")}
			>
				{kind === "selected" && (
					<Feather name="check" size={10} color="#FFFFFF" style={{ alignSelf: "center" }} />
				)}
			</View>
			<Text className="font-inter text-xs text-stone-600">{label}</Text>
		</View>
	)
}

function SeatElement({
	element,
	segmentId,
	activePassengerId,
	selected,
	occupiedByOtherPassenger,
	adultRestricted,
	onPress,
}: {
	element: SeatMapElement
	segmentId: string
	activePassengerId: string
	selected: boolean
	occupiedByOtherPassenger: boolean
	adultRestricted: boolean
	onPress: (element: SeatMapElement, segmentId: string, passengerId: string) => void
}) {
	if (element.type !== "seat" || !element.designator) {
		const iconByType: Record<string, keyof typeof Feather.glyphMap> = {
			exit_row: "log-out",
			lavatory: "droplet",
			galley: "coffee",
			bassinet: "heart",
		}
		const labelByType: Record<string, string> = {
			exit_row: "EXIT",
			lavatory: "WC",
			galley: "GALLEY",
			bassinet: "BASSINET",
		}
		const icon = iconByType[element.type]
		if (!icon) return <View className="h-11 w-10" />
		return (
			<View className="h-11 w-10 items-center justify-center gap-1 rounded-lg bg-stone-100">
				<Feather name={icon} size={13} color="#A8A29E" />
				<Text className="text-[7px] font-semibold tracking-tight text-stone-500">
					{labelByType[element.type]}
				</Text>
			</View>
		)
	}

	const service = element.availableServices.find((item) => item.passengerId === activePassengerId)
	const unavailable = !service || occupiedByOtherPassenger || adultRestricted

	return (
		<Pressable
			disabled={unavailable}
			onPress={() => onPress(element, segmentId, activePassengerId)}
			accessibilityRole="button"
			accessibilityState={{ disabled: unavailable, selected }}
			accessibilityLabel={
				service && !unavailable
					? `Seat ${element.designator}, ${formatSeatPrice(service.totalAmount, service.totalCurrency)}${selected ? ", selected" : ""}`
					: adultRestricted
					? `Seat ${element.designator} is restricted to adult passengers`
					: `Seat ${element.designator} unavailable for this traveller`
			}
			className={[
				"h-[46px] w-[42px] items-center justify-center rounded-[10px] border",
				selected
					? "border-primary bg-primary"
					: unavailable
						? "border-stone-600 bg-stone-600"
						: "border-stone-200 bg-white",
			].join(" ")}
			style={
				selected
					? { shadowColor: BRAND, shadowOpacity: 0.22, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
					: undefined
			}
		>
			{selected ? (
				<Feather name="check" size={13} color="#FFFFFF" />
			) : (
				<Text
					numberOfLines={1}
					className={[
						"font-inter-semibold text-[10px]",
						unavailable ? "text-stone-300" : "text-stone-800",
					].join(" ")}
				>
					{element.designator}
				</Text>
			)}
			{service && !unavailable && (
				<Text
					numberOfLines={1}
					className={["mt-0.5 font-inter text-[8px]", selected ? "text-white" : "text-stone-500"].join(" ")}
				>
					{formatSeatPriceCompact(service.totalAmount, service.totalCurrency)}
				</Text>
			)}
		</Pressable>
	)
}

function EmptyState({
	icon,
	title,
	description,
}: {
	icon: keyof typeof Feather.glyphMap
	title: string
	description: string
}) {
	return (
		<View className="items-center rounded-3xl border border-stone-200 bg-white px-6 py-8">
			<View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-orange-50">
				<Feather name={icon} size={25} color={BRAND} />
			</View>
			<Text className="text-center font-inter-semibold text-base text-stone-900">{title}</Text>
			<Text className="mt-2 text-center font-inter text-sm leading-5 text-stone-500">{description}</Text>
		</View>
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
				setActivePassengerId(collectPassengerIds(result.seatMaps)[0] ?? null)
			})
			.catch((cause) => {
				if (!active) return
				setErrorMessage(
					cause instanceof FlightSearchError ? cause.message : "We couldn't load seat maps for this flight.",
				)
			})
			.finally(() => {
				if (active) setLoading(false)
			})

		return () => {
			active = false
		}
	}, [flightId, flight?.id, clearSeats])

	const passengerIds = useMemo(
		() => (flight?.passengers?.length ? flight.passengers.map((passenger) => passenger.id) : collectPassengerIds(seatMaps)),
		[flight?.passengers, seatMaps],
	)
	const passengerLabels = useMemo(() => {
		const labels = [
			...Array.from({ length: passengers.adults }, (_, index) => ({
				label: `Adult ${index + 1}`,
				isAdult: true,
			})),
			...Array.from({ length: passengers.children }, (_, index) => ({
				label: `Child ${index + 1}`,
				isAdult: false,
			})),
			...Array.from({ length: passengers.infants }, (_, index) => ({
				label: `Infant ${index + 1}`,
				isAdult: false,
			})),
		]
		return passengerIds.map((id, index) => {
			const providerPassenger = flight?.passengers?.find((passenger) => passenger.id === id)
			const isAdult = providerPassenger?.age != null
				? providerPassenger.age >= 12
				: providerPassenger?.type === "adult"
			return {
				id,
				label: labels[index]?.label ?? `Traveller ${index + 1}`,
				// Unknown provider identity must not bypass an explicit adult-only disclosure.
				isAdult: providerPassenger ? isAdult : false,
			}
		})
	}, [flight?.passengers, passengerIds, passengers.adults, passengers.children, passengers.infants])

	const selectedTotal = useMemo(() => {
		if (selectedSeats.length === 0) return null
		const currencies = new Set(selectedSeats.map((seat) => seat.totalCurrency))
		if (currencies.size !== 1) return null
		const amount = selectedSeats.reduce((total, seat) => total + Number(seat.totalAmount), 0)
		if (!Number.isFinite(amount)) return null
		return formatSeatPrice(String(amount), selectedSeats[0].totalCurrency)
	}, [selectedSeats])

	const handleSeatPress = (element: SeatMapElement, segmentId: string, passengerId: string) => {
		const service = element.availableServices.find((item) => item.passengerId === passengerId)
		if (!service || !element.designator) return
		selectSeat({
			...service,
			segmentId,
			seatDesignator: element.designator,
			seatName: element.name,
			disclosures: element.disclosures,
		})
	}

	const handleContinue = () => router.push("/personal-information-2")

	return (
		<SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-[#FFF9F6]">
			<View className="flex-row items-center px-5 pb-3 pt-2">
				<Pressable
					onPress={() => router.back()}
					accessibilityRole="button"
					accessibilityLabel="Go back"
					className="h-11 w-11 items-center justify-center rounded-full bg-white"
					style={{ borderWidth: 1, borderColor: BORDER }}
					hitSlop={8}
				>
					<Feather name="chevron-left" size={25} color={INK} />
				</Pressable>
				<View className="flex-1 items-center pr-11">
					<Text className="font-inter-semibold text-lg text-stone-900">Choose your seat</Text>
					<Text className="mt-0.5 font-inter text-xs text-stone-500">Make the journey yours</Text>
				</View>
			</View>

			{loading ? (
				<View className="flex-1 items-center justify-center px-8">
					<View className="h-16 w-16 items-center justify-center rounded-3xl bg-orange-50">
						<ActivityIndicator size="large" color={BRAND} />
					</View>
					<Text className="mt-4 text-center font-inter-semibold text-base text-stone-900">
						Finding your cabin
					</Text>
					<Text className="mt-2 text-center font-inter text-sm leading-5 text-stone-500">
						Checking the airline's latest seat availability and prices.
					</Text>
				</View>
			) : (
				<ScrollView
					className="flex-1"
					showsVerticalScrollIndicator={false}
					contentContainerClassName="px-4 pb-5"
				>
					{flight && (
						<View className="mb-4 flex-row items-center rounded-2xl border border-stone-200 bg-white px-4 py-3">
							<View className="h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
								<Feather name="send" size={18} color={BRAND} />
							</View>
							<View className="ml-3 flex-1">
								<Text className="font-inter-semibold text-sm text-stone-900">
									{flight.slices[0]?.originCode ?? "Departure"} → {flight.slices[0]?.destinationCode ?? "Arrival"}
								</Text>
								<Text className="mt-1 font-inter text-xs text-stone-500">
									{flight.airline} · {flight.flightNumber}
								</Text>
							</View>
							<View className="rounded-full bg-stone-100 px-2.5 py-1">
								<Text className="font-inter-medium text-[10px] text-stone-600">OPTIONAL</Text>
							</View>
						</View>
					)}

					{errorMessage ? (
						<EmptyState
							icon="map"
							title="Seat maps unavailable"
							description={`${errorMessage} You can still continue without choosing seats.`}
						/>
					) : seatMaps.length === 0 ? (
						<EmptyState
							icon="grid"
							title="No seat map for this flight"
							description="The airline hasn't supplied a seat map for this offer. Your flight is still available, and you can continue without selecting seats."
						/>
					) : (
						<>
							<View className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
								<View className="flex-row items-start gap-2">
									<Feather name="info" size={16} color={BRAND} style={{ marginTop: 2 }} />
									<Text className="flex-1 font-inter text-xs leading-[18px] text-stone-600">
										Choose a traveller, then tap an available seat. Some seats have an additional cost; selection is not confirmed until booking.
									</Text>
								</View>
							</View>

							<View className="mb-4 flex-row flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-2xl border border-stone-200 bg-white px-3 py-3">
								<LegendItem kind="available" label="Available" />
								<LegendItem kind="selected" label="Your pick" />
								<LegendItem kind="unavailable" label="Unavailable" />
							</View>

							{passengerLabels.length > 0 ? (
								<View className="mb-5">
									<Text className="mb-2 ml-1 font-inter-semibold text-sm text-stone-900">
										Who is this seat for?
									</Text>
									<ScrollView horizontal showsHorizontalScrollIndicator={false}>
										<View className="flex-row gap-2 pr-2">
											{passengerLabels.map((passenger, index) => {
												const active = activePassengerId === passenger.id
												const chosen = selectedSeats.some((seat) => seat.passengerId === passenger.id)
												return (
													<Pressable
														key={passenger.id}
														onPress={() => setActivePassengerId(passenger.id)}
														accessibilityRole="button"
														accessibilityState={{ selected: active }}
														className={[
															"min-w-[108px] flex-row items-center gap-2 rounded-2xl border px-3 py-3",
															active ? "border-primary bg-primary" : "border-stone-200 bg-white",
														].join(" ")}
													>
														<View
															className={[
																"h-8 w-8 items-center justify-center rounded-full",
																active ? "bg-white/20" : "bg-orange-50",
															].join(" ")}
														>
															<Feather
																name={passenger.label.startsWith("Infant") ? "heart" : "user"}
																size={15}
																color={active ? "#FFFFFF" : BRAND}
															/>
														</View>
														<View>
															<Text className={["font-inter-medium text-xs", active ? "text-white" : "text-stone-800"].join(" ")}>
																{passenger.label}
															</Text>
															<Text className={["mt-0.5 font-inter text-[10px]", active ? "text-white/80" : "text-stone-500"].join(" ")}>
																{chosen ? "Seat picked" : index === 0 ? "Main traveller" : "No seat yet"}
															</Text>
														</View>
													</Pressable>
												)
											})}
										</View>
									</ScrollView>
								</View>
							) : (
								<View className="mb-4 rounded-2xl bg-white p-4">
									<Text className="font-inter text-sm leading-5 text-stone-600">
										The airline supplied a cabin layout but no selectable seat services for this offer. You can continue without choosing seats.
									</Text>
								</View>
							)}

							{seatMaps.map((seatMap, mapIndex) => (
								<View
									key={seatMap.id || seatMap.segmentId || mapIndex}
									className="mb-5 overflow-hidden rounded-[28px] border border-stone-200 bg-white"
								>
									<View className="flex-row items-center justify-between border-b border-stone-100 px-4 py-4">
										<View>
											<Text className="font-inter-semibold text-base text-stone-900">
												{segmentTitle(flight, seatMap.segmentId, mapIndex)}
											</Text>
											<Text className="mt-1 font-inter text-xs text-stone-500">
												{seatMap.cabins.reduce((count, cabin) => count + cabin.rows.length, 0)} rows · Tap to select
											</Text>
										</View>
										<View className="h-10 w-10 items-center justify-center rounded-full bg-stone-100">
											<Feather name="wind" size={18} color={MUTED} />
										</View>
									</View>

									{seatMap.cabins.length === 0 ? (
										<Text className="px-4 py-5 font-inter text-sm text-stone-500">
											No cabin layout was supplied for this segment.
										</Text>
									) : (
										seatMap.cabins.map((cabin, cabinIndex) => (
											<View key={cabin.id || `${seatMap.id}-cabin-${cabinIndex}`} className="px-3 pb-5 pt-3">
												{(seatMap.cabins.length > 1 || cabin.deck > 0) && (
													<Text className="mb-3 text-center font-inter-medium text-xs text-stone-500">
														{seatMap.cabins.length > 1 ? `Cabin ${cabinIndex + 1}` : "Aircraft cabin"}
														{cabin.deck > 0 ? ` · Deck ${cabin.deck + 1}` : ""}
													</Text>
												)}

												<View className="mb-3 items-center">
													<View className="h-8 w-16 items-center justify-center rounded-t-[24px] border border-b-0 border-stone-200 bg-stone-50">
														<Feather name="send" size={15} color="#A8A29E" />
													</View>
													<Text className="mt-1 text-[9px] font-inter-medium tracking-[2px] text-stone-400">
														FRONT OF AIRCRAFT
													</Text>
												</View>

												<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "flex-start", paddingHorizontal: 2, paddingBottom: 4 }}>
													<View className="gap-2">
														{cabin.rows.map((row) => (
															<View key={row.index} className="flex-row items-center gap-2">
																<View className="w-6 items-center">
																	<Text className="font-inter-medium text-[10px] text-stone-400">{row.index}</Text>
																</View>
																{row.sections.map((section, sectionIndex) => (
																	<View
																		key={sectionIndex}
																		className={[
																			"flex-row items-center gap-1",
																			sectionIndex > 0 ? "ml-2 border-l border-dashed border-stone-200 pl-2" : "",
																		].join(" ")}
																	>
																		{section.elements.map((element, elementIndex) => {
																			const service = element.availableServices.find((item) => item.passengerId === activePassengerId)
																			const selected = Boolean(
																				service &&
																					selectedSeats.some(
																						(item) =>
																							item.segmentId === seatMap.segmentId &&
																							item.passengerId === activePassengerId &&
																							item.id === service.id,
																					),
																			)
																			const occupiedByOtherPassenger = Boolean(
																				element.designator &&
																					selectedSeats.some(
																						(item) =>
																							item.segmentId === seatMap.segmentId &&
																							item.seatDesignator === element.designator &&
																							item.passengerId !== activePassengerId,
																					),
																			)
																			return (
																				<SeatElement
																					key={element.designator ?? `${element.type}-${row.index}-${sectionIndex}-${elementIndex}`}
																					element={element}
																					segmentId={seatMap.segmentId}
																					activePassengerId={activePassengerId ?? ""}
																					selected={selected}
																					occupiedByOtherPassenger={occupiedByOtherPassenger}
																					adultRestricted={Boolean(activePassengerId && !passengerLabels.find((passenger) => passenger.id === activePassengerId)?.isAdult && requiresAdult(element.disclosures))}
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
										))
									)}
								</View>
							))}
						</>
					)}

					{selectedSeats.length > 0 && (
						<View className="mb-2 rounded-3xl border border-stone-200 bg-white p-4">
							<View className="mb-1 flex-row items-center justify-between">
								<Text className="font-inter-semibold text-base text-stone-900">Your seat selections</Text>
								<View className="rounded-full bg-orange-50 px-2.5 py-1">
									<Text className="font-inter-medium text-xs text-primary">{selectedSeats.length} selected</Text>
								</View>
							</View>
							{selectedSeats.map((seat: SelectedSeatService) => (
								<View key={`${seat.segmentId}-${seat.passengerId}-${seat.id}`} className="mt-3 border-t border-stone-100 pt-3">
									<View className="flex-row items-center justify-between gap-3">
										<View className="flex-1">
											<Text className="font-inter-medium text-sm text-stone-800">
												{passengerLabels.find((passenger) => passenger.id === seat.passengerId)?.label ?? "Traveller"} · {seat.seatDesignator}
											</Text>
											<Text className="mt-1 font-inter text-xs text-stone-500">
												{segmentTitle(flight, seat.segmentId, 0)}
											</Text>
										</View>
										<Text className="font-inter-semibold text-sm text-stone-900">
											{formatSeatPrice(seat.totalAmount, seat.totalCurrency)}
										</Text>
									</View>
									{seat.disclosures.length > 0 && (
										<View className="mt-2 flex-row items-start gap-2 rounded-xl bg-amber-50 p-3">
											<Feather name="alert-circle" size={14} color="#92400E" style={{ marginTop: 1 }} />
											<Text className="flex-1 font-inter text-xs leading-4 text-amber-900">
												{seat.disclosures.join(" · ")}
											</Text>
										</View>
									)}
								</View>
							))}
						</View>
					)}
				</ScrollView>
			)}

			<View className="border-t border-stone-200 bg-white px-5 pb-4 pt-3">
				<View className="mb-3 flex-row items-center justify-between">
					<View>
						<Text className="font-inter-medium text-sm text-stone-900">
							{selectedSeats.length === 0 ? "Seat selection is optional" : `${selectedSeats.length} seat${selectedSeats.length === 1 ? "" : "s"} selected`}
						</Text>
						<Text className="mt-0.5 font-inter text-xs text-stone-500">
							{selectedSeats.length === 0 ? "You can choose seats later if needed." : "Final seat assignment is subject to booking."}
						</Text>
					</View>
					{selectedTotal && (
						<View className="items-end">
							<Text className="font-inter text-[10px] uppercase tracking-wide text-stone-500">Seat total</Text>
							<Text className="mt-0.5 font-inter-semibold text-base text-stone-900">{selectedTotal}</Text>
						</View>
					)}
				</View>
				<Pressable
					onPress={handleContinue}
					className="w-full flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4 active:opacity-90"
				>
					<Text className="font-inter-semibold text-base text-white">Continue</Text>
					<Feather name="arrow-right" size={17} color="#FFFFFF" />
				</Pressable>
			</View>
		</SafeAreaView>
	)
}
