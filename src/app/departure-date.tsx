import { MonthGrid } from "@/components/month-grid"
import { Feather, Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
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

function getCalendarDays(year: number, month: number) {
	const firstDay = new Date(year, month, 1)
	const lastDay = new Date(year, month + 1, 0)

	const startDay = firstDay.getDay()
	const daysInMonth = lastDay.getDate()

	const days: Date[] = []

	// trailing days from previous month
	for (let i = startDay - 1; i >= 0; i--) {
		days.push(new Date(year, month, -i))
	}

	// days in current month
	for (let day = 1; day <= daysInMonth; day++) {
		days.push(new Date(year, month, day))
	}

	// leading days in next month
	const remaining = 7 - (days.length % 7)

	if (remaining < 7) {
		for (let day = 1; day <= remaining; day++) {
			days.push(new Date(year, month + 1, day))
		}
	}

	return days
}

export default function DepartureDateScreen() {
	const today = new Date()

	const [visibleMonth, setVisibleMonth] = useState(
		new Date(today.getFullYear(), today.getMonth(), 1),
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

	const handleSelect = () => {
		if (!selectedDate) return

		router.replace({
			pathname: "/",
			params: { departureDate: formatDate(selectedDate) },
		})
	}

	const nextMonthIndex = (visibleMonth.getMonth() + 1) % 12
	const nextMonthYear =
		visibleMonth.getMonth() === 11 ? visibleMonth.getFullYear() + 1 : visibleMonth.getFullYear()

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row items-center px-6 py-4">
				<Pressable onPress={() => router.back()} className="p-1 -ml-1">
					<Ionicons name="chevron-back" size={24} color="#191919" />
				</Pressable>
				<Text className="flex-1 text-center font-inter-bold text-xl text-black mr-6">
					Departure Date
				</Text>
			</View>

			{/* Date Fields */}
			<View className="flex-row gap-4 px-5 py-4">
				{/* Departure */}
				<View className="flex-1 border border-border rounded-xl p-3 relative">
					<Text className="absolute -top-2.5 left-4 bg-background px-1 text-xs font-inter-light text-gray-200">
						Departure
					</Text>

					<View className="flex-row items-center gap-3 mt-1">
						<Feather name={selectedDate ? "calendar" : "plus"} size={16} color="#555" />
						<Text className="font-inter-semibold text-sm text-black">
							{selectedDate ? formatDate(selectedDate) : "Add Departure Date"}
						</Text>
					</View>
				</View>

				{/* Return */}

				<View className="flex-1 border border-border rounded-xl p-3 relative">
					<Text className="absolute -top-2.5 left-4 bg-background px-1 text-xs font-inter-light text-gray-200">
						Return
					</Text>

					<View className="flex-row items-center gap-3 mt-1">
						<Feather name="plus" size={16} color="#555" />
						<Text className="font-inter-semibold text-sm text-black">Add Return Date</Text>
					</View>
				</View>
			</View>

			{/* Weekdays Header */}
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

			{/* Month Calendars*/}
			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerClassName="pt-6"
			>
				{/* Current Month */}
				<MonthGrid
					days={calendarDaysForCurrentMonth}
					monthName={MONTHS[visibleMonth.getMonth()]}
					year={visibleMonth.getFullYear()}
					targetMonthIndex={visibleMonth.getMonth()}
					selectedDate={selectedDate}
					onSelectDate={setSelectedDate}
				/>

				{/* Next Month */}
				<MonthGrid
					days={calendarDaysForNextMonth}
					monthName={MONTHS[nextMonthIndex]}
					year={nextMonthYear}
					targetMonthIndex={nextMonthIndex}
					selectedDate={selectedDate}
					onSelectDate={setSelectedDate}
				/>
			</ScrollView>

			{/* Lower Call To Action Action Ribbon */}
			<View className="px-5 pt-2 pb-8 bg-white">
				<Pressable
					onPress={handleSelect}
					className="bg-primary w-full py-4 rounded-2xl items-center active:opacity-90 shadow-md shadow-primary/20 elevation-5"
				>
					<Text className="text-white font-inter-bold text-base">Select</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	)
}
