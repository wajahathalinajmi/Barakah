# Spiritual content and data sources

## Qur’an reader

- Arabic text, surah/page metadata, Saheeh International English meaning (en.sahih), and Alafasy recitation audio (ar.alafasy) are loaded from the Al Quran Cloud API: <https://alquran.cloud/api>.
- The reader keeps the translation labeled as a translation of meaning and links to the provider.
- Mushaf view groups the source ayahs by their supplied Madani page number. Verse-by-verse view shows the same ayahs individually.
- Each Mushaf page shows its Juz number, surah name(s), and ayah range(s), derived from the page endpoint's ayah metadata. The labels are the same in Uthmani and Tajweed scripts.
- Ibn Kathir commentary is fetched from Quran.com/Quran Foundation's English abridged resource. Some source records cover multiple ayahs; the tafsir screen now shows the ayah keys attached to that record. It preserves the published passage rather than fabricating verse-specific text when the source groups ayahs together. Quran Foundation documents the by-ayah tafsir endpoint and grouped tafsir metadata: <https://api-docs.quran.com/docs/content_apis_versioned/4.0.0/list-ayah-tafsirs/>.
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
- The complete OpenDua Hisn al-Muslim catalogue v0.0.4 is bundled at `data/open-dua-0.0.4.json`: 132 chapters and 267 entries. The separate Du’a library uses its chapter, search, and entry data. Arabic, translation, transliteration, repetition, conditions, and citations appear only when supplied in the catalogue; its method page notes source gradings are pending scholarly review. The app does not present entries without a citation as independently authenticated hadith. OpenDua's English, transliteration, editorial metadata, and catalogue structure are CC BY 4.0, with attribution in the interface. Catalogue source: [OpenDua](https://opendua.org/developers); [methodology](https://opendua.org/methodology); [data license](https://opendua.org/licence/data).
- Dhikr's third tab is “Prophetic adhkars.” `data/prophetic-adhkar.json` groups a curated set of Qur’anic supplication references by Prophet and includes hadith supplications narrated from Dawud and Prophet Muhammad ﷺ. Qur’anic Arabic and Saheeh International meaning are fetched by the exact ayah key from Al Quran Cloud. Hadith cards link to the cited Sunnah.com record. This is a sourced selection, not a claim to exhaust every supplication ever attributed to every Prophet; the Quran.com collection itself is a curated reference index. Source index: [Quran.com — Duas of the Prophets](https://quran.com/duas/prophets).
- OpenDua and morning/evening adhkar data are bundled, and local search does not send terms to those providers. The Prophetic adhkars view loads the referenced Qur’anic ayahs from Al Quran Cloud at runtime and therefore requires an internet connection. A local-file fetch may be blocked when opening `index.html` directly; use the local server or deployed Cloudflare origin so bundled JSON files can load. If a content file fails validation/loading, the relevant screen offers a retry state.

Prayer location and Quran bookmarks/progress are saved alongside the user's existing tracker state in Supabase. No new database table or schema migration is required.
