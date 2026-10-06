import { FlightSeat } from "@/components/flight-seat"
import { seats } from "@/lib/data"
import { useFlightBookingStore } from "@/store/flight-booking.store"
import { useFlightSearchStore } from "@/store/flight-search.store"
import { Feather } from "@expo/vector-icons"
import { router } from "expo-router"
import { memo, useMemo } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Path, Svg } from "react-native-svg"

const seatColumns = ["A", "B", "C", "D"] as const

export default function ChooseSeat2Screen() {
	const passengers = useFlightSearchStore((state) => state.passengers)
	const selectedSeats = useFlightBookingStore((state) => state.selectedOutboundSeats)
	const toggleSeat = useFlightBookingStore((state) => state.toggleOutboundSeat)

	const requiredSeats = passengers.adults + passengers.children

	const selectedCount = selectedSeats.length
	const canConfirm = selectedCount === requiredSeats

	const rows = useMemo(() => {
		const rowNumbers = [...new Set(seats.map((seat) => seat.row))]

		return rowNumbers.map((row) => ({
			row,
			seats: seatColumns.map((column) =>
				seats.find((seat) => seat.row === row && seat.column === column),
			),
		}))
	}, [])

	const getSeatStatus = (seat: NonNullable<(typeof rows)[number]["seats"][number]>) => {
		if (selectedSeats.includes(seat.id)) {
			return "selected" as const
		}

		return seat.status
	}

	const handleSeatPress = (seatId: string) => {
		if (selectedSeats.includes(seatId)) {
			toggleSeat(seatId)
			return
		}

		if (selectedCount >= requiredSeats) {
			return
		}

		toggleSeat(seatId)
	}

	const handleConfirm = () => {
		if (!canConfirm) return

		router.push("/personal-information-2")
	}

	return (
		<SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row items-center px-6 py-4">
				<Pressable
					onPress={() => router.back()}
					className="h-10 w-10 items-center justify-center"
					hitSlop={8}
				>
					<Feather name="chevron-left" size={28} color="#191919" />
				</Pressable>
				<Text className="flex-1 text-center font-inter-medium text-xl text-black mr-6">
					Choose Seat
				</Text>
			</View>

			{/* Legend */}
			<View className="mb-6 mt-4 flex-row items-center justify-center gap-6">
				<LegendItem color="bg-primary" label="Selected" />
				<LegendItem color="bg-gray-200" label="Emergency exit" />
				<LegendItem color="bg-gray-300" label="Reserved" />
			</View>

			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerClassName="px-8 pb-6"
			>
				{/* Aircraft seat map */}
				<View className="overflow-hidden bg-white rounded-t-full px-8 pt-8 pb-8">
					<View className="mb-8 self-center">
						<AircraftNose />
					</View>

					{/* Seats */}
					<View className="flex-1">
						{rows.map(({ row, seats: rowSeats }) => {
							const [seatA, seatB, seatC, seatD] = rowSeats

							return (
								<View key={row} className="flex-row justify-between mb-2">
									<View className="flex-row items-center">
										<View className="w-6 h-4 rounded-full bg-gray-400 mr-1" />
										<View className="flex-row gap-0.5">
											{seatA ? (
												<FlightSeat
													label={seatA.id}
													status={getSeatStatus(seatA)}
													onPress={() => handleSeatPress(seatA.id)}
												/>
											) : (
												<View className="h-12 w-12" />
											)}

											{seatB ? (
												<FlightSeat
													label={seatB.id}
													status={getSeatStatus(seatB)}
													onPress={() => handleSeatPress(seatB.id)}
												/>
											) : (
												<View className="h-12 w-12" />
											)}
										</View>
									</View>

									<View className="flex-row items-center">
										<View className="flex-row gap-0.5">
											{seatC ? (
												<FlightSeat
													label={seatC.id}
													status={getSeatStatus(seatC)}
													onPress={() => handleSeatPress(seatC.id)}
												/>
											) : (
												<View className="h-12 w-12" />
											)}

											{seatD ? (
												<FlightSeat
													label={seatD.id}
													status={getSeatStatus(seatD)}
													onPress={() => handleSeatPress(seatD.id)}
												/>
											) : (
												<View className="h-12 w-12" />
											)}
										</View>
										<View className="w-6 h-4 rounded-full bg-gray-400 ml-1" />
									</View>
								</View>
							)
						})}
					</View>
				</View>

				{/* Selection summary */}
				<View className="mt-5 px-1">
					<View className="flex-row justify-between items-center">
						<Text className="font-inter-medium text-sm text-gray-200">Selected seats</Text>

						<Text className="font-inter-semibold text-sm text-black">
							{selectedCount} / {requiredSeats}
						</Text>
					</View>

					{selectedSeats.length > 0 && (
						<Text className="font-inter-semibold text-base text-primary mt-2">
							{selectedSeats.join(", ")}
						</Text>
					)}
				</View>
			</ScrollView>

			<View className="px-5 pb-5 pt-3">
				<Pressable
					disabled={!canConfirm}
					onPress={handleConfirm}
					className={[
						"w-full py-4 rounded-2xl items-center",
						canConfirm ? "bg-primary active:opacity-90" : "bg-gray-300",
					].join(" ")}
				>
					<Text className="font-inter-semibold text-base text-white">Confirm</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	)
}

function LegendItem({ color, label }: { color: string; label: string }) {
	return (
		<View className="flex-row items-center gap-2">
			<View className={`h-3 w-3 rounded-sm ${color}`} />
			<Text className="font-inter text-[10px]  text-gray-200">{label}</Text>
		</View>
	)
}

const AircraftNose = memo(() => (
	<Svg width="230" height="102" viewBox="0 0 230 102" preserveAspectRatio="none">
		<Path d="M16.2909 102H0L16.2909 46.8871L35.0255 66.2177L16.2909 102Z" fill="#E3E4E5" />
		<Path d="M112 32.4919L39.0982 62.5161L18.3273 42.3629L112 0V32.4919Z" fill="#E3E4E5" />
		<Path d="M213.709 102H230L213.709 46.8871L194.975 66.2177L213.709 102Z" fill="#E3E4E5" />
		<Path d="M118 32.4919L190.902 62.5161L211.673 42.3629L118 0V32.4919Z" fill="#E3E4E5" />
	</Svg>
))
