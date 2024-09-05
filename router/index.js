// TODO: Add event emitters for route changes, argument changes, etc.
if (!ease) {
  throw new Error('This library requires Ease to be loaded first')
}

let root = ease.config.router?.root || ''

let router = {
  route: null,
  args: {},
  listeners: [],
  push(path) {
    this._navigate(path);
    window.history.pushState({}, '', path);
  },
  replace(path) {
    this._navigate(path);
    window.history.replaceState({}, '', path);
  },
  _navigate(path) {
    let resolvedPath = this._resolvePath(path);
    let [newRoute, newArgs] = resolvedPath.split('?');

    this._updateArgs(newArgs);

    // Only navigate if the full path is actually different
    if (this.route === newRoute) {
      this._notifyListeners();
      return;
    }

    fetch(`${root}${newRoute}`).then((response) => {
      return response.text()
    }).then((html) => {
      const domParser = new DOMParser();
      const doc = domParser.parseFromString(html, 'text/html')
      
      // Get the body content, accounting for templates
      let body = doc.querySelector('body')
      if (doc.querySelector('body>template')) {
        body = doc.querySelector('body>template');
      }

      // Load new script tags
      doc.head.querySelectorAll('script').forEach((script) => {
        if (document.querySelector(`script[src="${script.src}"]`)) return
        let newScript = document.createElement('script')
        newScript.src = script.src
        newScript.type = script.type
        newScript.async = true
        document.head.appendChild(newScript)
      });

      // TODO: Replace with the safer node insertion over innerHTML
      document.title = doc.querySelector('title').textContent;
      document.body.innerHTML = body.innerHTML;

      /* Load components that may not have been loaded */
      doc.head.querySelectorAll('link[rel="component"]').forEach((component) => {
        let name = component.attributes['name']?.value
        let href = component.attributes['href']?.value
        document.dispatchEvent(new CustomEvent('ease_load_component', {detail: { name, href }}))
      });

      this.route = newRoute;

      // Notify then all listeners
      this._notifyListeners();
      this.listeners = [];
    }).catch((error) => {
      // Ignore for now to handle jumping to IDs
    })
  },
  _resolvePath(path) {
    if (path === '/' || path === '') {
      return 'index'
    }
    return path.replace(/^\//, '')
  },
  _updateArgs(args) {
    this.args = {}
    if (!args) return

    args.split('&').forEach((arg) => {
      let [key, value] = arg.split('=')
      this.args[key] = value
    })
  },
  _notifyListeners() {
    this.listeners.forEach((listener) => {
      listener(this.route, this.args)
    })
  },
  onRouteChange(callback) {
    this.listeners.push(callback);
    callback(this.route, this.args);
  },
  createRoute(path, file) {
    this.routes.push({path, file})
  }
}

// Set initial state for router
router._currentRoute = window.location.pathname.split('?')[0];
router._updateArgs(window.location.search.substring(1));

// Adds a nav-to element that can be used to navigate to different pages
// In the future, you should be able to use is="" but safari does not support this
class LinkToElement extends HTMLElement {
  constructor() {
    super();
    const anchor = document.createElement('a');
    anchor.href = this.getAttribute('href');
    anchor.textContent = this.textContent;

    this.textContent = '';
    this.appendChild(anchor);

    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      router.push(this.getAttribute('href'));
    })
  }
};
customElements.define('nav-to', LinkToElement);

// Listen for popstate events
window.addEventListener('popstate', () => {
  router._navigate(window.location.href);
})


ease.extensions.add({
  name: '@easedotjs/router',
  objects: { router }
})
