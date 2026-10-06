import clsx from "clsx"
import { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from "react"
import { Pressable, Text, TextInput, TextInputProps, View } from "react-native"

interface FieldShellProps {
	label: string
	icon: ReactNode
	trailingIcon?: ReactNode
	focused?: boolean
	hasError?: boolean
	children: ReactNode
}

export const FieldShell = ({
	label,
	icon,
	trailingIcon,
	focused = false,
	hasError = false,
	children,
}: FieldShellProps) => (
	<View
		className={clsx(
			"h-14 flex-row items-center gap-2.5 rounded-xl border px-4",
			hasError ? "border-error" : focused ? "border-primary" : "border-border",
		)}
	>
		<Text
			className={clsx(
				"absolute -top-2.5 left-2 bg-background px-2 font-inter text-sm leading-5",
				hasError ? "text-error" : focused ? "text-primary" : "text-gray-200",
			)}
		>
			{label}
		</Text>

		{icon}

		{children}

		{trailingIcon}
	</View>
)

interface FloatingInputProps extends TextInputProps {
	label: string
	icon: ReactNode
	error?: string
}

export const FloatingInput = forwardRef<TextInput, FloatingInputProps>(
	({ label, icon, error, value, onFocus, onBlur, ...inputProps }, ref) => {
		const inputRef = useRef<TextInput>(null)
		const [focused, setFocused] = useState(false)

		useImperativeHandle(ref, () => inputRef.current as TextInput)

		return (
			<Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
				<FieldShell label={label} icon={icon} focused={focused} hasError={Boolean(error)}>
					<TextInput
						{...inputProps}
						ref={inputRef}
						value={value}
						accessibilityLabel={label}
						onFocus={(event) => {
							setFocused(true)
							onFocus?.(event)
						}}
						onBlur={(event) => {
							setFocused(false)
							onBlur?.(event)
						}}
						placeholderClassName="text-gray-400"
						className="h-full flex-1 font-inter text-base text-gray-200 py-0"
					/>
				</FieldShell>

				{error ? <Text className="mt-1 font-inter-light text-xs text-error">{error}</Text> : null}
			</Pressable>
		)
	},
)

FloatingInput.displayName = "FloatingInput"
