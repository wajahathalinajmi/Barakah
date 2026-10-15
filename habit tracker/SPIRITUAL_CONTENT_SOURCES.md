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

## Dhikr and du’a

- Morning and evening adhkar are bundled from the English JSON dataset in [Seen-Arabic/Morning-And-Evening-Adhkar-DB](https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB), so the complete list works without a third-party request. It supplies 34 records: 26 classified for morning and 24 for evening (shared records appear in both). Each record includes Arabic, English meaning, transliteration, repeat count, classification, source, and virtue/context; some include audio. The `type` field is preserved: `0` means both, `1` morning, and `2` evening. The interface displays the supplied count and evidence wording; it does not infer a precise time or grade. Dataset license: MIT.
- The complete OpenDua Hisn al-Muslim catalogue v0.0.4 is bundled at `data/open-dua-0.0.4.json`: 132 chapters and 267 entries. Its chapter 27, “Words of remembrance for morning and evening,” contains 24 entries and is available in the local collection alongside other occasions. Search, chapter navigation, and entry detail work locally without sending search terms to a service. Arabic, translation, transliteration, repetition, conditions, and citations appear only when supplied in the catalogue; its method page notes source gradings are pending scholarly review. The app does not present entries without a citation as independently authenticated hadith. OpenDua's English, transliteration, editorial metadata, and catalogue structure are CC BY 4.0, with attribution in the interface. Catalogue source: [OpenDua](https://opendua.org/developers); [methodology](https://opendua.org/methodology); [data license](https://opendua.org/licence/data).
- Content is bundled with the app, and the browser makes no runtime content/search request to either provider. A local-file fetch may be blocked when opening `index.html` directly; run the project through its local web server or deployed Cloudflare origin so bundled JSON files can load. If a content file fails validation/loading, the relevant screen offers a retry state rather than claiming a partial list is complete.

Prayer location and Quran bookmarks/progress are saved alongside the user's existing tracker state in Supabase. No new database table or schema migration is required.
