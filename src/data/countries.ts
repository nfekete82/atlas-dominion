/** European start countries, capital coordinates (WGS84).
 * Includes microstates as playable starts even when coast outlines omit them.
 * Natural Earth at this scale is geographical, not a political recognition source.
 */
export interface CountryStart { code: string; name: string; capital: string; lon: number; lat: number; }
export const COUNTRY_STARTS: readonly CountryStart[] = [
  {
    "code": "DE",
    "name": "Deutschland",
    "capital": "Berlin",
    "lon": 13.405,
    "lat": 52.52
  },
  {
    "code": "GB",
    "name": "Vereinigtes Königreich",
    "capital": "London",
    "lon": -0.1276,
    "lat": 51.5072
  },
  {
    "code": "FR",
    "name": "Frankreich",
    "capital": "Paris",
    "lon": 2.3522,
    "lat": 48.8566
  },
  {
    "code": "ES",
    "name": "Spanien",
    "capital": "Madrid",
    "lon": -3.7038,
    "lat": 40.4168
  },
  {
    "code": "IT",
    "name": "Italien",
    "capital": "Rom",
    "lon": 12.4964,
    "lat": 41.9028
  },
  {
    "code": "SE",
    "name": "Schweden",
    "capital": "Stockholm",
    "lon": 18.0686,
    "lat": 59.3293
  },
  {
    "code": "PL",
    "name": "Polen",
    "capital": "Warschau",
    "lon": 21.0122,
    "lat": 52.2297
  },
  {
    "code": "UA",
    "name": "Ukraine",
    "capital": "Kyjiw",
    "lon": 30.5234,
    "lat": 50.4501
  },
  {
    "code": "TR",
    "name": "Türkei",
    "capital": "Ankara",
    "lon": 32.8597,
    "lat": 39.9334
  },
  {
    "code": "RS",
    "name": "Serbien",
    "capital": "Belgrad",
    "lon": 20.4573,
    "lat": 44.7872
  },
  {
    "code": "RO",
    "name": "Rumänien",
    "capital": "Bukarest",
    "lon": 26.1025,
    "lat": 44.4268
  },
  {
    "code": "AL",
    "name": "Albanien",
    "capital": "Tirana",
    "lon": 19.8187,
    "lat": 41.3275
  },
  {
    "code": "AD",
    "name": "Andorra",
    "capital": "Andorra la Vella",
    "lon": 1.5218,
    "lat": 42.5063
  },
  {
    "code": "AM",
    "name": "Armenien",
    "capital": "Jerewan",
    "lon": 44.5152,
    "lat": 40.1792
  },
  {
    "code": "AT",
    "name": "Österreich",
    "capital": "Wien",
    "lon": 16.3738,
    "lat": 48.2082
  },
  {
    "code": "AZ",
    "name": "Aserbaidschan",
    "capital": "Baku",
    "lon": 49.8671,
    "lat": 40.4093
  },
  {
    "code": "BY",
    "name": "Belarus",
    "capital": "Minsk",
    "lon": 27.5615,
    "lat": 53.9045
  },
  {
    "code": "BE",
    "name": "Belgien",
    "capital": "Brüssel",
    "lon": 4.3517,
    "lat": 50.8503
  },
  {
    "code": "BA",
    "name": "Bosnien und Herzegowina",
    "capital": "Sarajevo",
    "lon": 18.4131,
    "lat": 43.8563
  },
  {
    "code": "BG",
    "name": "Bulgarien",
    "capital": "Sofia",
    "lon": 23.3219,
    "lat": 42.6977
  },
  {
    "code": "HR",
    "name": "Kroatien",
    "capital": "Zagreb",
    "lon": 15.9819,
    "lat": 45.815
  },
  {
    "code": "CY",
    "name": "Zypern",
    "capital": "Nikosia",
    "lon": 33.3823,
    "lat": 35.1856
  },
  {
    "code": "CZ",
    "name": "Tschechien",
    "capital": "Prag",
    "lon": 14.4208,
    "lat": 50.088
  },
  {
    "code": "DK",
    "name": "Dänemark",
    "capital": "Kopenhagen",
    "lon": 12.5683,
    "lat": 55.6761
  },
  {
    "code": "EE",
    "name": "Estland",
    "capital": "Tallinn",
    "lon": 24.7536,
    "lat": 59.437
  },
  {
    "code": "FI",
    "name": "Finnland",
    "capital": "Helsinki",
    "lon": 24.9384,
    "lat": 60.1699
  },
  {
    "code": "GE",
    "name": "Georgien",
    "capital": "Tiflis",
    "lon": 44.8271,
    "lat": 41.7151
  },
  {
    "code": "GR",
    "name": "Griechenland",
    "capital": "Athen",
    "lon": 23.7275,
    "lat": 37.9838
  },
  {
    "code": "HU",
    "name": "Ungarn",
    "capital": "Budapest",
    "lon": 19.0402,
    "lat": 47.4979
  },
  {
    "code": "IS",
    "name": "Island",
    "capital": "Reykjavík",
    "lon": -21.9426,
    "lat": 64.1466
  },
  {
    "code": "IE",
    "name": "Irland",
    "capital": "Dublin",
    "lon": -6.2603,
    "lat": 53.3498
  },
  {
    "code": "XK",
    "name": "Kosovo",
    "capital": "Pristina",
    "lon": 21.1655,
    "lat": 42.6629
  },
  {
    "code": "LV",
    "name": "Lettland",
    "capital": "Riga",
    "lon": 24.1052,
    "lat": 56.9496
  },
  {
    "code": "LI",
    "name": "Liechtenstein",
    "capital": "Vaduz",
    "lon": 9.5215,
    "lat": 47.141
  },
  {
    "code": "LT",
    "name": "Litauen",
    "capital": "Vilnius",
    "lon": 25.2797,
    "lat": 54.6872
  },
  {
    "code": "LU",
    "name": "Luxemburg",
    "capital": "Luxemburg",
    "lon": 6.1319,
    "lat": 49.6116
  },
  {
    "code": "MT",
    "name": "Malta",
    "capital": "Valletta",
    "lon": 14.5146,
    "lat": 35.8992
  },
  {
    "code": "MD",
    "name": "Moldau",
    "capital": "Chișinău",
    "lon": 28.8638,
    "lat": 47.0105
  },
  {
    "code": "MC",
    "name": "Monaco",
    "capital": "Monaco",
    "lon": 7.4246,
    "lat": 43.7384
  },
  {
    "code": "ME",
    "name": "Montenegro",
    "capital": "Podgorica",
    "lon": 19.2594,
    "lat": 42.4304
  },
  {
    "code": "NL",
    "name": "Niederlande",
    "capital": "Amsterdam",
    "lon": 4.9041,
    "lat": 52.3676
  },
  {
    "code": "MK",
    "name": "Nordmazedonien",
    "capital": "Skopje",
    "lon": 21.4316,
    "lat": 42
  },
  {
    "code": "NO",
    "name": "Norwegen",
    "capital": "Oslo",
    "lon": 10.7522,
    "lat": 59.9139
  },
  {
    "code": "PT",
    "name": "Portugal",
    "capital": "Lissabon",
    "lon": -9.1393,
    "lat": 38.7223
  },
  {
    "code": "RU",
    "name": "Russland",
    "capital": "Moskau",
    "lon": 37.6173,
    "lat": 55.7558
  },
  {
    "code": "SM",
    "name": "San Marino",
    "capital": "San Marino",
    "lon": 12.4474,
    "lat": 43.9424
  },
  {
    "code": "SK",
    "name": "Slowakei",
    "capital": "Bratislava",
    "lon": 17.1077,
    "lat": 48.1486
  },
  {
    "code": "SI",
    "name": "Slowenien",
    "capital": "Ljubljana",
    "lon": 14.5058,
    "lat": 46.0569
  },
  {
    "code": "CH",
    "name": "Schweiz",
    "capital": "Bern",
    "lon": 7.4474,
    "lat": 46.948
  },
  {
    "code": "VA",
    "name": "Vatikanstadt",
    "capital": "Vatikanstadt",
    "lon": 12.4534,
    "lat": 41.9029
  }
];
export function countryByCode(code: string): CountryStart | undefined {
  return COUNTRY_STARTS.find(country=>country.code===code.toUpperCase());
}
