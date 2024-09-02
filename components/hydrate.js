if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}

import { getComponent } from './registry.js';
const { config, extensions } = ease
const { error } = ease.log

/**
 * Creates the class for a web component from the registry
 * @param {ComponentRegistryDef} registryDef The registry definition
 * @returns {typeof HTMLElement} The web component class
 */
export function createWebComponentClass(
  tagName,
  template,
  style,
  scriptUrl,
  attributes,
) {
  // TODO: A lot of this code is only needed to be initialized once 
  //       - we should make it static on the class
  const component = class extends HTMLElement {
    /** The shadow element that holds the content */
    _shadow;
    _mounted = false;
    _styleEl;
    _attrStyleEl;
    _eventListeners = [];
    _args = {
      // The shadow
      root: undefined,
      // Elements
      elements: {},
      get el() { return this.elements },
      // Attributes
      attributes: {},
      get attr() { return this.attributes },
      // Extensions
      extensions: {},
      get ext() { return this.extensions },
      get [config.inject.name]() { return this.extensions}
    };

    constructor() {
      super();

      // Allows accessing the component from methods
      let self = this;
      
      if (template.hasAttribute('shadowless')) {
        this._shadow = this;
      } else {
        // Create the shadow DOM
        this._shadow = this.attachShadow({mode: 'open'});
        this._args.root = this._shadow;
      }

      // Add tag name to shadow for debugging purposes
      this._shadow.tagName = tagName;
          
      // Clone the template into the shadow DOM
      this._shadow.appendChild(template.content.cloneNode(true));
      
      // Load the stylesheet
      if (style) {
        this._styleEl = document.createElement('style');
        this._styleEl.textContent = style;
        this._shadow.appendChild(this._styleEl);
      } 

      // Get attributes and store them in the attributes object
      let attrStyles = '';      
      attributes?.forEach?.((attr) => {
        this._args.attributes[attr.name] = {
          _listeners: [],
          _value: attr.default,
          type: attr.type,
          required: attr.required,
          exposeToStyle: attr.exposeToStyle,
          get value() { return this._value },
          set value(v) { 
            const prev = this._value;
            this._value = v;
            this._listeners.forEach((l) => l(v, prev));
            if (this.exposeToStyle) self.updateAttrStyles();
          },
          /**
           * Adds a watcher to the attribute, which receives the current and previous values
           * This will be invoked on mount and whenever the value changes
           * @param {function} callback 
           */
          watch(callback) {
            this._listeners.push(callback);
            if (!this._mounted) {
              callback(this.value, undefined);
            }
          },
          /**
           * Removes a watcher from the attribute
           * @param {function} callback
           */
          unwatch(callback) {
            this._listeners = _listeners.filter((l) => l !== callback);
          },
          /**
           * Removes all watchers from the attribute
           */
          unwatchAll() {
            this._listeners = [];
          }
        };

        // If the attribute is required, throw an error if it is not present 
        if (attr.required && !this.hasAttribute(attr.name)) {
          throw error(`Attribute ${attr.name} is required`).toError();
        }

        // If the attribute is set for style exposure, add it to the style element
        if (attr.exposeToStyle) {
          attrStyles += `--${attr.name}: ${this.getAttribute(attr.name)}; `;
        }
      });

      // Add the attribute styles to the style element
      if (attrStyles) {
        this._attrStyleEl = document.createElement('style');
        this._attrStyleEl.textContent += `:host { ${attrStyles} }`;
        this._shadow.insertBefore(this._attrStyleEl, this._styleEl);
      }

      // Get elements by ID and store them in the elements object
      this._shadow.querySelectorAll('[id]').forEach((el) => {
        this._args.elements[el.id] = el;
      });
      
      // Get all extensions
      this._args.extensions = extensions.all.reduce((p, c) => {
        const objects = c.objects || {};
        const methods = c.methods || {};
        return {...p, ...objects, ...methods};
      }, {});

      // Override event listeners; this allows tracking event listeners
      // and removing them when the component is disconnected
      const _shadowAddEventListener = this._shadow.addEventListener;
      this._shadow.addEventListener = function (name, callback) {
        self._eventListeners.push({ name, callback })
        _shadowAddEventListener(name, callback)
      }
      
      const _shadowRemoveEventListener = this._shadow.removeEventListener;
      this._shadow.removeEventListener = function (name, callback) {
        self._eventListeners = self._eventListeners.filter(({ name: n, callback: c }) => {
          if (n === name && c === callback) {
            _shadowRemoveEventListener(name, callback)
            return false
          }
          return true
        })
      }
            
      // Load the script
      if (scriptUrl) {
        import(scriptUrl).then((module) => {
          if (!module.default) return;

          // If the module has a default export, call it with the component as the argument
          if (module.default) module.default(this._args);
          
          // Dispatch a connect event
          this._shadow.dispatchEvent(new CustomEvent('connect'));
        });
      }

      // Handle initialization through extensions
      extensions.getExtensionsByArtifact('@easedotjs/components').forEach(ext =>
        ext.onInit?.({ shadow: this._shadow, args: this._args, instance: self })
      );
    }

    // Update Styles to reflect attribute changes
    updateAttrStyles() {
      let attrStyles = '';
      Object.keys(this._args.attributes).forEach((key) => {
        const attr = this._args.attributes[key];
        if (attr.exposeToStyle) {
          attrStyles += `--${key}: ${attr.value}; `;
        }
      });
      this._attrStyleEl.textContent = `:host { ${attrStyles} }`;
    }

    // On connect, add watchers
    connectedCallback() {
      this._mounted = true;
      // Dispatch a connect event
      this._shadow.dispatchEvent(new CustomEvent('connect'));
    }

    // On disconnect, remove all watchers
    disconnectedCallback() {
      this._mounted = false;
      this._args.attributes?.forEach?.((attr) => {
        attr.unwatchAll();
      });
      this._shadow.dispatchEvent(new CustomEvent('disconnect'));

      // Remove all event listeners
      this._eventListeners.forEach(({ name, callback }) => {
        this._shadow.removeEventListener(name, callback)
      })

      // Handle cleanup through extensions
      extensions.getExtensionsByArtifact('@easedotjs/components').forEach(ext =>
        ext.onCleanup?.({ shadow: this._shadow, args: this._args })
      );
    }
  }
  customElements.define(tagName, component);
  return component;
}