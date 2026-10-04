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
}
