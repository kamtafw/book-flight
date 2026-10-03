import { MonthGrid } from "@/components/month-grid"
import { Feather, Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
]

function formatDate(date: Date) {
	const day = String(date.getDate()).padStart(2, "0")
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const year = date.getFullYear()

	return `${day}/${month}/${year}`
}

function parseDate(value: string) {
	const [day, month, year] = value.split("/").map(Number)

	return new Date(year, month - 1, day)
}

function getCalendarDays(year: number, month: number) {
	const firstDay = new Date(year, month, 1)
	const lastDay = new Date(year, month + 1, 0)

	const startDay = firstDay.getDay()
	const daysInMonth = lastDay.getDate()

	const days: Date[] = []

	for (let i = startDay - 1; i >= 0; i--) {
		days.push(new Date(year, month, -i))
	}

	for (let day = 1; day <= daysInMonth; day++) {
		days.push(new Date(year, month, day))
	}

	const remaining = 7 - (days.length % 7)

	if (remaining < 7) {
		for (let day = 1; day <= remaining; day++) {
			days.push(new Date(year, month + 1, day))
		}
	}

	return days
}

export default function ReturnDateScreen() {
	const { departureDate } = useLocalSearchParams<{
		departureDate?: string
	}>()

	const parsedDepartureDate = departureDate ? parseDate(departureDate) : new Date()

	const [visibleMonth, setVisibleMonth] = useState(
		new Date(parsedDepartureDate.getFullYear(), parsedDepartureDate.getMonth(), 1),
	)

	const [selectedDate, setSelectedDate] = useState<Date | null>(null)

	const calendarDaysForCurrentMonth = useMemo(
		() => getCalendarDays(visibleMonth.getFullYear(), visibleMonth.getMonth()),
		[visibleMonth],
	)

	const calendarDaysForNextMonth = useMemo(
		() =>
			getCalendarDays(
				visibleMonth.getMonth() === 11
					? visibleMonth.getFullYear() + 1
					: visibleMonth.getFullYear(),
				(visibleMonth.getMonth() + 1) % 12,
			),
		[visibleMonth],
	)

	const nextMonthIndex = (visibleMonth.getMonth() + 1) % 12

	const nextMonthYear =
		visibleMonth.getMonth() === 11 ? visibleMonth.getFullYear() + 1 : visibleMonth.getFullYear()

	const handleSelect = () => {
		if (!selectedDate) return

		router.replace({
			pathname: "/",
			params: {
				departureDate,
				returnDate: formatDate(selectedDate),
			},
		})
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-1">
				{/* Header */}
				<View className="flex-row items-center px-6 py-4">
					<Pressable onPress={() => router.back()} className="p-1 -ml-1">
						<Ionicons name="chevron-back" size={24} color="#191919" />
					</Pressable>

					<Text className="flex-1 text-center font-inter-bold text-xl text-black mr-6">
						Return Date
					</Text>
				</View>

				{/* Date fields */}
				<View className="flex-row gap-4 px-5 py-4">
					{/* Departure */}
					<View className="flex-1 border border-border rounded-xl p-3 relative">
						<Text className="absolute -top-2.5 left-4 bg-background px-1 text-xs font-inter-light text-gray-200">
							Departure
						</Text>

						<View className="flex-row items-center gap-3 mt-1">
							<Feather name="calendar" size={16} color="#555" />

							<Text className="font-inter-semibold text-sm text-black">{departureDate}</Text>
						</View>
					</View>

					{/* Return */}
					<View className="flex-1 border border-primary rounded-xl p-3 relative">
						<Text className="absolute -top-2.5 left-4 bg-background px-1 text-xs font-inter-light text-primary">
							Return
						</Text>

						<View className="flex-row items-center gap-3 mt-1">
							<Feather name="calendar" size={16} color="#555" />

							<Text className="font-inter-semibold text-sm text-black">
								{selectedDate ? formatDate(selectedDate) : "Select date"}
							</Text>
						</View>
					</View>
				</View>

				{/* Weekdays */}
				<View className="flex-row bg-gray-400/40 py-3 px-4 justify-between">
					{WEEKDAYS.map((day) => (
						<Text
							key={day}
							style={{ width: `${100 / 7}%` }}
							className="text-center font-inter-semibold text-sm text-black"
						>
							{day}
						</Text>
					))}
				</View>

				{/* Calendars */}
				<ScrollView
					className="flex-1"
					showsVerticalScrollIndicator={false}
					contentContainerClassName="pt-6"
				>
					<MonthGrid
						days={calendarDaysForCurrentMonth}
						monthName={MONTHS[visibleMonth.getMonth()]}
						year={visibleMonth.getFullYear()}
						targetMonthIndex={visibleMonth.getMonth()}
						selectedDate={selectedDate}
						onSelectDate={setSelectedDate}
					/>

					<MonthGrid
						days={calendarDaysForNextMonth}
						monthName={MONTHS[nextMonthIndex]}
						year={nextMonthYear}
						targetMonthIndex={nextMonthIndex}
						selectedDate={selectedDate}
						onSelectDate={setSelectedDate}
					/>
				</ScrollView>

				{/* Select */}
				<View className="px-5 pt-2 pb-8 bg-white">
					<Pressable
						disabled={!selectedDate}
						onPress={handleSelect}
						className="bg-primary w-full py-4 rounded-2xl items-center"
					>
						<Text className="text-white font-inter-bold text-base">Select</Text>
					</Pressable>
				</View>
			</View>
		</SafeAreaView>
	)
}
