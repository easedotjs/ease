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
      
      // Load new script tags
      doc.head.querySelectorAll('script').forEach((script) => {
        if (document.querySelector(`script[src="${script.src}"]`)) return
        let newScript = document.createElement('script')
        newScript.src = script.src
        newScript.type = script.type
        newScript.async = true
        document.head.appendChild(newScript)
      });

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

ease.extensions.add({
  name: '@easedotjs/router',
  objects: { router }
})
