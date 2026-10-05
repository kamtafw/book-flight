import { create } from "zustand"

interface FlightBookingState {
	selectedOutboundSeats: string[]

	setOutboundSeats: (seats: string[]) => void
	toggleOutboundSeat: (seat: string) => void
	clearOutboundSeats: () => void
}

export const useFlightBookingStore = create<FlightBookingState>((set) => ({
	selectedOutboundSeats: [],

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
}))
