export interface FlightSearchRequest {
  origin: string
  destination: string
  departureDate: string
  adults: number
  cabinClass: AppConfig.CabinClass
}

export interface FlightSegment {
  id: string
  departureAirportCode: string
  departureAirportName: string
  departureAt: string
  arrivalAirportCode: string
  arrivalAirportName: string
  arrivalAt: string
  marketingCarrierName: string
  marketingCarrierCode: string
  operatingCarrierName: string
  operatingCarrierCode: string
  flightNumber: string
  duration: string | null
}

export interface FlightSlice {
  originCode: string
  destinationCode: string
  duration: string | null
  segments: FlightSegment[]
}

export interface FlightOffer {
  id: string
  airline: string
  flightNumber: string
  departureTime: string
  arrivalTime: string
  duration: string
  price: number
  currency: string
  expiresAt: string | null
  operatingCarrierNames: string[]
  slices: FlightSlice[]
}

export interface FlightSearchResponse {
  offers: FlightOffer[]
}

export class FlightSearchError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
    this.name = "FlightSearchError"
  }
}
