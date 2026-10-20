import { create } from "zustand"

interface FlightSearchState {
	tripType: AppConfig.TripType
	fromAirport?: string
	toAirport?: string
	departureDate?: string
	returnDate?: string
	passengers: AppConfig.PassengerCounts
	childAges: number[]
	infantAges: number[]
	cabinClass: AppConfig.CabinClass

	setTripType: (tripType: AppConfig.TripType) => void
	setAirports: (fromAirport?: string, toAirport?: string) => void
	setDates: (departureDate?: string, returnDate?: string) => void
	setPassengerCount: (passengerType: AppConfig.PassengerType, count: number) => void
	setPassengerAge: (passengerType: "children" | "infants", index: number, age: number) => void
	setCabinClass: (cabinClass: AppConfig.CabinClass) => void
	resetSearch: () => void
}

const DEFAULT_PASSENGERS: AppConfig.PassengerCounts = { adults: 1, children: 0, infants: 0 }

function resizeAges(ages: number[], count: number, defaultAge: number) {
	return Array.from({ length: count }, (_, index) => ages[index] ?? defaultAge)
}

export const useFlightSearchStore = create<FlightSearchState>((set) => ({
	tripType: "one-way",
	fromAirport: undefined,
	toAirport: undefined,
	departureDate: undefined,
	returnDate: undefined,
	passengers: { ...DEFAULT_PASSENGERS },
	childAges: [],
	infantAges: [],
	cabinClass: "economy",

	setTripType: (tripType) =>
		set((state) => ({
			tripType,
			returnDate: tripType === "one-way" ? undefined : state.returnDate,
		})),
	setAirports: (fromAirport, toAirport) => set({ fromAirport, toAirport }),
	setDates: (departureDate, returnDate) => set({ departureDate, returnDate }),
	setPassengerCount: (passengerType, count) =>
		set((state) => {
			const current = state.passengers
			const requested = Number.isFinite(count) ? Math.floor(count) : 0

			if (passengerType === "adults") {
				const maximum = Math.max(1, 9 - current.children - current.infants)
				const adults = Math.min(maximum, Math.max(1, requested))
				const infants = Math.min(current.infants, adults)
				return {
					passengers: { ...current, adults, infants },
					infantAges: resizeAges(state.infantAges, infants, 1),
				}
			}

			if (passengerType === "children") {
				const maximum = Math.max(0, 9 - current.adults - current.infants)
				const children = Math.min(maximum, Math.max(0, requested))
				return {
					passengers: { ...current, children },
					childAges: resizeAges(state.childAges, children, 5),
				}
			}

			const maximum = Math.min(current.adults, 9 - current.adults - current.children)
			const infants = Math.min(maximum, Math.max(0, requested))
			return {
				passengers: { ...current, infants },
				infantAges: resizeAges(state.infantAges, infants, 1),
			}
		}),
	setPassengerAge: (passengerType, index, age) =>
		set((state) => {
			const ages = passengerType === "children" ? state.childAges : state.infantAges
			if (!Number.isInteger(index) || index < 0 || index >= ages.length) return state
			const minimum = passengerType === "children" ? 2 : 0
			const maximum = passengerType === "children" ? 11 : 1
			const nextAges = [...ages]
			nextAges[index] = Math.min(maximum, Math.max(minimum, Math.floor(age)))
			return passengerType === "children" ? { childAges: nextAges } : { infantAges: nextAges }
		}),
	setCabinClass: (cabinClass) => set({ cabinClass }),

	resetSearch: () =>
		set({
			tripType: "one-way",
			fromAirport: undefined,
			toAirport: undefined,
			departureDate: undefined,
			returnDate: undefined,
			passengers: { ...DEFAULT_PASSENGERS },
			childAges: [],
			infantAges: [],
			cabinClass: "economy",
		}),
}))
