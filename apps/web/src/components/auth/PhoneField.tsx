"use client";

import { useState } from "react";
import { flag, PHONE_COUNTRIES } from "@/lib/phone-countries";

/**
 * Country + mobile number, required on every account so the team can reach the reporter.
 * Mobile first: the two fields stack, full width, with large touch targets. The country
 * is pre-selected from the visitor's location when we know it; people can type the number
 * the way they usually write it (with or without the leading 0), or a full "+94 …" number.
 */
export function PhoneField({
  label = "Mobile number",
  defaultCountry = "",
  defaultNumber = "",
}: {
  label?: string;
  defaultCountry?: string;
  defaultNumber?: string;
}) {
  const [country, setCountry] = useState(defaultCountry);
  const dial = PHONE_COUNTRIES.find((c) => c[0] === country)?.[2];
  return (
    <div className="phone-field">
      <label className="label" htmlFor="phoneCountry">Country</label>
      <select
        id="phoneCountry"
        name="phoneCountry"
        className="field"
        required
        autoComplete="tel-country-code"
        // Uncontrolled, so React's reset after a failed submit restores the picked country.
        defaultValue={defaultCountry}
        onChange={(e) => setCountry(e.target.value)}
      >
        <option value="" disabled>Choose your country</option>
        {PHONE_COUNTRIES.map(([iso, name, code]) => (
          <option key={iso} value={iso}>{`${flag(iso)} ${name} (+${code})`}</option>
        ))}
      </select>
      <label className="label" htmlFor="phone" style={{ marginTop: 14 }}>{label}</label>
      <div className="phone-input">
        <span className="phone-prefix" aria-hidden="true">{dial ? `+${dial}` : "+"}</span>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          maxLength={40}
          className="field"
          placeholder={country === "LK" ? "77 123 4567" : "Your mobile number"}
          defaultValue={defaultNumber}
          aria-describedby="phone-help"
        />
      </div>
      <p id="phone-help" className="fine" style={{ margin: "6px 0 0" }}>
        Only our research team can see it, to contact you about your report.
      </p>
    </div>
  );
}
