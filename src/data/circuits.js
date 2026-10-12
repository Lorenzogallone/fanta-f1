/**
 * @file Circuit facts not served by the API (Jolpica only has name and place),
 * keyed by its circuitId. Length in km, race distance in laps.
 */

export const CIRCUIT_FACTS = {
  albert_park: { length: 5.278, laps: 58 },
  shanghai: { length: 5.451, laps: 56 },
  suzuka: { length: 5.807, laps: 53 },
  bahrain: { length: 5.412, laps: 57 },
  jeddah: { length: 6.174, laps: 50 },
  miami: { length: 5.412, laps: 57 },
  imola: { length: 4.909, laps: 63 },
  villeneuve: { length: 4.361, laps: 70 },
  monaco: { length: 3.337, laps: 78 },
  catalunya: { length: 4.657, laps: 66 },
  red_bull_ring: { length: 4.318, laps: 71 },
  silverstone: { length: 5.891, laps: 52 },
  spa: { length: 7.004, laps: 44 },
  hungaroring: { length: 4.381, laps: 70 },
  zandvoort: { length: 4.259, laps: 72 },
  monza: { length: 5.793, laps: 53 },
  madring: { length: 5.47, laps: 57 },
  baku: { length: 6.003, laps: 51 },
  sepang: { length: 5.543, laps: 56 },
  marina_bay: { length: 4.94, laps: 62 },
  americas: { length: 5.513, laps: 56 },
  rodriguez: { length: 4.304, laps: 71 },
  interlagos: { length: 4.309, laps: 71 },
  vegas: { length: 6.201, laps: 50 },
  losail: { length: 5.419, laps: 57 },
  yas_marina: { length: 5.281, laps: 58 },
};

/** Country as the API spells it → flag */
export const COUNTRY_FLAGS = {
  Australia: "🇦🇺", China: "🇨🇳", Japan: "🇯🇵", Bahrain: "🇧🇭", "Saudi Arabia": "🇸🇦", USA: "🇺🇸",
  Canada: "🇨🇦", Monaco: "🇲🇨", Spain: "🇪🇸", Austria: "🇦🇹", UK: "🇬🇧", Belgium: "🇧🇪",
  Hungary: "🇭🇺", Netherlands: "🇳🇱", Italy: "🇮🇹", Azerbaijan: "🇦🇿", Malaysia: "🇲🇾",
  Singapore: "🇸🇬", Mexico: "🇲🇽", Brazil: "🇧🇷", Qatar: "🇶🇦", UAE: "🇦🇪",
};
