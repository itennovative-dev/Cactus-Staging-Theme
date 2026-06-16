class PredictiveSearch extends HTMLFormElement {
  constructor() {
    super();
    this.cachedMap = new Map();
    this.focusElement = this.input;
    this._ghostSuggestion = null;
    this._ghostInput = this.createGhostInput();
    this.resetButton.addEventListener('click', this.clear.bind(this));
    this.input.addEventListener('input', FoxTheme.utils.debounce(this.onChange.bind(this), 300));
    this.input.addEventListener('focus', this.onFocus.bind(this));
    this.input.addEventListener('keydown', this.onKeydown.bind(this));
    this.searchContent = this.querySelector('.search__content');
    this.searchRecommendationEmpty = this.dataset.searchRecommendationEmpty === 'true';
    const isTemplateSearch = this.closest('.template-search');
    if (isTemplateSearch) {
      document.addEventListener('click', this.handleClickOutside.bind(this));
    }
  }

  get input() { return this.querySelector('input[type="search"]'); }
  get resetButton() { return this.querySelector('button[type="reset"]'); }

  createGhostInput() {
    const inputEl = this.querySelector('input[type="search"]');
    const wrapper = inputEl.parentNode;

    if (window.getComputedStyle(wrapper).position === 'static') {
      wrapper.style.position = 'relative';
    }

    const ghost = document.createElement('input');
    ghost.type = 'text';
    ghost.tabIndex = -1;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.readOnly = true;
    ghost.style.cssText = [
      'position:absolute', 'inset:0',
      'width:100%', 'height:100%',
      'background:transparent',
      'border:none', 'outline:none', 'box-shadow:none',
      'color:rgba(128,128,128,0.5)',
      'pointer-events:none',
      'font:inherit', 'letter-spacing:inherit', 'padding:inherit',
      'margin:0', 'z-index:0'
    ].join(';');

    wrapper.insertBefore(ghost, inputEl);

    // Il vero input deve stare sopra e con sfondo trasparente
    inputEl.style.background = 'transparent';
    inputEl.style.position = 'relative';
    inputEl.style.zIndex = '1';

    return ghost;
  }

  onFocus(event) {
    if (this.closest('.template-search')) {
      document.body.classList.add('predictive-search-open');
      if (this.getQuery().length === 0) return;
      const url = this.setupURL().toString();
      this.renderSection(url, event);
    }
  }

  onKeydown(event) {
    if (!this._ghostSuggestion) return;
    const isTab = event.key === 'Tab';
    const isArrowRight = event.key === 'ArrowRight' && this.input.selectionStart === this.input.value.length;
    if (isTab || isArrowRight) {
      event.preventDefault();
      this.input.value = this._ghostSuggestion;
      this.clearGhostText();
      this.onChange();
    }
  }

  getQuery() { return this.input.value.trim(); }

  clear(event = null) {
    event && event.preventDefault();
    if (this.searchRecommendationEmpty && this.searchContent) {
      this.searchContent.classList.add('hidden');
    }
    this.input.value = '';
    this.input.focus();
    this.removeAttribute('results');
    this.clearGhostText();
  }

  setupURL() {
    const url = new URL(`${FoxTheme.routes.shop_url}${FoxTheme.routes.predictive_search_url}`);
    return (
      url.searchParams.set('q', this.getQuery()),
      url.searchParams.set('resources[limit]', this.dataset.resultsLimit || 3),
      url.searchParams.set('resources[limit_scope]', 'each'),
      url.searchParams.set('resources[options][fields]', 'title,product_type,variants.title,variants.sku'),
      url.searchParams.set('section_id', FoxTheme.utils.getSectionId(this)),
      url
    );
  }

  setupSuggestURL(query) {
    const url = new URL(`${FoxTheme.routes.shop_url}${FoxTheme.routes.predictive_search_url}`);
    url.searchParams.set('q', query);
    url.searchParams.set('resources[type]', 'query');
    url.searchParams.set('resources[limit]', '1');
    return url.toString();
  }

  async fetchGhostText(query) {
    if (!query) { this.clearGhostText(); return; }
    try {
      const response = await fetch(this.setupSuggestURL(query));
      const data = await response.json();
      const suggestions = data?.resources?.results?.queries;
      if (suggestions && suggestions.length > 0) {
        const suggestion = suggestions[0].text;
        if (suggestion.toLowerCase().startsWith(query.toLowerCase())) {
          this.showGhostText(suggestion);
        } else {
          this.clearGhostText();
        }
      } else {
        this.clearGhostText();
      }
    } catch (e) {
      this.clearGhostText();
    }
  }

  showGhostText(suggestion) {
    this._ghostSuggestion = suggestion;
    this._ghostInput.value = suggestion;
  }

  clearGhostText() {
    this._ghostSuggestion = null;
    this._ghostInput.value = '';
  }

  onChange() {
    if (this.getQuery().length === 0) { this.clear(); return; }
    const url = this.setupURL().toString();
    this.renderSection(url);
    this.fetchGhostText(this.getQuery());
  }

  renderSection(url) {
    this.cachedMap.has(url) ? this.renderSectionFromCache(url) : this.renderSectionFromFetch(url);
  }

  renderSectionFromCache(url) {
    const responseText = this.cachedMap.get(url);
    this.renderSearchResults(responseText);
    this.setAttribute('results', '');
  }

  renderSectionFromFetch(url) {
    this.setAttribute('loading', 'true');
    this.resetButton.classList.add('btn--loading');
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
      })
      .then((responseText) => {
        this.renderSearchResults(responseText);
        this.cachedMap.set(url, responseText);
      })
      .catch((error) => {
        console.error('Error fetching data: ', error);
        this.setAttribute('error', 'Failed to load data');
      })
      .finally(() => {
        this.removeAttribute('loading');
        this.resetButton.classList.remove('btn--loading');
        this.setAttribute('results', 'true');
      });
  }

  renderSearchResults(responseText) {
    const id = 'PredictiveSearchResults-' + FoxTheme.utils.getSectionId(this);
    const targetElement = document.getElementById(id);
    if (targetElement) {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(responseText, 'text/html');
      const contentElement = parsedDoc.getElementById(id);
      if (contentElement) {
        this.searchContent?.classList.remove('hidden');
        targetElement.innerHTML = contentElement.innerHTML;
      } else {
        console.error(`Element with id '${id}' not found in the parsed response.`);
      }
    } else {
      console.error(`Element with id '${id}' not found in the document.`);
    }
  }

  handleClickOutside(event) {
    if (!this.contains(event.target)) {
      setTimeout(() => { document.body.classList.remove('predictive-search-open'); });
    }
  }
}

customElements.define('predictive-search', PredictiveSearch, { extends: 'form' });

class SearchDrawer extends DrawerComponent {
  constructor() { super(); }
  get requiresBodyAppended() { return !1; }
  get input() { return this.querySelector('input[type="search"]'); }
  get focusElement() { return this.querySelector('input[type="search"]'); }
}

customElements.define('search-drawer', SearchDrawer);