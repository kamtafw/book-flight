import clsx from "clsx"
import { Pressable, Text, View } from "react-native"

interface MonthGridProps {
	days: Date[]
	monthName: string
	year: number
	targetMonthIndex: number
	selectedDate: Date | null
	onSelectDate: (date: Date) => void
}

export function MonthGrid({
	days,
	monthName,
	year,
	targetMonthIndex,
	selectedDate,
	onSelectDate,
}: MonthGridProps) {
	return (
		<View className="px-4">
			<Text className="font-inter-semibold text-lg text-black mb-3">
				{monthName} <Text className="font-inter text-base text-gray-200">{year}</Text>
			</Text>

			<View className="flex-row flex-wrap">
				{days.map((date) => {
					const isCurrentMonth = date.getMonth() === targetMonthIndex
					const isSelected =
						selectedDate !== null && date.toDateString() === selectedDate.toDateString()
					const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0))

					return (
						<Pressable
							key={date.toISOString()}
							disabled={!isCurrentMonth || isPastDate}
							onPress={() => onSelectDate(date)}
							style={{ width: `${100 / 7}%` }}
							className="aspect-square items-center justify-center my-0.5 rounded-full"
						>
							<View
								className={clsx(
									"h-7 w-7 items-center justify-center rounded",
									isSelected && "bg-primary",
								)}
							>
								<Text
									className={clsx(
										"font-inter-medium text-sm",
										!isCurrentMonth || isPastDate
											? "text-gray-300"
											: isSelected
												? "text-white font-inter-semibold"
												: "text-gray-200",
									)}
								>
									{date.getDate()}
								</Text>
							</View>
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}
