import { create } from "zustand"

interface FlightBookingState {
	selectedOutboundSeats: string[]

	passengerInformation: AppConfig.PassengerInformation

	setOutboundSeats: (seats: string[]) => void
	toggleOutboundSeat: (seat: string) => void
	clearOutboundSeats: () => void

	setPassengerInformation: (information: Partial<AppConfig.PassengerInformation>) => void

	clearPassengerInformation: () => void
}

const initialPassengerInformation: AppConfig.PassengerInformation = {
	name: "",
	address: "",
	passport: "",
	dateOfBirth: "",
	country: "",
}

export const useFlightBookingStore = create<FlightBookingState>((set) => ({
	selectedOutboundSeats: [],
	passengerInformation: initialPassengerInformation,

	setOutboundSeats: (seats) => {
		set({ selectedOutboundSeats: seats })
	},

	toggleOutboundSeat: (seat) => {
		set((state) => ({
			selectedOutboundSeats: state.selectedOutboundSeats.includes(seat)
				? state.selectedOutboundSeats.filter((selected) => selected !== seat)
				: [...state.selectedOutboundSeats, seat],
		}))
	},

	clearOutboundSeats: () => {
		set({ selectedOutboundSeats: [] })
	},

	setPassengerInformation: (information) =>
		set((state) => ({ passengerInformation: { ...state.passengerInformation, ...information } })),

	clearPassengerInformation: () => set({ passengerInformation: initialPassengerInformation }),
}))
