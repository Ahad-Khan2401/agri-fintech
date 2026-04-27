import { useMemo, useState } from 'react'
import { pakistanLocations, getLocationByCity } from '../../data/pakistanLocations'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'

type Props = {
  city: string
  area: string
  onCityChange: (city: string) => void
  onAreaChange: (area: string) => void
  cityLabel?: string
  areaLabel?: string
}

export default function PakistanLocationSelect({
  city,
  area,
  onCityChange,
  onAreaChange,
  cityLabel = 'City / Village',
  areaLabel = 'Area',
}: Props) {
  const [citySearch, setCitySearch] = useState('')
  const selected = getLocationByCity(city)
  const filteredCities = useMemo(() => {
    const query = citySearch.trim().toLowerCase()
    if (!query) return pakistanLocations
    return pakistanLocations.filter((item) =>
      `${item.city} ${item.province} ${item.areas.join(' ')}`.toLowerCase().includes(query)
    )
  }, [citySearch])

  const areas = selected?.areas || []

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>{cityLabel}</Label>
        <Input
          value={citySearch}
          onChange={(event) => setCitySearch(event.target.value)}
          placeholder="Search city, village or province"
        />
        <select
          value={city}
          onChange={(event) => {
            onCityChange(event.target.value)
            onAreaChange('')
          }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select city/village</option>
          {filteredCities.map((item) => (
            <option key={item.city} value={item.city}>
              {item.city} - {item.province}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>{areaLabel}</Label>
        <select
          value={area}
          onChange={(event) => onAreaChange(event.target.value)}
          disabled={!city}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
        >
          <option value="">{city ? 'Select area' : 'Select city first'}</option>
          {areas.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500">Manual spelling avoid hoti hai, doctor matching city/area se hogi.</p>
      </div>
    </div>
  )
}
