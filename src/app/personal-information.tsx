/* eslint-disable react-hooks/set-state-in-effect */
import { CountrySelectorModal } from "@/components/country-selector-modal"
import { FieldShell, FloatingInput } from "@/components/floating-label-input"
import { countries, defaultPickerDate } from "@/constants"
import type {
	Passenger,
	PassengerContact,
	PassengerRelationship,
	TravelDocument,
} from "@/lib/booking/passengers/passenger-domain"
import {
	validateDuffelPassengers,
	type PassengerValidationIssue,
	type PassengerValidationResult,
} from "@/lib/booking/passengers/providers/duffel/passenger-validation"
import { useFlightBookingStore } from "@/store/flight-booking.store"
import { useFlightOffersStore } from "@/store/flight-offers.store"
import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { clsx } from "clsx"
import { router, useLocalSearchParams } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native"
import DateTimePickerModal from "react-native-modal-datetime-picker"
import { SafeAreaView } from "react-native-safe-area-context"

type DateTarget = "dateOfBirth" | "documentExpiration"
type CountryTarget = "nationality" | "documentIssuingCountry"

function formatDate(date: Date) {
	const day = String(date.getDate()).padStart(2, "0")
	const month = String(date.getMonth() + 1).padStart(2, "0")
	return `${date.getFullYear()}-${month}-${day}`
}

function parseDate(value?: string): Date | null {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
	const [year, month, day] = value.split("-").map(Number)
	const date = new Date(year, month - 1, day)
	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
		return null
	}
	return date
}

function categoryLabel(category: Passenger["category"]) {
	if (category === "adult") return "Adult"
	if (category === "child") return "Child"
	if (category === "infant") return "Infant"
	return "Traveller"
}

function passengerLabels(passengers: Passenger[]) {
	const counts = new Map<string, number>()
	return new Map(
		passengers.map((passenger) => {
			const category = categoryLabel(passenger.category)
			const nextCount = (counts.get(category) ?? 0) + 1
			counts.set(category, nextCount)
			return [passenger.id, `${category} ${nextCount}`] as const
		}),
	)
}

function getContact(passenger: Passenger, type: PassengerContact["type"]) {
	return passenger.contacts.find((contact) => contact.type === type)
}

function getDocument(passenger: Passenger): TravelDocument | undefined {
	return passenger.travelDocuments[0]
}

function ChoiceChip({
	label,
	selected,
	onPress,
}: {
	label: string
	selected: boolean
	onPress: () => void
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			className={clsx(
				"rounded-full border px-3 py-2",
				selected ? "border-primary bg-primary" : "border-border bg-white",
			)}
		>
			<Text
				className={clsx("font-inter-medium text-xs", selected ? "text-white" : "text-gray-200")}
			>
				{label}
			</Text>
		</Pressable>
	)
}

function FieldLabel({ children }: { children: string }) {
	return <Text className="mb-2 font-inter-medium text-sm text-gray-200">{children}</Text>
}

function PassengerCard({
	passenger,
	label,
	passengers,
	relationships,
	issues,
	expanded,
	onToggle,
	onIdentityChange,
	onContactChange,
	onDocumentChange,
	onResponsibleAdultChange,
	onOpenDate,
	onOpenCountry,
}: {
	passenger: Passenger
	label: string
	passengers: Passenger[]
	relationships: PassengerRelationship[]
	issues: PassengerValidationIssue[]
	expanded: boolean
	onToggle: () => void
	onIdentityChange: (passengerId: string, field: keyof Passenger["identity"], value: string) => void
	onContactChange: (
		passengerId: string,
		type: PassengerContact["type"],
		value: string,
		belongsTo: "passenger" | "other",
		relatedPersonPassengerId?: string,
	) => void
	onDocumentChange: (passengerId: string, document: Omit<TravelDocument, "id">) => void
	onResponsibleAdultChange: (passengerId: string, adultPassengerId: string | null) => void
	onOpenDate: (passengerId: string, target: DateTarget) => void
	onOpenCountry: (passengerId: string, target: CountryTarget) => void
}) {
	const identity = passenger.identity
	const document = getDocument(passenger)
	const email = getContact(passenger, "email")
	const phone = getContact(passenger, "phone")
	const responsibleAdultId = relationships.find(
		(relationship) =>
			relationship.type === "responsible_adult" && relationship.passengerId === passenger.id,
	)?.relatedPassengerId
	const adultPassengers = passengers.filter(
		(item) => item.category === "adult" && item.id !== passenger.id,
	)
	const displayName = [identity.givenName, identity.familyName].filter(Boolean).join(" ")

	const updateDocument = (patch: Partial<Omit<TravelDocument, "id">>) => {
		onDocumentChange(passenger.id, {
			type: document?.type ?? "",
			documentNumber: document?.documentNumber ?? "",
			issuingCountry: document?.issuingCountry ?? "",
			expirationDate: document?.expirationDate ?? "",
			...patch,
		})
	}

	const updateContactOwner = (
		type: PassengerContact["type"],
		belongsTo: "passenger" | "other",
		relatedPersonPassengerId?: string,
	) => {
		const current = type === "email" ? email : phone
		onContactChange(passenger.id, type, current?.value ?? "", belongsTo, relatedPersonPassengerId)
	}

	return (
		<View className="mb-4 overflow-hidden rounded-2xl border border-border bg-white">
			<Pressable
				onPress={onToggle}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				className="flex-row items-center px-4 py-4"
			>
				<View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-orange-50">
					<Feather
						name={passenger.category === "infant" ? "heart" : "user"}
						size={18}
						color="#EC441E"
					/>
				</View>
				<View className="flex-1">
					<Text className="font-inter-semibold text-base text-black">{label}</Text>
					<Text className="mt-0.5 font-inter text-xs text-gray-200">
						{displayName || "Passenger details not added"}
					</Text>
					{issues.length > 0 ? (
						<Text className="mt-1 font-inter-medium text-xs text-red-600">
							{issues.length} item{issues.length === 1 ? "" : "s"} need attention
						</Text>
					) : null}
				</View>
				<Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#737373" />
			</Pressable>

			{expanded ? (
				<View className="gap-y-5 border-t border-border px-4 pb-5 pt-5">
					{issues.length > 0 ? (
						<View className="gap-y-2 rounded-xl border border-red-100 bg-red-50 p-3">
							<Text className="font-inter-semibold text-sm text-red-700">
								Review these details
							</Text>
							{issues.map((issue, index) => (
								<Text key={`${issue.code}-${issue.field ?? "general"}-${index}`} className="font-inter text-xs leading-5 text-red-700">
									{issue.message}
								</Text>
							))}
						</View>
					) : null}
					<View className="gap-y-4">
						<Text className="font-inter-semibold text-sm text-black">Personal details</Text>
						<FloatingInput
							label="Given name"
							icon={<FontAwesome5 name="address-card" size={17} color="#999" />}
							value={identity.givenName ?? ""}
							onChangeText={(value) => onIdentityChange(passenger.id, "givenName", value)}
							autoCapitalize="words"
							autoComplete="given-name"
							textContentType="givenName"
						/>
						<FloatingInput
							label="Middle name (optional)"
							icon={<FontAwesome5 name="address-card" size={17} color="#999" />}
							value={identity.middleName ?? ""}
							onChangeText={(value) => onIdentityChange(passenger.id, "middleName", value)}
							autoCapitalize="words"
						/>
						<FloatingInput
							label="Family name"
							icon={<FontAwesome5 name="address-card" size={17} color="#999" />}
							value={identity.familyName ?? ""}
							onChangeText={(value) => onIdentityChange(passenger.id, "familyName", value)}
							autoCapitalize="words"
							autoComplete="family-name"
							textContentType="familyName"
						/>
						<View className="flex-row gap-3">
							<View className="flex-1">
								<FloatingInput
									label="Title"
									icon={<Feather name="user" size={18} color="#999" />}
									value={identity.title ?? ""}
									onChangeText={(value) => onIdentityChange(passenger.id, "title", value)}
									autoCapitalize="characters"
									placeholder="Mr, Ms..."
								/>
							</View>
							<View className="flex-1">
								<FloatingInput
									label="Gender"
									icon={<Feather name="users" size={18} color="#999" />}
									value={identity.gender ?? ""}
									onChangeText={(value) => onIdentityChange(passenger.id, "gender", value)}
									autoCapitalize="none"
									placeholder="Male, female..."
								/>
							</View>
						</View>

						<Pressable onPress={() => onOpenDate(passenger.id, "dateOfBirth")}>
							<FieldShell
								label="Date of birth"
								icon={<MaterialCommunityIcons name="cake-variant-outline" size={19} color="#999" />}
								trailingIcon={<Ionicons name="calendar-outline" size={19} color="#999" />}
							>
								<Text
									className={clsx(
										"flex-1 text-base font-inter",
										identity.dateOfBirth ? "text-gray-200" : "text-gray-400",
									)}
								>
									{identity.dateOfBirth || "Select date of birth"}
								</Text>
							</FieldShell>
						</Pressable>

						<View>
							<FieldLabel>Nationality</FieldLabel>
							<Pressable
								onPress={() => onOpenCountry(passenger.id, "nationality")}
								className="h-14 flex-row items-center rounded-xl border border-border px-4"
							>
								<FontAwesome5 name="globe-africa" size={18} color="#999" />
								<Text
									className={clsx(
										"ml-3 flex-1 font-inter text-base",
										identity.nationality ? "text-gray-200" : "text-gray-400",
									)}
								>
									{countries.find((country) => country.code === identity.nationality)?.name ??
										identity.nationality ??
										"Select nationality"}
								</Text>
								<Feather name="chevron-down" size={17} color="#999" />
							</Pressable>
						</View>
					</View>

					<View className="gap-y-4">
						<View>
							<Text className="font-inter-semibold text-sm text-black">Contact information</Text>
							<Text className="mt-1 font-inter text-xs leading-5 text-gray-200">
								Enter this traveller&apos;s contact details, or identify an adult traveller whose
								contact details are being supplied.
							</Text>
						</View>

						<View className="gap-y-2">
							<FloatingInput
								label="Email"
								icon={<Feather name="mail" size={18} color="#999" />}
								value={email?.value ?? ""}
								onChangeText={(value) =>
									onContactChange(
										passenger.id,
										"email",
										value,
										email?.belongsTo ?? "passenger",
										email?.relatedPersonPassengerId,
									)
								}
								autoCapitalize="none"
								autoComplete="email"
								keyboardType="email-address"
								textContentType="emailAddress"
							/>
							<View className="flex-row flex-wrap gap-2">
								<ChoiceChip
									label="Traveller's own contact"
									selected={(email?.belongsTo ?? "passenger") === "passenger"}
									onPress={() => updateContactOwner("email", "passenger")}
								/>
								<ChoiceChip
									label="Another traveller's contact"
									selected={email?.belongsTo === "other"}
									onPress={() =>
										updateContactOwner("email", "other", email?.relatedPersonPassengerId)
									}
								/>
							</View>
							{email?.belongsTo === "other" ? (
								<View className="gap-y-2 rounded-xl bg-background p-3">
									<Text className="font-inter-medium text-xs text-gray-200">
										Whose email address is this?
									</Text>
									<View className="flex-row flex-wrap gap-2">
										{adultPassengers.map((adult) => (
											<ChoiceChip
												key={adult.id}
												label={
													[adult.identity.givenName, adult.identity.familyName]
														.filter(Boolean)
														.join(" ") || "Adult traveller"
												}
												selected={email.relatedPersonPassengerId === adult.id}
												onPress={() => updateContactOwner("email", "other", adult.id)}
											/>
										))}
									</View>
									{adultPassengers.length === 0 ? (
										<Text className="font-inter text-xs text-gray-200">
											There is no adult traveller in this booking to associate with this contact.
										</Text>
									) : null}
								</View>
							) : null}
						</View>

						<View className="gap-y-2">
							<FloatingInput
								label="Phone"
								icon={<Feather name="phone" size={18} color="#999" />}
								value={phone?.value ?? ""}
								onChangeText={(value) =>
									onContactChange(
										passenger.id,
										"phone",
										value,
										phone?.belongsTo ?? "passenger",
										phone?.relatedPersonPassengerId,
									)
								}
								autoComplete="tel"
								keyboardType="phone-pad"
								textContentType="telephoneNumber"
							/>
							<View className="flex-row flex-wrap gap-2">
								<ChoiceChip
									label="Traveller's own contact"
									selected={(phone?.belongsTo ?? "passenger") === "passenger"}
									onPress={() => updateContactOwner("phone", "passenger")}
								/>
								<ChoiceChip
									label="Another traveller's contact"
									selected={phone?.belongsTo === "other"}
									onPress={() =>
										updateContactOwner("phone", "other", phone?.relatedPersonPassengerId)
									}
								/>
							</View>
							{phone?.belongsTo === "other" ? (
								<View className="gap-y-2 rounded-xl bg-background p-3">
									<Text className="font-inter-medium text-xs text-gray-200">
										Whose phone number is this?
									</Text>
									<View className="flex-row flex-wrap gap-2">
										{adultPassengers.map((adult) => (
											<ChoiceChip
												key={adult.id}
												label={
													[adult.identity.givenName, adult.identity.familyName]
														.filter(Boolean)
														.join(" ") || "Adult traveller"
												}
												selected={phone.relatedPersonPassengerId === adult.id}
												onPress={() => updateContactOwner("phone", "other", adult.id)}
											/>
										))}
									</View>
									{adultPassengers.length === 0 ? (
										<Text className="font-inter text-xs text-gray-200">
											There is no adult traveller in this booking to associate with this contact.
										</Text>
									) : null}
								</View>
							) : null}
						</View>
					</View>

					<View className="gap-y-4">
						<View>
							<Text className="font-inter-semibold text-sm text-black">
								Travel document <Text className="font-inter text-gray-200">(optional)</Text>
							</Text>
							<Text className="mt-1 font-inter text-xs leading-5 text-gray-200">
								Document requirements depend on the airline and itinerary. You can leave these
								fields blank when they are not required.
							</Text>
						</View>
						<FloatingInput
							label="Document type"
							icon={<FontAwesome5 name="passport" size={17} color="#999" />}
							value={document?.type ?? ""}
							onChangeText={(value) => updateDocument({ type: value })}
							autoCapitalize="words"
							placeholder="Passport"
						/>
						<FloatingInput
							label="Document number"
							icon={<FontAwesome5 name="id-card" size={17} color="#999" />}
							value={document?.documentNumber ?? ""}
							onChangeText={(value) => updateDocument({ documentNumber: value })}
							autoCapitalize="characters"
							autoCorrect={false}
						/>
						<View>
							<FieldLabel>Issuing country</FieldLabel>
							<Pressable
								onPress={() => onOpenCountry(passenger.id, "documentIssuingCountry")}
								className="h-14 flex-row items-center rounded-xl border border-border px-4"
							>
								<FontAwesome5 name="globe-africa" size={18} color="#999" />
								<Text
									className={clsx(
										"ml-3 flex-1 font-inter text-base",
										document?.issuingCountry ? "text-gray-200" : "text-gray-400",
									)}
								>
									{countries.find((country) => country.code === document?.issuingCountry)?.name ??
										document?.issuingCountry ??
										"Select issuing country"}
								</Text>
								<Feather name="chevron-down" size={17} color="#999" />
							</Pressable>
						</View>
						<Pressable onPress={() => onOpenDate(passenger.id, "documentExpiration")}>
							<FieldShell
								label="Document expiry date"
								icon={<Feather name="calendar" size={18} color="#999" />}
								trailingIcon={<Ionicons name="calendar-outline" size={19} color="#999" />}
							>
								<Text
									className={clsx(
										"flex-1 text-base font-inter",
										document?.expirationDate ? "text-gray-200" : "text-gray-400",
									)}
								>
									{document?.expirationDate || "Select expiry date"}
								</Text>
							</FieldShell>
						</Pressable>
					</View>

					{passenger.category === "infant" ? (
						<View className="gap-y-3 rounded-xl border border-orange-100 bg-orange-50 p-4">
							<View>
								<Text className="font-inter-semibold text-sm text-black">Responsible adult</Text>
								<Text className="mt-1 font-inter text-xs leading-5 text-gray-200">
									Choose the adult travelling with this infant. This records the relationship; it
									does not confirm airline acceptance.
								</Text>
							</View>
							<View className="flex-row flex-wrap gap-2">
								{adultPassengers.map((adult) => (
									<ChoiceChip
										key={adult.id}
										label={
											[adult.identity.givenName, adult.identity.familyName]
												.filter(Boolean)
												.join(" ") || "Adult traveller"
										}
										selected={responsibleAdultId === adult.id}
										onPress={() => onResponsibleAdultChange(passenger.id, adult.id)}
									/>
								))}
							</View>
							{adultPassengers.length === 0 ? (
								<Text className="font-inter text-xs text-gray-200">
									No adult passenger is available in this offer.
								</Text>
							) : null}
							{responsibleAdultId ? (
								<Pressable onPress={() => onResponsibleAdultChange(passenger.id, null)}>
									<Text className="font-inter-medium text-xs text-primary">Clear selection</Text>
								</Pressable>
							) : null}
						</View>
					) : null}
				</View>
			) : null}
		</View>
	)
}

export default function PersonalInformationScreen() {
	const { flightId } = useLocalSearchParams<{ flightId?: string }>()
	const flight = useFlightOffersStore((state) =>
		state.offers.find((offer) => offer.id === flightId),
	)
	const passengerCollection = useFlightBookingStore((state) => state.passengerCollection)
	const initializePassengerCollection = useFlightBookingStore(
		(state) => state.initializePassengerCollection,
	)
	const updatePassengerIdentity = useFlightBookingStore((state) => state.updatePassengerIdentity)
	const setPassengerContact = useFlightBookingStore((state) => state.setPassengerContact)
	const setPassengerTravelDocument = useFlightBookingStore(
		(state) => state.setPassengerTravelDocument,
	)
	const setResponsibleAdult = useFlightBookingStore((state) => state.setResponsibleAdult)

	const [expandedPassengerIds, setExpandedPassengerIds] = useState<string[]>([])
	const [datePicker, setDatePicker] = useState<{
		passengerId: string
		target: DateTarget
	} | null>(null)
	const [countryPicker, setCountryPicker] = useState<{
		passengerId: string
		target: CountryTarget
	} | null>(null)

	useEffect(() => {
		if (flight && flight.passengers?.length) initializePassengerCollection(flight)
	}, [flight, initializePassengerCollection])

	const activeCollection = useMemo(() => {
		if (!passengerCollection || !flightId) return null
		const allBelongToOffer = passengerCollection.passengers.every((passenger) =>
			passenger.providerReferences.some(
				(reference) => reference.provider === "duffel" && reference.offerId === flightId,
			),
		)
		return allBelongToOffer ? passengerCollection : null
	}, [flightId, passengerCollection])

	const validationResult = useMemo<PassengerValidationResult>(() => {
		if (!flight || !activeCollection) {
			return { status: "draft", issues: [] }
		}
		try {
			return validateDuffelPassengers(flight, activeCollection)
		} catch {
			return {
				status: "draft",
				issues: [
					{
						code: "VALIDATION_UNAVAILABLE",
						stage: "local",
						severity: "error",
						message: "Passenger requirements could not be evaluated for this offer. Return and select the offer again.",
					},
				],
			}
		}
	}, [activeCollection, flight])

	useEffect(() => {
		if (activeCollection?.passengers.length) {
			setExpandedPassengerIds((current) =>
				current.length > 0 &&
				current.some((id) => activeCollection.passengers.some((item) => item.id === id))
					? current
					: [activeCollection.passengers[0].id],
			)
		}
	}, [activeCollection])

	const labels = useMemo(
		() => passengerLabels(activeCollection?.passengers ?? []),
		[activeCollection],
	)

	const selectedDate = useMemo(() => {
		if (!datePicker || !activeCollection) return defaultPickerDate
		const passenger = activeCollection.passengers.find((item) => item.id === datePicker.passengerId)
		if (!passenger) return defaultPickerDate
		const value =
			datePicker.target === "dateOfBirth"
				? passenger.identity.dateOfBirth
				: getDocument(passenger)?.expirationDate
		return parseDate(value) ?? defaultPickerDate
	}, [activeCollection, datePicker])

	const selectedCountry = useMemo(() => {
		if (!countryPicker || !activeCollection) return undefined
		const passenger = activeCollection.passengers.find(
			(item) => item.id === countryPicker.passengerId,
		)
		if (!passenger) return undefined
		return countryPicker.target === "nationality"
			? passenger.identity.nationality
			: getDocument(passenger)?.issuingCountry
	}, [activeCollection, countryPicker])

	const handleIdentityChange = useCallback(
		(passengerId: string, field: keyof Passenger["identity"], value: string) => {
			updatePassengerIdentity(passengerId, { [field]: value })
		},
		[updatePassengerIdentity],
	)

	const handleContactChange = useCallback(
		(
			passengerId: string,
			type: PassengerContact["type"],
			value: string,
			belongsTo: "passenger" | "other",
			relatedPersonPassengerId?: string,
		) => {
			setPassengerContact(passengerId, type, value, belongsTo, relatedPersonPassengerId)
		},
		[setPassengerContact],
	)

	const handleDocumentChange = useCallback(
		(passengerId: string, document: Omit<TravelDocument, "id">) => {
			setPassengerTravelDocument(passengerId, document)
		},
		[setPassengerTravelDocument],
	)

	const handleDateConfirm = useCallback(
		(date: Date) => {
			if (!datePicker || !activeCollection) return
			const passenger = activeCollection.passengers.find(
				(item) => item.id === datePicker.passengerId,
			)
			if (!passenger) return
			const value = formatDate(date)
			if (datePicker.target === "dateOfBirth") {
				updatePassengerIdentity(passenger.id, { dateOfBirth: value })
			} else {
				const document = getDocument(passenger)
				setPassengerTravelDocument(passenger.id, {
					type: document?.type ?? "",
					documentNumber: document?.documentNumber ?? "",
					issuingCountry: document?.issuingCountry ?? "",
					expirationDate: value,
				})
			}
			setDatePicker(null)
		},
		[activeCollection, datePicker, setPassengerTravelDocument, updatePassengerIdentity],
	)

	const handleCountrySelect = useCallback(
		(country: AppConfig.Country) => {
			if (!countryPicker || !activeCollection) return
			const passenger = activeCollection.passengers.find(
				(item) => item.id === countryPicker.passengerId,
			)
			if (!passenger) return
			if (countryPicker.target === "nationality") {
				updatePassengerIdentity(passenger.id, { nationality: country.code })
			} else {
				const document = getDocument(passenger)
				setPassengerTravelDocument(passenger.id, {
					type: document?.type ?? "",
					documentNumber: document?.documentNumber ?? "",
					issuingCountry: country.code,
					expirationDate: document?.expirationDate ?? "",
				})
			}
			setCountryPicker(null)
		},
		[activeCollection, countryPicker, setPassengerTravelDocument, updatePassengerIdentity],
	)

	const togglePassenger = (passengerId: string) => {
		setExpandedPassengerIds((current) =>
			current.includes(passengerId)
				? current.filter((id) => id !== passengerId)
				: [...current, passengerId],
		)
	}

	if (!flight || !flightId) {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">Flight unavailable</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					Return to your search and select an available flight before entering passenger details.
				</Text>
				<Pressable onPress={() => router.back()} className="mt-5 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Go back</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (!flight.passengers?.length) {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
				<Text className="font-inter-semibold text-lg text-black">
					Passenger details unavailable
				</Text>
				<Text className="mt-2 text-center font-inter text-sm leading-5 text-gray-200">
					This offer did not include passenger identities. Go back and select another offer.
				</Text>
				<Pressable onPress={() => router.back()} className="mt-5 rounded-xl bg-primary px-6 py-3">
					<Text className="font-inter-medium text-white">Go back</Text>
				</Pressable>
			</SafeAreaView>
		)
	}

	if (!activeCollection) {
		return (
			<SafeAreaView className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" color="#EC441E" />
				<Text className="mt-3 font-inter text-sm text-gray-200">Preparing passenger details…</Text>
			</SafeAreaView>
		)
	}

	return (
		<SafeAreaView className="flex-1 bg-background">
			<View className="flex-row items-center px-5 py-4">
				<Pressable
					onPress={() => router.back()}
					className="h-10 w-10 items-center justify-center"
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel="Go back"
				>
					<Feather name="chevron-left" size={28} color="#191919" />
				</Pressable>
				<Text className="mr-10 flex-1 text-center font-inter-medium text-xl text-black">
					Passenger details
				</Text>
			</View>

			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<ScrollView
					className="flex-1"
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					contentContainerClassName="px-5 pb-6"
				>
					<View className="mb-5 rounded-2xl border border-border bg-white p-4">
						<Text className="font-inter-semibold text-base text-black">
							{flight.airline} · {flight.flightNumber}
						</Text>
						<Text className="mt-1 font-inter text-xs text-gray-200">
							{flight.slices[0]?.originCode ?? "Departure"} →{" "}
							{flight.slices[0]?.destinationCode ?? "Arrival"}
						</Text>
						<Text className="mt-3 font-inter text-xs leading-5 text-gray-200">
							Add details for each traveller on this offer. Your changes are held in this booking
							session. Travel documents are optional unless a later provider check says otherwise.
						</Text>
					</View>

					<View className="mb-4 rounded-2xl border border-border bg-white p-4">
						<View className="flex-row items-center justify-between">
							<Text className="font-inter-semibold text-sm text-black">Validation status</Text>
							<Text className={clsx(
								"rounded-full px-3 py-1 font-inter-medium text-xs",
								validationResult.status === "provider_ready"
									? "bg-green-50 text-green-700"
									: validationResult.status === "locally_valid"
										? "bg-amber-50 text-amber-700"
										: "bg-red-50 text-red-700",
							)}>
								{validationResult.status === "provider_ready"
									? "Provider-ready"
									: validationResult.status === "locally_valid"
										? "Local checks passed"
										: "Draft"}
							</Text>
						</View>
						<Text className="mt-2 font-inter text-xs leading-5 text-gray-200">
							{validationResult.status === "provider_ready"
								? "The passenger details satisfy the requirements currently known for this offer. This is not a booking confirmation."
								: validationResult.status === "locally_valid"
									? "Basic details are valid, but one or more provider requirements still need attention or verification."
									: "Some passenger details are missing or locally invalid."}
						</Text>
						{validationResult.issues.filter((issue) => !issue.passengerId).map((issue, index) => (
							<Text key={`global-${issue.code}-${index}`} className="mt-2 font-inter text-xs leading-5 text-red-700">
								{issue.message}
							</Text>
						))}
					</View>

					{activeCollection.passengers.map((passenger) => (
						<PassengerCard
							key={passenger.id}
							passenger={passenger}
							label={labels.get(passenger.id) ?? "Traveller"}
							passengers={activeCollection.passengers}
							relationships={activeCollection.relationships}
							issues={validationResult.issues.filter((issue) => issue.passengerId === passenger.id)}
							expanded={expandedPassengerIds.includes(passenger.id)}
							onToggle={() => togglePassenger(passenger.id)}
							onIdentityChange={handleIdentityChange}
							onContactChange={handleContactChange}
							onDocumentChange={handleDocumentChange}
							onResponsibleAdultChange={setResponsibleAdult}
							onOpenDate={(passengerId, target) => setDatePicker({ passengerId, target })}
							onOpenCountry={(passengerId, target) => setCountryPicker({ passengerId, target })}
						/>
					))}

					<View className="mt-2 rounded-xl border border-orange-100 bg-orange-50 p-4">
						<View className="flex-row items-start gap-2">
							<Feather name="info" size={16} color="#EC441E" style={{ marginTop: 2 }} />
							<Text className="flex-1 font-inter text-xs leading-5 text-gray-200">
								Passenger details are currently saved as an in-memory draft. This step does not
								validate airline requirements, create a booking, or initiate payment.
							</Text>
						</View>
					</View>

					<Pressable
						onPress={() => router.back()}
						className="mt-5 h-14 items-center justify-center rounded-xl bg-primary active:opacity-90"
					>
						<Text className="font-inter-semibold text-base text-white">Save and return</Text>
					</Pressable>
				</ScrollView>
			</KeyboardAvoidingView>

			<DateTimePickerModal
				isVisible={Boolean(datePicker)}
				mode="date"
				date={selectedDate}
				maximumDate={datePicker?.target === "dateOfBirth" ? new Date() : undefined}
				display={Platform.OS === "ios" ? "inline" : "default"}
				themeVariant="light"
				accentColor="#EC441E"
				confirmTextIOS="Confirm"
				cancelTextIOS="Cancel"
				onConfirm={handleDateConfirm}
				onCancel={() => setDatePicker(null)}
			/>

			<CountrySelectorModal
				visible={Boolean(countryPicker)}
				selectedCountry={selectedCountry}
				onSelect={handleCountrySelect}
				onClose={() => setCountryPicker(null)}
			/>
		</SafeAreaView>
	)
}
