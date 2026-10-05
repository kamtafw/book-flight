declare namespace AppConfig {
	type TripType = "one-way" | "round" | "multi-city"

	type CabinClass = "economy" | "premium-economy" | "business" | "first"

	type PassengerType = "adults" | "children" | "infants"

	type AirportField = "from" | "to"

	interface Airport {
		code: string
		city: string
		name: string
		country: string
	}

	interface PassengerCounts {
		adults: number
		children: number
		infants: number
	}

	interface Flight {
		id: string
		airline: string
		flightNumber: string
		departureTime: string
		arrivalTime: string
		duration: string
		price: number
		currency: string
	}

	type SeatStatus = "available" | "reserved" | "emergency"

	interface Seat {
		id: string
		row: number
		column: "A" | "B" | "C" | "D"
		status: SeatStatus
	}
}
