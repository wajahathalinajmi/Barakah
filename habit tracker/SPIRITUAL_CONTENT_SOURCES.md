# Spiritual content and data sources

## Qur’an reader

- Arabic text, surah/page metadata, Saheeh International English meaning (en.sahih), and Alafasy recitation audio (ar.alafasy) are loaded from the Al Quran Cloud API: <https://alquran.cloud/api>.
- The reader keeps the translation labeled as a translation of meaning and links to the provider.
- Mushaf view groups the source ayahs by their supplied Madani page number. Verse-by-verse view shows the same ayahs individually.
- Individual Arabic words can be focused. A per-word translation or transliteration is not shown: those fields are not supplied by this content source. Quran Foundation documents word-level translations and transliterations, but its current content API requires registered app credentials and a backend integration. Do not fabricate word glosses or tajweed styling to fill that gap.
- Ayah recitation is streamed from the audio URL returned by the API. No timing or tajweed data is inferred.

## Prayer times

- Today’s prayer times are fetched from AlAdhan’s timingsByCity endpoint using the user-selected city, country, and calculation method: <https://aladhan.com/prayer-times-api>.
- The default calculation method is Muslim World League. Users can select another supported method in Profile.

## Hadith reminder

- The Home screen uses the English translation of Sahih al-Bukhari 6464, narrated by Aisha, with a direct link to its source page: <https://sunnah.com/bukhari:6464>.
- The same verified reminder is shown each day; the app does not yet rotate through a daily collection.

Prayer location and Quran bookmarks/progress are saved alongside the user's existing tracker state in Supabase. No new database table or schema migration is required.
