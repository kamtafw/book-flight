import { Feather } from "@expo/vector-icons"
import { clsx } from "clsx"
import { Modal, Pressable, Text, View } from "react-native"

import { cabinOptions, passengerRows } from "@/constants"
import { useFlightSearchStore } from "@/store/flight-search.store"

interface BookingPreferencesModalProps {
	visible: boolean
	preference: "travellers" | "class"
	onClose: () => void
}

export default function BookingPreferencesModal({
	visible,
	preference,
	onClose,
}: BookingPreferencesModalProps) {
	const passengers = useFlightSearchStore((state) => state.passengers)
	const cabinClass = useFlightSearchStore((state) => state.cabinClass)

	const setPassengerCount = useFlightSearchStore((state) => state.setPassengerCount)
	const setCabinClass = useFlightSearchStore((state) => state.setCabinClass)

	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<View className="flex-1 justify-end bg-black/40">
				<View className="rounded-t-3xl bg-white px-6 pb-8 pt-5">
					{/* Header */}
					<View className="mb-6 flex-row items-center justify-between">
						<View>
							<Text className="font-inter-semibold text-xl text-black">
								{preference === "travellers" ? "Travellers" : "Cabin Class"}
							</Text>

							<Text className="mt-1 font-inter text-sm text-gray-200">
								{preference === "travellers" ? "Who is travelling?" : "Choose your preferred cabin"}
							</Text>
						</View>

						<Pressable
							onPress={onClose}
							className="h-9 w-9 items-center justify-center rounded-full bg-gray-50 active:opacity-70"
						>
							<Feather name="x" size={20} color="#555" />
						</Pressable>
					</View>

					{/* Travellers */}
					{preference === "travellers" && (
						<View className="gap-2">
							{passengerRows.map((row) => {
								const count = passengers[row.type]

								const canDecrease = row.type === "adults" ? count > 1 : count > 0

								const canIncrease = row.type !== "infants" || count < passengers.adults

								return (
									<View
										key={row.type}
										className="flex-row items-center justify-between border-b border-border py-4"
									>
										<View className="flex-1">
											<Text className="font-inter-medium text-base text-black">{row.label}</Text>

											<Text className="mt-1 font-inter text-xs text-gray-200">
												{row.description}
											</Text>
										</View>

										<View className="flex-row items-center gap-4">
											<Pressable
												disabled={!canDecrease}
												onPress={() => setPassengerCount(row.type, count - 1)}
												className={clsx(
													"h-9 w-9 items-center justify-center rounded-full border border-border",
													!canDecrease && "opacity-40",
												)}
											>
												<Feather name="minus" size={16} color="#555" />
											</Pressable>

											<Text className="w-5 text-center font-inter-semibold text-base text-black">
												{count}
											</Text>

											<Pressable
												disabled={!canIncrease}
												onPress={() => setPassengerCount(row.type, count + 1)}
												className={clsx(
													"h-9 w-9 items-center justify-center rounded-full border border-border",
													!canIncrease && "opacity-40",
												)}
											>
												<Feather name="plus" size={16} color="#555" />
											</Pressable>
										</View>
									</View>
								)
							})}
						</View>
					)}

					{/* Cabin Class */}
					{preference === "class" && (
						<View className="gap-3">
							{cabinOptions.map((option) => {
								const selected = cabinClass === option.value

								return (
									<Pressable
										key={option.value}
										onPress={() => setCabinClass(option.value)}
										className={clsx(
											"flex-row items-center rounded-2xl border p-4",
											selected ? "border-primary bg-primary/5" : "border-border",
										)}
									>
										<View className="flex-1">
											<Text
												className={clsx(
													"font-inter-medium text-base",
													selected ? "text-primary" : "text-black",
												)}
											>
												{option.label}
											</Text>

											<Text className="mt-1 font-inter text-xs text-gray-200">
												{option.description}
											</Text>
										</View>

										<View
											className={clsx(
												"h-5 w-5 items-center justify-center rounded-full border-2",
												selected ? "border-primary" : "border-gray-300",
											)}
										>
											{selected && <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
										</View>
									</Pressable>
								)
							})}
						</View>
					)}

					{/* Done */}
					<Pressable
						onPress={onClose}
						className="mt-6 items-center rounded-xl bg-primary py-4 active:opacity-90"
					>
						<Text className="font-inter-medium text-base text-white">Done</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	)
}
