export interface FlightSearchRequest {
	origin: string
	destination: string
	departureDate: string
	adults: number
	childAges: number[]
	infantAges: number[]
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

export interface FlightOfferPassenger {
	id: string
	type: string | null
	age: number | null
}

export interface FlightOffer {
	id: string
	airline: string
	flightNumber: string
	departureTime: string
	arrivalTime: string
	duration: string
	price: number
	/** Original provider amount preserved as a decimal string for financial comparisons. */
	priceAmount: string | null
	currency: string
	expiresAt: string | null
	/** null means Duffel did not provide this requirement value. */
	passengerIdentityDocumentsRequired?: boolean | null
	/** null means the supported document types were not provided; [] is an explicit empty list. */
	supportedPassengerIdentityDocumentTypes?: string[] | null
	operatingCarrierNames: string[]
	passengers?: FlightOfferPassenger[]
	slices: FlightSlice[]
}

export interface FlightSearchResponse {
	offers: FlightOffer[]
}

export class FlightSearchError extends Error {
	constructor(
		message: string,
		readonly code?: string,
	) {
		super(message)
		this.name = "FlightSearchError"
	}
}

export interface SeatMapService {
	id: string
	passengerId: string
	totalAmount: string
	totalCurrency: string
}

export interface SeatMapElement {
	type: string
	designator: string | null
	name: string
	disclosures: string[]
	availableServices: SeatMapService[]
}

export interface SeatMapSection {
	elements: SeatMapElement[]
}

export interface SeatMapRow {
	index: number
	sections: SeatMapSection[]
}

export interface SeatMapCabin {
	id: string
	deck: number
	rows: SeatMapRow[]
}

export interface FlightSeatMap {
	id: string
	segmentId: string
	sliceId: string
	cabins: SeatMapCabin[]
}

export interface SeatMapResponse {
	seatMaps: FlightSeatMap[]
}

export interface SelectedSeatService extends SeatMapService {
	offerId: string
	segmentId: string
	seatDesignator: string
	seatName: string
	disclosures: string[]
}

export interface SeatServiceValidationSelection {
	serviceId: string
	passengerId: string
	segmentId: string
	seatDesignator: string
	expectedAmount: string
	expectedCurrency: string
	expectedDisclosures: string[]
}

export interface ValidatedSeatServiceDetails {
	serviceId: string
	passengerId: string
	segmentId: string
	seatDesignator: string
	seatName: string
	disclosures: string[]
	amount: string
	currency: string
}

export interface SeatServiceValidationResult extends SeatServiceValidationSelection {
	status: "valid" | "price_changed" | "selection_changed"
	reason: string | null
	priceChanged?: boolean
	current: ValidatedSeatServiceDetails | null
}

export interface SeatServiceValidationResponse {
	status: "valid" | "price_changed" | "selection_changed" | "not_selected"
	selections: SeatServiceValidationResult[]
}

export interface OfferRefreshPrice {
	amount: string
	currency: string
}

export interface OfferRefreshExpectedSnapshot {
	id: string
	totalAmount: string
	totalCurrency: string
	passengers: { id: string }[]
	slices: {
		originCode: string
		destinationCode: string
		segments: {
			id: string
			departureAt: string
			arrivalAt: string
		}[]
	}[]
}

export type OfferRefreshResponse =
	| { status: "valid"; offer: FlightOffer }
	| {
			status: "price_changed"
			previousPrice: OfferRefreshPrice
			currentPrice: OfferRefreshPrice
			offer: FlightOffer
	  }
	| {
			status: "itinerary_changed"
			materialDifferences: string[]
			priceChanged: boolean
			previousPrice: OfferRefreshPrice
			currentPrice: OfferRefreshPrice
			offer: FlightOffer
	  }
	| { status: "unavailable"; code: string; message: string }
