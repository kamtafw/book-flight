import address from "@/assets/icons/address.png"
import airplaneInFlight from "@/assets/icons/airplane-in-flight.png"
import airplaneLanding from "@/assets/icons/airplane-landing.png"
import airplaneTakeoff from "@/assets/icons/airplane-takeoff.png"
import arrowDown from "@/assets/icons/arrow-down.png"
import arrowLeft from "@/assets/icons/arrow-left.png"
import arrowsDownUp from "@/assets/icons/arrows-down-up.png"
import bank from "@/assets/icons/bank.png"
import bookings from "@/assets/icons/bookings.png"
import bus from "@/assets/icons/bus.png"
import calendar from "@/assets/icons/calendar.png"
import cancel from "@/assets/icons/cancel.png"
import chair from "@/assets/icons/chair.png"
import clock from "@/assets/icons/clock.png"
import dob from "@/assets/icons/dob.png"
import eye from "@/assets/icons/eye.png"
import eyeoff from "@/assets/icons/eyeoff.png"
import flag from "@/assets/icons/flag.png"
import globe from "@/assets/icons/globe.png"
import home from "@/assets/icons/home.png"
import hotel from "@/assets/icons/hotel.png"
import inbox from "@/assets/icons/inbox.png"
import map from "@/assets/icons/map.png"
import minus from "@/assets/icons/minus.png"
import offer2 from "@/assets/icons/offer-2.png"
import offer from "@/assets/icons/offer.png"
import passport from "@/assets/icons/passport.png"
import plus from "@/assets/icons/plus.png"
import rate from "@/assets/icons/rate.png"
import separator from "@/assets/icons/separator.png"
import support from "@/assets/icons/support.png"
import ticket from "@/assets/icons/ticket.png"
import travel from "@/assets/icons/travel.png"
import user from "@/assets/icons/user.png"

export const tripOptions: { value: AppConfig.TripType; label: string }[] = [
	{ value: "one-way", label: "One Way" },
	{ value: "round", label: "Round" },
	{ value: "multi-city", label: "Multi City" },
]

export const cabinOptions: { value: AppConfig.CabinClass; label: string; description: string }[] = [
	{
		value: "economy",
		label: "Economy",
		description: "Standard seating and services",
	},
	{
		value: "premium-economy",
		label: "Premium Economy",
		description: "More space and added comfort",
	},
	{
		value: "business",
		label: "Business",
		description: "Premium seating and services",
	},
	{
		value: "first",
		label: "First Class",
		description: "The highest level of comfort",
	},
]

export const passengerRows: {
	type: AppConfig.PassengerType
	label: string
	description: string
}[] = [
	{
		type: "adults",
		label: "Adults",
		description: "12 years and above",
	},
	{
		type: "children",
		label: "Children",
		description: "2 - 11 years",
	},
	{
		type: "infants",
		label: "Infants",
		description: "Under 2 years",
	},
]

export const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
]

export const countries: AppConfig.Country[] = [
	{ code: "AU", name: "Australia", flag: "🇦🇺" },
	{ code: "BR", name: "Brazil", flag: "🇧🇷" },
	{ code: "CA", name: "Canada", flag: "🇨🇦" },
	{ code: "CN", name: "China", flag: "🇨🇳" },
	{ code: "EG", name: "Egypt", flag: "🇪🇬" },
	{ code: "FR", name: "France", flag: "🇫🇷" },
	{ code: "DE", name: "Germany", flag: "🇩🇪" },
	{ code: "GH", name: "Ghana", flag: "🇬🇭" },
	{ code: "IN", name: "India", flag: "🇮🇳" },
	{ code: "IE", name: "Ireland", flag: "🇮🇪" },
	{ code: "IT", name: "Italy", flag: "🇮🇹" },
	{ code: "JP", name: "Japan", flag: "🇯🇵" },
	{ code: "KE", name: "Kenya", flag: "🇰🇪" },
	{ code: "NL", name: "Netherlands", flag: "🇳🇱" },
	{ code: "NG", name: "Nigeria", flag: "🇳🇬" },
	{ code: "ZA", name: "South Africa", flag: "🇿🇦" },
	{ code: "ES", name: "Spain", flag: "🇪🇸" },
	{ code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
	{ code: "GB", name: "United Kingdom", flag: "🇬🇧" },
	{ code: "US", name: "United States", flag: "🇺🇸" },
].sort((a, b) => a.name.localeCompare(b.name))

export const defaultAvatar = { uri: "https://i.pravatar.cc/256?img=12" }

export const defaultPickerDate = new Date(2000, 0, 1)

export const images = {
	address,
	airplaneInFlight,
	airplaneLanding,
	airplaneTakeoff,
	arrowDown,
	arrowLeft,
	arrowsDownUp,
	bank,
	bookings,
	bus,
	calendar,
	chair,
	cancel,
	clock,
	dob,
	eye,
	eyeoff,
	flag,
	globe,
	home,
	hotel,
	inbox,
	map,
	minus,
	offer2,
	offer,
	passport,
	plus,
	rate,
	separator,
	support,
	ticket,
	travel,
	user,
}
