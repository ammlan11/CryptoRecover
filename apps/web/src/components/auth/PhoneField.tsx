"use client";

import { useState } from "react";
import { flag, PHONE_COUNTRIES } from "@/lib/phone-countries";

/**
 * Country + mobile number. Required on every account so the team can reach the reporter;
 * optional (`required={false}`) on the ad landing pages.
 *
 * Mobile first. The default layout stacks the two fields, full width. `compact` puts a
 * narrow country picker ("🇦🇪 +971") and the number on one row, for short forms that must
 * fit on one phone screen. People can type the number the way they usually write it (with
 * or without the leading 0), or a full "+971 …" number.
 */
export function PhoneField({
  label = "Mobile number",
  defaultCountry = "",
  defaultNumber = "",
  required = true,
  compact = false,
  idPrefix = "",
  help = "Only our research team can see it, to contact you about your report.",
  onNumberChange,
}: {
  label?: string;
  defaultCountry?: string;
  defaultNumber?: string;
  required?: boolean;
  compact?: boolean;
  /** Distinguishes the fields when two forms on one page have a phone field. */
  idPrefix?: string;
  help?: string | null;
  onNumberChange?: (hasNumber: boolean) => void;
}) {
  const [country, setCountry] = useState(defaultCountry);
  const dial = PHONE_COUNTRIES.find((c) => c[0] === country)?.[2];
  const countryId = `${idPrefix}phoneCountry`;
  const phoneId = `${idPrefix}phone`;
  const helpId = `${idPrefix}phone-help`;

  const select = (
    <select
      id={countryId}
      name="phoneCountry"
      className="field"
      required={required}
      autoComplete="tel-country-code"
      // Uncontrolled, so React's reset after a failed submit restores the picked country.
      defaultValue={defaultCountry}
      onChange={(e) => setCountry(e.target.value)}
      aria-label={compact ? "Country code" : undefined}
    >
      <option value="" disabled>{compact ? "Code" : "Choose your country"}</option>
      {PHONE_COUNTRIES.map(([iso, name, code]) => (
        <option key={iso} value={iso}>{compact ? `${flag(iso)} +${code} · ${name}` : `${flag(iso)} ${name} (+${code})`}</option>
      ))}
    </select>
  );
  const number = (
    <input
      id={phoneId}
      name="phone"
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      required={required}
      maxLength={40}
      className="field"
      placeholder={country === "LK" ? "77 123 4567" : country === "AE" ? "50 123 4567" : "Your mobile number"}
      defaultValue={defaultNumber}
      aria-describedby={help ? helpId : undefined}
      onChange={onNumberChange ? (e) => onNumberChange(e.target.value.trim().length > 0) : undefined}
    />
  );

  if (compact) {
    return (
      <div className="phone-field">
        <label className="label" htmlFor={phoneId}>{label}</label>
        <div className="phone-compact">
          {select}
          {number}
        </div>
        {help && <p id={helpId} className="fine" style={{ margin: "6px 0 0" }}>{help}</p>}
      </div>
    );
  }
  return (
    <div className="phone-field">
      <label className="label" htmlFor={countryId}>Country</label>
      {select}
      <label className="label" htmlFor={phoneId} style={{ marginTop: 14 }}>{label}</label>
      <div className="phone-input">
        <span className="phone-prefix" aria-hidden="true">{dial ? `+${dial}` : "+"}</span>
        {number}
      </div>
      {help && <p id={helpId} className="fine" style={{ margin: "6px 0 0" }}>{help}</p>}
    </div>
  );
}
