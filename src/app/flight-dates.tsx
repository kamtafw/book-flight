import { MonthGrid } from "@/components/month-grid"
import { Feather, Ionicons } from "@expo/vector-icons"
import clsx from "clsx"
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

export default function FlightDatesScreen() {
	const today = new Date()

	const [visibleMonth, setVisibleMonth] = useState(
		new Date(today.getFullYear(), today.getMonth(), 1),
	)

	const [departureDate, setDepartureDate] = useState<Date | null>(null)
	const [returnDate, setReturnDate] = useState<Date | null>(null)
	const [activeField, setActiveField] = useState<"departure" | "return">("departure")

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

	const handleDateSelect = (date: Date) => {
		if (activeField === "departure") {
			setDepartureDate(date)

			if (returnDate && date > returnDate) {
				setReturnDate(null)
			}

			setActiveField("return")
			return
		}

		setReturnDate(date)
	}

	const handleSelect = () => {
		if (!departureDate) return

		router.replace({
			pathname: "/",
			params: {
				departureDate: formatDate(departureDate),
				returnDate: returnDate ? formatDate(returnDate) : "",
			},
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
					Select Dates
				</Text>
			</View>

			{/* Date Input Range Cards */}
			<View className="flex-row gap-4 px-5 py-4">
				{/* Departure */}
				<Pressable
					onPress={() => setActiveField("departure")}
					className={clsx(
						"flex-1 border rounded-xl p-3 relative bg-white",
						activeField === "departure" ? "border-primary" : "border-border",
					)}
				>
					<Text
						className={clsx(
							"absolute -top-2.5 left-4 px-1 text-xs font-inter-light bg-background",
							activeField === "departure" ? "text-primary" : "text-gray-200",
						)}
					>
						Departure
					</Text>

					<View className="flex-row items-center gap-3 mt-1">
						<Feather
							name={departureDate ? "calendar" : "plus"}
							size={16}
							color={activeField === "departure" ? "#EC441E" : "#555"}
						/>
						<Text className="font-inter-semibold text-sm text-black">
							{departureDate ? formatDate(departureDate) : "Add Departure Date"}
						</Text>
					</View>
				</Pressable>

				{/* Return */}
				<Pressable
					onPress={() => setActiveField("return")}
					className={clsx(
						"flex-1 border rounded-xl p-3 relative bg-white",
						activeField === "return" ? "border-primary" : "border-border",
					)}
				>
					<Text
						className={clsx(
							"absolute -top-2.5 left-4 px-1 text-xs font-inter-light bg-background",
							activeField === "return" ? "text-primary" : "text-gray-200",
						)}
					>
						Return
					</Text>

					<View className="flex-row items-center gap-3 mt-1">
						<Feather
							name={returnDate ? "calendar" : "plus"}
							size={16}
							color={activeField === "return" ? "#EC441E" : "#555"}
						/>
						<Text className="font-inter-semibold text-sm text-black">
							{returnDate ? formatDate(returnDate) : "Add Return Date"}
						</Text>
					</View>
				</Pressable>
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
					startDate={departureDate}
					endDate={returnDate}
					minDate={activeField === "return" ? departureDate : today}
					onSelectDate={handleDateSelect}
				/>

				{/* Next Month */}
				<MonthGrid
					days={calendarDaysForNextMonth}
					monthName={MONTHS[nextMonthIndex]}
					year={nextMonthYear}
					targetMonthIndex={nextMonthIndex}
					startDate={departureDate}
					endDate={returnDate}
					minDate={activeField === "return" ? departureDate : today}
					onSelectDate={handleDateSelect}
				/>
			</ScrollView>

			{/* Form Execution Banner */}
			<View className="px-5 pt-2 pb-8 bg-white">
				<Pressable
					onPress={handleSelect}
					disabled={!departureDate}
					className={clsx(
						"w-full py-4 rounded-2xl items-center shadow-md shadow-primary/20 elevation-5",
						departureDate ? "bg-primary active:opacity-90" : "bg-gray-300",
					)}
				>
					<Text className="text-white font-inter-bold text-base">Select</Text>
				</Pressable>
			</View>
		</SafeAreaView>
	)
}
