import React from 'react'
import {
  fromDateTimeLocalValue,
  fromTimeValue,
  toDateTimeLocalValue,
  toTimeValue,
} from '../lib/dates'
import { colors } from '../theme'
import type { DateTimeFieldProps } from './DateTimeField'

// Web has no native picker module, but the browser already ships one: render a
// real <input type="datetime-local" | "time">. Expo web renders through React
// DOM, so plain DOM elements work here.
export function DateTimeField({ mode, value, onChange, placeholder, minimumDate }: DateTimeFieldProps) {
  const base = value ?? minimumDate ?? new Date()

  return (
    <input
      type={mode === 'datetime' ? 'datetime-local' : 'time'}
      value={value ? (mode === 'datetime' ? toDateTimeLocalValue(value) : toTimeValue(value)) : ''}
      min={mode === 'datetime' && minimumDate ? toDateTimeLocalValue(minimumDate) : undefined}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => {
        const next =
          mode === 'datetime' ? fromDateTimeLocalValue(e.target.value) : fromTimeValue(e.target.value, base)
        if (next) onChange(next)
      }}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: colors.surface2,
        color: colors.textPrimary,
        borderRadius: 12,
        padding: '12px',
        fontSize: 14,
        fontFamily: 'inherit',
        border: `0.5px solid ${value ? colors.accent : colors.borderStrong}`,
        colorScheme: 'dark',
      }}
    />
  )
}
