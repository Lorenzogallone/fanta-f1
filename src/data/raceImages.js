/**
 * @file raceImages.js
 * @description Circuit photo for each race (public/races/<key>.webp), shown behind the
 * next-race card. Photos come from Wikimedia Commons; the credit line is required by
 * their Creative Commons licenses, so keep `artist`/`license`/`file` accurate.
 */

/**
 * Race name patterns → circuit key. Names are stored in Italian (see translateRaceName in
 * functions/shared/jolpica.mjs) but admins can rename races, so English and city names match too.
 * Order matters: "Città del Messico" before "Messico", "Las Vegas" before "Stati Uniti".
 */
const MATCHERS = [
  [/las vegas/, "vegas"],
  [/stati uniti|united states|\busa\b|austin|americas/, "americas"],
  [/messico|mexic/, "rodriguez"],
  [/san paolo|sao paulo|brasil|brazil|interlagos/, "interlagos"],
  [/emilia|imola/, "imola"],
  [/arabia|saudi|jeddah|gedda/, "jeddah"],
  [/abu dhabi|yas marina/, "yas_marina"],
  [/bahrain|bahrein|sakhir/, "bahrain"],
  [/qatar|lusail|losail/, "losail"],
  [/singapore|marina bay/, "marina_bay"],
  [/azerbaijan|baku/, "baku"],
  [/olanda|paesi bassi|dutch|netherlands|zandvoort/, "zandvoort"],
  [/italia|italian|monza/, "monza"],
  [/ungheria|hungar/, "hungaroring"],
  [/belgio|belgi|\bspa\b|francorchamps/, "spa"],
  [/gran bretagna|british|silverstone|inghilterra/, "silverstone"],
  [/austria|spielberg|red bull ring/, "red_bull_ring"],
  [/monaco|monte ?carlo/, "monaco"],
  [/canada|canadian|montreal/, "villeneuve"],
  [/miami/, "miami"],
  [/giappone|japan|suzuka/, "suzuka"],
  [/\bcina\b|china|chinese|shanghai/, "shanghai"],
  [/australia|melbourne/, "albert_park"],
  [/madrid|madring/, "madring"],
  [/barcellona|barcelona|catalunya|catalogna/, "catalunya"],
  [/malesia|malaysia|sepang/, "sepang"],
];

/** Photo credits: `file` is the Commons file name, optional `pos` the CSS background-position. */
export const RACE_PHOTOS = {
  albert_park: {
    file: "2014 Melbourne Grand Prix (From Eureka Skydeck).jpg",
    artist: "Chris Phutully",
    license: "CC BY 2.0",
  },
  shanghai: {
    file: "Shanghai formula1 1.jpg",
    artist: "Mbaeckmann at de.wikipedia",
    license: "Public domain",
  },
  suzuka: {
    file: "Suzukacircuit main-straight.jpg",
    artist: "Wata0929",
    license: "CC BY-SA 4.0",
  },
  bahrain: {
    file: "Bahrain International Circuit.jpg",
    artist: "United Autosports",
    license: "CC BY-SA 2.0",
  },
  jeddah: {
    file: "Jeddah Corniche at night.jpg",
    artist: "Joseph Azrak",
    license: "CC BY-SA 4.0",
  },
  miami: {
    file: "Miami Grand Prix startfinish.jpg",
    artist: "Bassfish22",
    license: "CC BY-SA 4.0",
  },
  villeneuve: {
    file: "Circuit Gilles Villeneuve, Île de Notre Dame, Montreal (34523379263).jpg",
    artist: "pedrik",
    license: "CC BY 2.0",
  },
  monaco: {
    file: "The Montecarlo's harbour during the days of Formula 1 Monaco GP 2013.jpg",
    artist: "Uncidunci",
    license: "CC BY-SA 3.0",
  },
  catalunya: {
    file: "Curvas 1-6 de Circuit de Barcelona-Catalunya Montmeló (2023).jpg",
    artist: "Wilnel José Verdú Guerrero",
    license: "CC BY-SA 4.0",
  },
  red_bull_ring: {
    file: "Luftaufnahme (c)Red Bull Ring.jpg",
    artist: "Vanessa Machelett",
    license: "CC BY-SA 4.0",
  },
  silverstone: {
    file: "Silverstone Racing Circuit.jpg",
    artist: "Harvey Milligan",
    license: "CC BY-SA 4.0",
  },
  spa: {
    file: "Kurve Eau Rouge-Raidillon.jpg",
    artist: "Cutkiller2018",
    license: "CC BY-SA 4.0",
  },
  hungaroring: {
    file: "Hungaroring 2020.jpg",
    artist: "VargaA",
    license: "CC BY-SA 4.0",
  },
  zandvoort: {
    file: "Motorsport race track Circuit Zandvoort Formula one (47856558661).jpg",
    artist: "dronepicr",
    license: "CC BY 2.0",
  },
  monza: {
    file: "Autodromo Nazionale di Monza, first chicane - Flickr - crash71100.jpg",
    artist: "crash71100",
    license: "CC0",
  },
  madring: {
    file: "Madrid, Cuatro Torres y Sierra 1.jpg",
    artist: "LBM1948",
    license: "CC BY-SA 4.0",
  },
  baku: {
    file: "Panorama of night Baku, Azerbaijan IMG 9682.jpg",
    artist: "AlixSaz",
    license: "CC BY-SA 4.0",
  },
  marina_bay: {
    file: "Singapore Marina Bay Night View - panoramio.jpg",
    artist: "Ong Chi Hang",
    license: "CC BY-SA 3.0",
  },
  americas: {
    file: "Circuit of the americas cota (52781066233).jpg",
    artist: "Zach Catanzareti Photo",
    license: "CC BY 2.0",
  },
  rodriguez: {
    file: "Vista aérea del Autódromo Hermanos Rodríguez 01.jpg",
    artist: "ProtoplasmaKid",
    license: "CC BY-SA 4.0",
  },
  interlagos: {
    file: "Vista aérea del Autódromo José Carlos Pace 02.jpg",
    artist: "ProtoplasmaKid",
    license: "CC BY-SA 4.0",
  },
  vegas: {
    file: "Las Vegas Strip at night 2023.jpg",
    artist: "YosemiteYamper",
    license: "CC BY-SA 4.0",
  },
  losail: {
    file: "Grand Stand.JPG",
    artist: "Trinidade",
    license: "CC BY-SA 3.0",
  },
  yas_marina: {
    file: "Sunset at Yas Marina circuit - Abu Dhabi 2014.jpg",
    artist: "Cesar I. Martins",
    license: "CC BY 2.0",
  },
};

const normalize = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Circuit key for a race, from its name.
 * "Spagna"/"Spanish" moved from Barcelona to Madrid in 2026.
 * @param {Object} race - Race document ({ name, raceUTC })
 * @returns {string|null} Circuit key
 */
export function circuitKey(race) {
  const name = normalize(race?.name || "");
  if (!name) return null;
  if (/spagna|spanish|spain/.test(name)) {
    const year = race.raceUTC?.seconds ? new Date(race.raceUTC.seconds * 1000).getUTCFullYear() : 0;
    return year >= 2026 ? "madring" : "catalunya";
  }
  const hit = MATCHERS.find(([re]) => re.test(name));
  return hit ? hit[1] : null;
}

/**
 * Background photo for a race, or null when we have none.
 * @param {Object} race - Race document
 * @returns {{ src: string, pos: string, credit: string, href: string }|null}
 */
export function raceImage(race) {
  const key = circuitKey(race);
  const photo = key && RACE_PHOTOS[key];
  if (!photo) return null;
  return {
    src: `/races/${key}.webp`,
    pos: photo.pos || "center",
    credit: `${photo.artist} · ${photo.license}`,
    href: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file.replace(/ /g, "_"))}`,
  };
}
