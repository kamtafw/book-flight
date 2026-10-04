declare namespace AppConfig {
	type TripType = "one-way" | "round" | "multi-city"

	type AirportField = "from" | "to"

	interface Airport {
		code: string
		city: string
		name: string
		country: string
	}
}
