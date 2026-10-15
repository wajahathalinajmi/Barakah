(() => {
  let adhkarPromise;
  let cataloguePromise;
  let propheticPromise;

  async function getJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Content file returned ${response.status}`);
    return response.json();
  }

  function loadCatalogue() {
    if (!cataloguePromise) cataloguePromise = getJson('data/open-dua-0.0.4.json').then(catalogue => {
      if (catalogue?.dataVersion !== '0.0.4' || !Array.isArray(catalogue.chapters) || !Array.isArray(catalogue.entries)) {
        throw new Error('The OpenDua catalogue has an unexpected format.');
      }
      return catalogue;
    }).catch(error => { cataloguePromise = null; throw error; });
    return cataloguePromise;
  }

  function entrySearchText(entry) {
    const parts = [entry.title, entry.sourceReference, ...(entry.tags || [])];
    for (const variation of entry.variations || []) {
      parts.push(variation.label, variation.condition);
      for (const step of variation.steps || []) {
        parts.push(step.text, step.translation, step.arabic);
        for (const item of step.items || []) parts.push(item.dua?.arabic, item.dua?.transliteration, item.dua?.translation);
      }
    }
    return parts.filter(Boolean).join(' ').toLocaleLowerCase();
  }

  window.BarakahContent = {
    adhkarSource: 'https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    duaSource: 'https://opendua.org/developers',
    async loadAdhkar() {
      if (!adhkarPromise) adhkarPromise = getJson('data/morning-evening-adhkar-en.json').then(data => {
        if (!Array.isArray(data) || data.length < 30 || !data.every(item => item.content && item.translation && item.source && item.type !== undefined && item.count !== undefined)) {
          throw new Error('The morning/evening adhkar file is incomplete or has an unexpected format.');
        }
        return data;
      }).catch(error => { adhkarPromise = null; throw error; });
      return adhkarPromise;
    },
    async loadDuaChapters() {
      const catalogue = await loadCatalogue();
      return catalogue.chapters;
    },
    async loadDuaChapterEntries(chapterId) {
      const catalogue = await loadCatalogue();
      return catalogue.entries.filter(entry => entry.chapterId === chapterId);
    },
    async searchDuas(query) {
      const catalogue = await loadCatalogue();
      const term = query.trim().toLocaleLowerCase();
      return catalogue.entries.filter(entry => entrySearchText(entry).includes(term));
    },
    async loadDuaEntry(entryId) {
      const catalogue = await loadCatalogue();
      const entry = catalogue.entries.find(item => item.id === entryId || item.slug === entryId);
      if (!entry) throw new Error('That supplication was not found in the bundled collection.');
      return entry;
    },
    async loadPropheticAdhkar() {
      if (!propheticPromise) propheticPromise = getJson('data/prophetic-adhkar.json').then(data => {
        if (!Array.isArray(data?.groups) || data.groups.length < 10 || !data.groups.every(group => group.name && Array.isArray(group.items) && group.items.every(item => /^\d{1,3}:\d{1,3}$/.test(item.ayah)))) {
          throw new Error('The prophetic adhkar collection is incomplete or has an unexpected format.');
        }
        return data;
      }).catch(error => { propheticPromise = null; throw error; });
      return propheticPromise;
    }
  };
})();
