export interface Money {
	/** Base-10 decimal amount. Scientific notation and floating-point numbers are not accepted. */
	amount: string
	/** ISO 4217-style uppercase currency code. */
	currency: string
}

export interface PricingComponent {
	id: string
	kind: "flight_fare" | "seat" | "additional_service"
	label: string
	money: Money
}

export interface CheckoutPricingInput {
	flightFare: Money
	seats: PricingComponent[]
	additionalServices?: PricingComponent[]
}

export interface CheckoutPricingTotals {
	status: "complete"
	currency: string
	flightFare: Money
	seatSubtotal: Money
	additionalServicesSubtotal: Money
	total: Money
	components: PricingComponent[]
}

export interface MixedCurrencyCheckoutPricing {
	status: "mixed_currency"
	currencies: string[]
	components: PricingComponent[]
}

export type CheckoutPricingResult = CheckoutPricingTotals | MixedCurrencyCheckoutPricing

interface DecimalValue {
	coefficient: bigint
	scale: number
}

function parseDecimal(amount: string): DecimalValue {
	if (typeof amount !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(amount)) {
		throw new Error("Money amounts must be non-negative base-10 decimal strings.")
	}
	const [whole, fraction = ""] = amount.split(".")
	return {
		coefficient: BigInt(whole + fraction),
		scale: fraction.length,
	}
}

function formatDecimal(value: DecimalValue): string {
	if (value.scale === 0) return value.coefficient.toString()
	const negative = value.coefficient < 0n
	const digits = (negative ? -value.coefficient : value.coefficient)
		.toString()
		.padStart(value.scale + 1, "0")
	const whole = digits.slice(0, -value.scale)
	const fraction = digits.slice(-value.scale)
	return `${negative ? "-" : ""}${whole}.${fraction}`
}

function validateMoney(value: Money): { money: Money; decimal: DecimalValue } {
	if (!value || typeof value !== "object") throw new Error("A money value is required.")
	if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) {
		throw new Error("Money must use a three-letter uppercase currency code.")
	}
	const decimal = parseDecimal(value.amount)
	return { money: { amount: value.amount, currency: value.currency }, decimal }
}

function alignDecimals(left: DecimalValue, right: DecimalValue) {
	const scale = Math.max(left.scale, right.scale)
	return {
		left: left.coefficient * 10n ** BigInt(scale - left.scale),
		right: right.coefficient * 10n ** BigInt(scale - right.scale),
		scale,
	}
}

/** Exact addition. Output precision is the maximum input decimal scale. */
export function addMoney(left: Money, right: Money): Money {
	const a = validateMoney(left)
	const b = validateMoney(right)
	if (a.money.currency !== b.money.currency) {
		throw new Error("Cannot add money values with different currencies.")
	}
	const aligned = alignDecimals(a.decimal, b.decimal)
	return {
		amount: formatDecimal({ coefficient: aligned.left + aligned.right, scale: aligned.scale }),
		currency: a.money.currency,
	}
}

/** Exact subtraction. The result may be negative because it represents a difference. */
export function subtractMoney(current: Money, previous: Money): Money {
	const a = validateMoney(current)
	const b = validateMoney(previous)
	if (a.money.currency !== b.money.currency) {
		throw new Error("Cannot subtract money values with different currencies.")
	}
	const aligned = alignDecimals(a.decimal, b.decimal)
	return {
		amount: formatDecimal({ coefficient: aligned.left - aligned.right, scale: aligned.scale }),
		currency: a.money.currency,
	}
}

function sumSameCurrency(values: Money[], currency: string, zeroScale: number): Money {
	let total = 0n
	let scale = zeroScale
	for (const value of values) {
		const validated = validateMoney(value)
		if (validated.money.currency !== currency) {
			throw new Error("Cannot total money values with different currencies.")
		}
		scale = Math.max(scale, validated.decimal.scale)
	}
	for (const value of values) {
		const decimal = parseDecimal(value.amount)
		total += decimal.coefficient * 10n ** BigInt(scale - decimal.scale)
	}
	return { amount: formatDecimal({ coefficient: total, scale }), currency }
}

function cloneComponent(component: PricingComponent): PricingComponent {
	if (!component.id.trim() || !component.label.trim()) {
		throw new Error("Pricing components require an ID and a display label.")
	}
	if (component.kind !== "flight_fare" && component.kind !== "seat" && component.kind !== "additional_service") {
		throw new Error("Pricing component has an unsupported kind.")
	}
	const validated = validateMoney(component.money)
	return { ...component, money: validated.money }
}

/**
 * Calculates the checkout total only when every component uses the flight fare currency.
 * Mixed-currency components are returned individually without a fabricated grand total.
 */
export function calculateCheckoutPricing(input: CheckoutPricingInput): CheckoutPricingResult {
	const flightFare = validateMoney(input.flightFare).money
	const seats = input.seats.map(cloneComponent)
	const additionalServices = (input.additionalServices ?? []).map(cloneComponent)
	if (seats.some((component) => component.kind !== "seat")) {
		throw new Error("Seat pricing may contain only seat components.")
	}
	if (additionalServices.some((component) => component.kind !== "additional_service")) {
		throw new Error("Additional-service pricing contains an invalid component kind.")
	}
	const components: PricingComponent[] = [
		{ id: "flight-fare", kind: "flight_fare", label: "Flight fare", money: flightFare },
		...seats,
		...additionalServices,
	]
	const currencies = [...new Set(components.map((component) => component.money.currency))].sort()
	if (currencies.length !== 1) {
		return { status: "mixed_currency", currencies, components }
	}
	const seatSubtotal = sumSameCurrency(
		seats.map((component) => component.money),
		flightFare.currency,
		parseDecimal(flightFare.amount).scale,
	)
	const additionalServicesSubtotal = sumSameCurrency(
		additionalServices.map((component) => component.money),
		flightFare.currency,
		parseDecimal(flightFare.amount).scale,
	)
	const total = sumSameCurrency(
		components.map((component) => component.money),
		flightFare.currency,
		parseDecimal(flightFare.amount).scale,
	)
	return {
		status: "complete",
		currency: flightFare.currency,
		flightFare,
		seatSubtotal,
		additionalServicesSubtotal,
		total,
		components,
	}
}
