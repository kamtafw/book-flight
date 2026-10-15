import { create } from "zustand"

import type { FlightOffer } from "@/lib/flights/types"

interface FlightOffersState {
  offers: FlightOffer[]
  setOffers: (offers: FlightOffer[]) => void
  clearOffers: () => void
}

export const useFlightOffersStore = create<FlightOffersState>((set) => ({
  offers: [],
  setOffers: (offers) => set({ offers }),
  clearOffers: () => set({ offers: [] }),
}))
