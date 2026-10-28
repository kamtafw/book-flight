import type { SelectedSeatService } from "@/lib/flights/types"
import { create } from "zustand"

interface FlightBookingState {
	selectedOutboundSeats: string[]
	selectedOutboundSeatServices: SelectedSeatService[]

	passengerInformation: AppConfig.PassengerInformation

	setOutboundSeats: (seats: string[]) => void
	toggleOutboundSeat: (seat: string) => void
	clearOutboundSeats: () => void
	selectOutboundSeatService: (selection: SelectedSeatService) => void
	clearOutboundSeatServices: () => void

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
	selectedOutboundSeatServices: [],
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
		set({ selectedOutboundSeats: [], selectedOutboundSeatServices: [] })
	},

	selectOutboundSeatService: (selection) =>
			set((state) => {
			if (
				!selection.id ||
				!selection.offerId ||
				!selection.passengerId ||
				!selection.segmentId ||
				!selection.seatDesignator ||
				!selection.totalCurrency ||
				!Number.isFinite(Number(selection.totalAmount)) ||
				Number(selection.totalAmount) < 0
			) {
				return state
			}

			const existing = state.selectedOutboundSeatServices.find(
				(item) =>
					item.segmentId === selection.segmentId && item.passengerId === selection.passengerId,
			)
			if (existing?.id === selection.id) {
				const remaining = state.selectedOutboundSeatServices.filter(
					(item) =>
						item.segmentId !== selection.segmentId || item.passengerId !== selection.passengerId,
				)
				return {
					selectedOutboundSeatServices: remaining,
					selectedOutboundSeats: [...new Set(remaining.map((item) => item.seatDesignator))],
				}
			}
			const seatAlreadyAssigned = state.selectedOutboundSeatServices.some(
				(item) =>
					item.segmentId === selection.segmentId &&
					item.seatDesignator === selection.seatDesignator &&
					item.passengerId !== selection.passengerId,
			)
			if (seatAlreadyAssigned) return state

			const next = [
				...state.selectedOutboundSeatServices.filter(
					(item) =>
						item.segmentId !== selection.segmentId || item.passengerId !== selection.passengerId,
				),
				selection,
			]
			return {
				selectedOutboundSeatServices: next,
				selectedOutboundSeats: [...new Set(next.map((item) => item.seatDesignator))],
			}
		}),
	clearOutboundSeatServices: () =>
		set({ selectedOutboundSeatServices: [], selectedOutboundSeats: [] }),

	setPassengerInformation: (information) =>
		set((state) => ({ passengerInformation: { ...state.passengerInformation, ...information } })),

	clearPassengerInformation: () => set({ passengerInformation: initialPassengerInformation }),
}))
