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
