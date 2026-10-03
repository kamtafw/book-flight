import clsx from "clsx"
import { Pressable, Text, View } from "react-native"

interface MonthGridProps {
	days: Date[]
	monthName: string
	year: number
	targetMonthIndex: number
	startDate: Date | null
	endDate: Date | null
	minDate?: Date | null
	onSelectDate: (date: Date) => void
}

export function MonthGrid({
	days,
	monthName,
	year,
	targetMonthIndex,
	startDate,
	endDate,
	minDate,
	onSelectDate,
}: MonthGridProps) {
	const normalizedMinDate = minDate
		? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
		: null

	return (
		<View className="px-4">
			<Text className="font-inter-semibold text-lg text-black mb-3">
				{monthName} <Text className="font-inter text-base text-gray-200">{year}</Text>
			</Text>

			<View className="flex-row flex-wrap">
				{days.map((date) => {
					const isCurrentMonth = date.getMonth() === targetMonthIndex
					const today = new Date()
					today.setHours(0, 0, 0, 0)

					const isBeforeMinDate = normalizedMinDate !== null && date < normalizedMinDate
					const isPastDate = date < today

					const isDisabled = !isCurrentMonth || isPastDate || isBeforeMinDate

					const isStart = startDate !== null && date.toDateString() === startDate.toDateString()
					const isEnd = endDate !== null && date.toDateString() === endDate.toDateString()
					const isInRange =
						startDate !== null && endDate !== null && date > startDate && date < endDate

					return (
						<Pressable
							key={date.toISOString()}
							disabled={isDisabled}
							onPress={() => onSelectDate(date)}
							style={{ width: `${100 / 7}%` }}
							className={clsx(
								"aspect-square items-center justify-center my-0.5 relative",
								isInRange && isCurrentMonth && "bg-primary/10",
								isStart && endDate && isCurrentMonth && "bg-primary/10 rounded-l-full",
								isEnd && startDate && isCurrentMonth && "bg-primary/10 rounded-r-full",
							)}
						>
							<View
								className={clsx(
									"h-8 w-8 items-center justify-center rounded-xl",
									(isStart || isEnd) && "bg-primary",
								)}
							>
								<Text
									className={clsx(
										"font-inter-medium text-sm",
										isDisabled
											? "text-gray-300"
											: isStart || isEnd
												? "text-white font-inter-bold"
												: isInRange
													? "text-primary font-inter-semibold"
													: "text-black",
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
