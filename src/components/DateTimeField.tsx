import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import React from 'react'
import { Platform, Text, TouchableOpacity, View } from 'react-native'
import { formatDateTimeLabel, formatTimeLabel } from '../lib/dates'
import { colors } from '../theme'

export type DateTimeFieldProps = {
  // 'datetime' picks a calendar day and a clock time; 'time' picks only a time
  // (used for the optional end time, which inherits the start's day).
  mode: 'datetime' | 'time'
  value: Date | null
  onChange: (next: Date) => void
  placeholder: string
  // Earliest selectable value — stops a game being scheduled in the past.
  minimumDate?: Date
}

function labelFor(value: Date | null, mode: 'datetime' | 'time', placeholder: string): string {
  if (!value) return placeholder
  return mode === 'datetime' ? formatDateTimeLabel(value) : formatTimeLabel(value)
}

// Tappable row that opens the system date/time UI. iOS reveals an inline
// spinner underneath; Android opens the native dialogs (date, then time),
// since its picker has no combined 'datetime' mode.
export function DateTimeField({ mode, value, onChange, placeholder, minimumDate }: DateTimeFieldProps) {
  const [open, setOpen] = React.useState(false)
  const current = value ?? minimumDate ?? new Date()

  function openAndroid() {
    if (mode === 'time') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'time',
        onChange: (_event, picked) => {
          if (picked) onChange(picked)
        },
      })
      return
    }

    // Chain date → time so the host sets both in one go.
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      minimumDate,
      onChange: (_dateEvent, pickedDate) => {
        if (!pickedDate) return
        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: 'time',
          onChange: (_timeEvent, pickedTime) => {
            if (!pickedTime) return
            const combined = new Date(pickedDate)
            combined.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0)
            onChange(combined)
          },
        })
      },
    })
  }

  function press() {
    if (Platform.OS === 'android') openAndroid()
    else setOpen((o) => !o)
  }

  return (
    <View>
      <TouchableOpacity
        onPress={press}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.surface2,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderWidth: 0.5,
          borderColor: value ? colors.accent : colors.borderStrong,
        }}
      >
        <Ionicons
          name={mode === 'datetime' ? 'calendar-outline' : 'time-outline'}
          size={16}
          color={value ? colors.accent : colors.textSecondary}
        />
        <Text style={{ flex: 1, fontSize: 14, color: value ? colors.textPrimary : colors.textMuted }}>
          {labelFor(value, mode, placeholder)}
        </Text>
        {Platform.OS === 'ios' && (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
        )}
      </TouchableOpacity>

      {Platform.OS === 'ios' && open && (
        <View style={{ backgroundColor: colors.surface2, borderRadius: 12, marginTop: 8, overflow: 'hidden' }}>
          <DateTimePicker
            value={current}
            mode={mode}
            display="spinner"
            themeVariant="dark"
            minimumDate={mode === 'datetime' ? minimumDate : undefined}
            onChange={(_event, picked) => {
              if (picked) onChange(picked)
            }}
          />
        </View>
      )}
    </View>
  )
}
