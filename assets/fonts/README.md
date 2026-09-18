# Arabic reading font

`AmiriQuran-Regular.ttf` is the unmodified Amiri Quran Regular font (version 1.003),
bundled locally so the supplication mission works offline. Loaded with the app's
existing `expo-font` setup under `AmiriQuran`.

- Font: https://raw.githubusercontent.com/google/fonts/main/ofl/amiriquran/AmiriQuran-Regular.ttf
- Project: https://github.com/aliftype/amiri
- Typeface: https://fonts.google.com/specimen/Amiri+Quran
- License: SIL Open Font License 1.1; see `OFL-AmiriQuran.txt`.

Arabic uses natural shaping, zero added letter spacing, and generous line height
for vowel marks. Arabic text is right-to-left; surrounding app controls remain
left-to-right.

## Supplication sources

Content is in `src/utils/supplications.ts`, in this order:

1. Upon waking (once): https://sunnah.com/hisn:1
2. Contentment in faith (three times morning/evening): https://sunnah.com/hisn:87
3. Seeking protection (three times morning/evening): https://sunnah.com/hisn:86

Arabic is written without decorative stretching characters, with vowel marks for
reading. The first two meanings and transliterations follow the requested text;
the third meaning is an English rendering of the Arabic. Recitation is confirmed
by the user, without speech recognition. Each dua has its own 60-second deadline;
counting an individual repetition does not extend it.
