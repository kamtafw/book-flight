import { countries } from "@/constants"
import clsx from "clsx"
import { Check, Search, X } from "lucide-react-native"
import { memo, useCallback, useMemo, useState } from "react"
import {
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const COLORS = {
	primary: "#EF4423",
	title: "#1A1A1A",
	icon: "#6B6B6B",
	placeholder: "#A3A3A3",
	surface: "#F9FAFA",
} as const

const ICON_PROPS = { size: 20, color: COLORS.icon, strokeWidth: 1.5 } as const

interface CountrySelectorModalProps {
	visible: boolean
	selectedCountry?: string
	onSelect: (country: AppConfig.Country) => void
	onClose: () => void
}

interface CountryRowProps {
	country: AppConfig.Country
	selected: boolean
	onPress: (country: AppConfig.Country) => void
}

const CountryRow = memo(({ country, selected, onPress }: CountryRowProps) => (
	<Pressable
		onPress={() => onPress(country)}
		accessibilityRole="button"
		accessibilityLabel={country.name}
		accessibilityState={{ selected }}
		className="flex-row items-center gap-3 px-6 py-3.5 active:bg-surface"
	>
		<Text className="text-2xl leading-8">{country.flag}</Text>

		<Text
			className={clsx(
				"flex-1 text-base leading-6",
				selected ? "font-medium text-primary" : "text-ink",
			)}
		>
			{country.name}
		</Text>

		{selected ? <Check size={20} color="#EC441E" strokeWidth={2} /> : null}
	</Pressable>
))

CountryRow.displayName = "CountryRow"

export function CountrySelectorModal({
	visible,
	selectedCountry,
	onSelect,
	onClose,
}: CountrySelectorModalProps) {
	const insets = useSafeAreaInsets()
	const [query, setQuery] = useState("")

	const filteredCountries = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase()

		if (!normalizedQuery) {
			return countries
		}

		return countries.filter((country) => country.name.toLowerCase().includes(normalizedQuery))
	}, [query])

	const handleClose = useCallback(() => {
		setQuery("")
		onClose()
	}, [onClose])

	const handleSelect = useCallback(
		(country: AppConfig.Country) => {
			setQuery("")
			onSelect(country)
		},
		[onSelect],
	)

	const renderCountry = useCallback(
		({ item }: { item: AppConfig.Country }) => (
			<CountryRow country={item} selected={item.name === selectedCountry} onPress={handleSelect} />
		),
		[handleSelect, selectedCountry],
	)

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			statusBarTranslucent
			onRequestClose={handleClose}
		>
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<Pressable
					className="flex-1 bg-black/40"
					onPress={handleClose}
					accessibilityLabel="Close country selector"
				/>

				<View className="h-[65%] rounded-t-3xl bg-white" style={{ paddingBottom: insets.bottom }}>
					<View className="mt-3 h-1 w-10 self-center rounded-full bg-line" />

					<View className="flex-row items-center justify-between px-6 pb-2 pt-4">
						<Text className="text-lg font-medium leading-7 text-title">Select country</Text>

						<Pressable
							onPress={handleClose}
							hitSlop={12}
							accessibilityRole="button"
							accessibilityLabel="Close"
						>
							<X size={24} color={COLORS.title} strokeWidth={2} />
						</Pressable>
					</View>

					<View className="mx-6 mb-2 mt-2 h-12 flex-row items-center gap-2.5 rounded-[10px] border border-line px-4">
						<Search {...ICON_PROPS} />

						<TextInput
							className="h-full flex-1 py-0 text-base text-ink"
							placeholder="Search country"
							placeholderTextColor={COLORS.placeholder}
							selectionColor={COLORS.primary}
							cursorColor={COLORS.primary}
							value={query}
							onChangeText={setQuery}
							autoCorrect={false}
							returnKeyType="search"
							accessibilityLabel="Search country"
						/>
					</View>

					<FlatList
						data={filteredCountries}
						keyExtractor={(item) => item.code}
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
						renderItem={renderCountry}
						ItemSeparatorComponent={() => <View className="mx-6 h-px bg-line" />}
						ListEmptyComponent={
							<Text className="px-6 py-8 text-center text-base text-placeholder">
								No countries found
							</Text>
						}
					/>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	)
}
