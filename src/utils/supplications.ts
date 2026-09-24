/** Arabic wording and counts checked against Hisn al-Muslim, in the requested order. */
export const supplications = [
  {
    id: "waking",
    title: "Upon waking",
    arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
    transliteration: "Alhamdulillahil-ladhi ahyana ba‘da ma amatana wa ilayhin-nushur.",
    translation: "All praise is for Allah who gave us life after causing us to die, and to Him is the resurrection.",
    repetitions: 1,
    occasion: "When waking up",
    reference: "Hisn al-Muslim 1",
    source: "https://sunnah.com/hisn:1",
  },
  {
    id: "contentment",
    title: "Contentment in faith",
    arabic: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا",
    transliteration: "Raditu billahi Rabban, wa bil-Islami dinan, wa bi-Muhammadin ﷺ nabiyyan.",
    translation: "I am pleased with Allah as my Lord, Islam as my religion, and Muhammad ﷺ as my Prophet.",
    repetitions: 3,
    occasion: "Morning & evening",
    reference: "Hisn al-Muslim 87",
    source: "https://sunnah.com/hisn:87",
  },
  {
    id: "protection",
    title: "Seeking protection",
    arabic: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ",
    transliteration: "Bismillahil-ladhi la yadurru ma‘a ismihi shay’un fil-ardi wa la fis-sama’i wa Huwas-Sami‘ul-‘Alim.",
    translation: "In Allah’s name, with whose name nothing on earth or in heaven can cause harm. He is the All-Hearing, the All-Knowing.",
    repetitions: 3,
    occasion: "Morning & evening",
    reference: "Hisn al-Muslim 86",
    source: "https://sunnah.com/hisn:86",
  },
] as const;

export type Supplication = (typeof supplications)[number];
export type SupplicationId = Supplication["id"];
/** Unconfigured legacy missions retain all three duas in their original order. */
export function selectedSupplications(ids?: readonly string[]) {
  const selected = supplications.filter(dua => ids?.includes(dua.id));
  return selected.length ? selected : [...supplications];
}
