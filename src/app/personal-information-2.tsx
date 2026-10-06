import { CountrySelectorModal } from "@/components/country-selector-modal"
import { FieldShell, FloatingInput } from "@/components/floating-label-input"
import { defaultAvatar, defaultPickerDate } from "@/constants"
import { useFlightBookingStore } from "@/store/flight-booking.store"
import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import clsx from "clsx"
import { router } from "expo-router"
import { useCallback, useMemo, useRef, useState } from "react"
import {
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native"
import DateTimePickerModal from "react-native-modal-datetime-picker"
import { SafeAreaView } from "react-native-safe-area-context"

interface PickerButtonProps {
	onPress: () => void
	label: string
}

const PickerConfirmButton = ({ onPress, label }: PickerButtonProps) => (
	<Pressable
		onPress={onPress}
		className="mx-2 mb-2 h-14 items-center justify-center rounded-[10px] bg-primary active:opacity-90"
	>
		<Text className="text-lg font-medium leading-6 text-white">{label}</Text>
	</Pressable>
)

const PickerCancelButton = ({ onPress, label }: PickerButtonProps) => (
	<Pressable
		onPress={onPress}
		className="mx-2 h-14 items-center justify-center rounded-[10px] bg-white active:opacity-80"
	>
		<Text className="text-lg font-medium leading-6 text-primary">{label}</Text>
	</Pressable>
)

function formatDate(date: Date) {
	const day = String(date.getDate()).padStart(2, "0")
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const year = date.getFullYear()

	return `${day}/${month}/${year}`
}

function parseDate(value: string): Date | null {
	const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)

	if (!match) {
		return null
	}

	const [, day, month, year] = match
	const date = new Date(Number(year), Number(month) - 1, Number(day))

	if (
		date.getFullYear() !== Number(year) ||
		date.getMonth() !== Number(month) - 1 ||
		date.getDate() !== Number(day)
	) {
		return null
	}

	return date
}

type PassengerField = keyof AppConfig.PassengerInformation

type PassengerErrors = Partial<Record<PassengerField, string>>

export default function PersonalInformationScreen() {
	const passengerInformation = useFlightBookingStore((state) => state.passengerInformation)
	const setPassengerInformation = useFlightBookingStore((state) => state.setPassengerInformation)

	const [showDobPicker, setShowDobPicker] = useState(false)
	const [showCountryPicker, setShowCountryPicker] = useState(false)

	const [errors, setErrors] = useState<PassengerErrors>({})

	const addressRef = useRef<TextInput>(null)
	const passportRef = useRef<TextInput>(null)

	const dobDate = useMemo(() => {
		return parseDate(passengerInformation.dateOfBirth) ?? defaultPickerDate
	}, [passengerInformation.dateOfBirth])

	const updateField = useCallback(
		(field: PassengerField, value: string) => {
			setPassengerInformation({ [field]: value })

			if (errors[field]) {
				setErrors((current) => {
					if (!current[field]) {
						return current
					}

					const next = { ...current }
					delete next[field]

					return next
				})
			}
		},
		[setPassengerInformation],
	)

	const validate = useCallback((): boolean => {
		const nextErrors: PassengerErrors = {}

		if (!passengerInformation.name.trim()) {
			nextErrors.name = "Enter your name"
		}

		if (!passengerInformation.address.trim()) {
			nextErrors.address = "Enter your address"
		}

		if (!passengerInformation.passport.trim()) {
			nextErrors.passport = "Enter your passport number"
		}

		if (!passengerInformation.dateOfBirth) {
			nextErrors.dateOfBirth = "Select your date of birth"
		}

		if (!passengerInformation.country) {
			nextErrors.country = "Select your country"
		}

		setErrors(nextErrors)

		return Object.keys(nextErrors).length === 0
	}, [passengerInformation])

	const handleConfirm = useCallback(() => {
		if (!validate()) {
			return
		}

		router.push("/payment")
	}, [validate])

	const handleSkip = useCallback(() => {
		router.push("/payment")
	}, [])

	const handleDateConfirm = useCallback(
		(selectedDate: Date) => {
			setShowDobPicker(false)
			updateField("dateOfBirth", formatDate(selectedDate))
		},
		[updateField],
	)

	const handleCountrySelect = useCallback(
		(country: AppConfig.Country) => {
			updateField("country", country.name)
			setShowCountryPicker(false)
		},
		[updateField],
	)

	return (
		<SafeAreaView className="flex-1 bg-background">
			{/* Header */}
			<View className="flex-row items-center px-6 py-4">
				<Pressable
					onPress={() => router.back()}
					className="h-10 w-10 items-center justify-center"
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel="Go back"
				>
					<Feather name="chevron-left" size={28} color="#191919" />
				</Pressable>
				<Text className="flex-1 text-center font-inter-medium text-xl text-black mr-6">
					Personal Info
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
					contentContainerClassName="px-8"
				>
					{/* Traveller */}
					<View className="mt-8 items-center">
						<Image
							source={defaultAvatar}
							className="h-20 w-20 rounded-full bg-gray-300"
							accessibilityLabel="Profile photo"
						/>
						<Text className="mt-2 font-inter-medium text-2xl text-black leading-6">
							Hello Traveler
						</Text>
					</View>

					<View className="mt-7 gap-y-8">
						{/* Name */}
						<FloatingInput
							label="Name"
							placeholder="Enter your name here"
							value={passengerInformation.name}
							onChangeText={(value) => updateField("name", value)}
							autoCapitalize="words"
							autoComplete="name"
							textContentType="name"
							returnKeyType="next"
							onSubmitEditing={() => addressRef.current?.focus()}
							icon={<FontAwesome5 name="address-card" size={19} color="#999" />}
							error={errors.name}
						/>

						{/* Address */}
						<FloatingInput
							ref={addressRef}
							label="Address"
							placeholder="Enter your address"
							value={passengerInformation.address}
							onChangeText={(value) => updateField("address", value)}
							autoComplete="street-address"
							textContentType="fullStreetAddress"
							returnKeyType="next"
							onSubmitEditing={() => passportRef.current?.focus()}
							icon={<FontAwesome5 name="map" size={19} color="#999" />}
							error={errors.address}
						/>

						{/* Passport */}
						<FloatingInput
							ref={passportRef}
							label="Passport"
							placeholder="ED 25265 589"
							value={passengerInformation.passport}
							onChangeText={(value) => updateField("passport", value)}
							autoCapitalize="characters"
							autoCorrect={false}
							returnKeyType="done"
							icon={<FontAwesome5 name="passport" size={19} color="#999" />}
							error={errors.passport}
						/>

						{/* DOB */}
						<Pressable
							onPress={() => setShowDobPicker(true)}
							accessibilityRole="button"
							accessibilityLabel={
								passengerInformation.dateOfBirth
									? `Date of birth, ${passengerInformation.dateOfBirth}`
									: "Date of birth, not selected"
							}
						>
							<FieldShell
								label="DOB"
								focused={showDobPicker}
								hasError={Boolean(errors.dateOfBirth)}
								icon={<MaterialCommunityIcons name="cake-variant-outline" size={19} color="#999" />}
								trailingIcon={<Ionicons name="calendar-outline" size={19} color="#999" />}
							>
								<Text
									className={clsx(
										"flex-1 text-base font-inter",
										passengerInformation.dateOfBirth ? "text-gray-200" : "text-gray-400",
									)}
								>
									{passengerInformation.dateOfBirth || "Select date of birth"}
								</Text>
							</FieldShell>

							{errors.dateOfBirth ? (
								<Text className="mt-1 font-inter-light text-xs text-error">
									{errors.dateOfBirth}
								</Text>
							) : null}
						</Pressable>

						{/* Country */}
						<Pressable
							onPress={() => setShowCountryPicker(true)}
							accessibilityRole="button"
							accessibilityLabel={
								passengerInformation.country
									? `Country, ${passengerInformation.country}`
									: "Country, not selected"
							}
						>
							<FieldShell
								label="Country"
								focused={showCountryPicker}
								hasError={Boolean(errors.country)}
								icon={<FontAwesome5 name="globe-africa" size={19} color="#999" />}
								trailingIcon={<Feather name="chevron-down" size={16} color="#999" />}
							>
								<Text
									className={clsx(
										"flex-1 text-base font-inter",
										passengerInformation.country ? "text-gray-200" : "text-gray-400",
									)}
								>
									{passengerInformation.country || "Select country"}
								</Text>
							</FieldShell>

							{errors.country ? (
								<Text className="mt-1 font-inter-light text-xs text-error">{errors.country}</Text>
							) : null}
						</Pressable>
					</View>

					{/* Actions */}
					<Pressable
						onPress={handleConfirm}
						accessibilityRole="button"
						accessibilityLabel="Confirm personal information"
						className="mt-6 h-14 items-center justify-center rounded-xl bg-primary py-4 active:opacity-90"
					>
						<Text className="font-inter-semibold text-lg text-white">Confirm</Text>
					</Pressable>

					<Pressable
						onPress={handleSkip}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Skip personal information"
						className="mt-3 h-14 items-center justify-center py-4"
					>
						<Text className="font-inter-semibold text-lg text-primary">Skip</Text>
					</Pressable>
				</ScrollView>
			</KeyboardAvoidingView>

			{/* Date Picker */}
			<DateTimePickerModal
				isVisible={showDobPicker}
				mode="date"
				date={dobDate}
				maximumDate={new Date()}
				display={Platform.OS === "ios" ? "inline" : "default"}
				themeVariant="light"
				accentColor="#EC441E"
				confirmTextIOS="Confirm"
				cancelTextIOS="Cancel"
				customConfirmButtonIOS={PickerConfirmButton}
				customCancelButtonIOS={PickerCancelButton}
				pickerContainerStyleIOS={{ backgroundColor: "#FFF" }}
				onConfirm={handleDateConfirm}
				onCancel={() => setShowDobPicker(false)}
			/>

			{/* Country Picker */}
			<CountrySelectorModal
				visible={showCountryPicker}
				selectedCountry={passengerInformation.country}
				onSelect={handleCountrySelect}
				onClose={() => setShowCountryPicker(false)}
			/>
		</SafeAreaView>
	)
}
