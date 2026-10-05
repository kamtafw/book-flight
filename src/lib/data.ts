export const airports: AppConfig.Airport[] = [
	{
		code: "LOS",
		city: "Lagos",
		name: "Murtala Muhammed International Airport",
		country: "Nigeria",
	},
	{
		code: "ABV",
		city: "Abuja",
		name: "Nnamdi Azikiwe International Airport",
		country: "Nigeria",
	},
	{
		code: "KAN",
		city: "Kano",
		name: "Mallam Aminu Kano International Airport",
		country: "Nigeria",
	},
	{
		code: "PHC",
		city: "Port Harcourt",
		name: "Port Harcourt International Airport",
		country: "Nigeria",
	},
	{
		code: "DXB",
		city: "Dubai",
		name: "Dubai International Airport",
		country: "United Arab Emirates",
	},
]

export const mockFlights: AppConfig.Flight[] = [
	{
		id: "flight-1",
		airline: "IndiGo",
		flightNumber: "IN 230",
		departureTime: "5:50",
		arrivalTime: "7:30",
		duration: "01 hr 40min",
		price: 230,
		currency: "$",
	},
	{
		id: "flight-2",
		airline: "Delta",
		flightNumber: "IN 230",
		departureTime: "4:30",
		arrivalTime: "6:30",
		duration: "01 hr 40min",
		price: 360,
		currency: "$",
	},
	{
		id: "flight-3",
		airline: "Air India",
		flightNumber: "AI 412",
		departureTime: "8:15",
		arrivalTime: "10:05",
		duration: "01 hr 50min",
		price: 275,
		currency: "$",
	},
]

const reservedSeats = new Set(["1A", "1D", "2C", "4B", "7A", "9D"])

const emergencyRows = new Set([5, 6])

export const seats: AppConfig.Seat[] = Array.from({ length: 12 }, (_, index) => {
	const row = index + 1

	return ["A", "B", "C", "D"].map((column) => {
		const id = `${row}${column}`

		return {
			id,
			row,
			column: column as AppConfig.Seat["column"],
			status: (reservedSeats.has(id)
				? "reserved"
				: emergencyRows.has(row)
					? "emergency"
					: "available") as AppConfig.SeatStatus,
		}
	})
}).flat()
