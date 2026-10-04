import { create } from "zustand"

interface FlightSearchState {
	tripType: AppConfig.TripType

	fromAirport?: string
	toAirport?: string

	departureDate?: string
	returnDate?: string

	passengers: AppConfig.PassengerCounts
	cabinClass: AppConfig.CabinClass

	setTripType: (tripType: AppConfig.TripType) => void
	setAirports: (fromAirport?: string, toAirport?: string) => void
	setDates: (departureDate?: string, returnDate?: string) => void
	setPassengerCount: (passengerType: AppConfig.PassengerType, count: number) => void
	setCabinClass: (cabinClass: AppConfig.CabinClass) => void

	resetSearch: () => void
}

export const useFlightSearchStore = create<FlightSearchState>((set) => ({
	tripType: "one-way",

	fromAirport: undefined,
	toAirport: undefined,

	departureDate: undefined,
	returnDate: undefined,

	passengers: {
		adults: 1,
		children: 0,
		infants: 0,
	},
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
			const minimum = passengerType === "adults" ? 1 : 0
			const nextCount = Math.max(minimum, count)

			if (passengerType === "adults") {
				return {
					passengers: {
						...state.passengers,
						adults: nextCount,
						infants: Math.min(state.passengers.infants, nextCount),
					},
				}
			}

			if (passengerType === "infants") {
				return {
					passengers: {
						...state.passengers,
						infants: Math.min(nextCount, state.passengers.adults),
					},
				}
			}

			return {
				passengers: {
					...state.passengers,
					children: nextCount,
				},
			}
		}),
	setCabinClass: (cabinClass) => set({ cabinClass }),

	resetSearch: () =>
		set({
			tripType: "one-way",
			fromAirport: undefined,
			toAirport: undefined,
			departureDate: undefined,
			returnDate: undefined,
			passengers: {
				adults: 1,
				children: 0,
				infants: 0,
			},
			cabinClass: "economy",
		}),
}))
