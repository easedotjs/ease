if (!ease) {
  throw new Error('This library requires Ease to be loaded first')
}

let root = ease.config.router?.root || ''

let router = {
  currentRoute: null,
  push(path) {
    this._navigate(path)
    try {
      window.history.pushState({}, '', path)
    } catch (_) {
      window.history.pushState({}, '', `#${path}`)
    }
  },
  replace(path) {
    this._navigate(path)
    window.history.replaceState({}, '', path)
  },
  _navigate(path) {
    let resolvedPath = this._resolvePath(path) 
    fetch(`${root}${resolvedPath}`).then((response) => {
      return response.text()
    }).then((html) => {
      let domParser = new DOMParser()
      let doc = domParser.parseFromString(html, 'text/html')
      document.title = doc.querySelector('title').textContent
      document.body.innerHTML = doc.querySelector('body').innerHTML

      /* Load components that may not have been loaded */
      doc.head.querySelectorAll('link[rel="component"]').forEach((component) => {
        let name = component.attributes['name']?.value
        let href = component.attributes['href']?.value
        document.dispatchEvent(new CustomEvent('ease_load_component', {detail: { name, href }}))
      });
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
  createRoute(path, file) {
    this.routes.push({path, file})
  }
}

/** Handles situations where standard routing is unavailable */
if (window.location.hash) {
  router._navigate(window.location.hash.split('#')[1])
}

// function routeToUrlSearchPath() {
//   let url = new URL(window.location.href).search.split('?')[1]
//   router._navigate(router._resolvePath(url))
// }

// // Detect changes to the URL after ?
// window.addEventListener('popstate', () => {
//   routeToUrlSearchPath();
//   //router.navigate(window.location.pathname)
// })

globalThis.ease.router = router
globalThis.ease.addExtension({
  name: 'router',
  objects: { router }
})
