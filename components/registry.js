if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}

const { warn, error, info } = ease.log
const { config } = ease

/**
 * The registry of components
 * @type {Map<string, ComponentRegistryDef>}
 */
const ComponentRegistry = new Map();

/** 
 * Defines an attribute 
 * 
*/
class Attribute {
  /** @type {string} The name of the attribute */
  name;
  /** @type {string} The type of the attribute */
  type;
  /** @type {string} The default value of the attribute */
  default;
  /** @type {boolean} Whether the attribute is required */
  required;
  /** @type {boolean} Should the attribute be made available to the style */
  exposeToStyle;


  /**
   * Creates a new attribute definition
   * @param {string} name The name of the attribute
   * @param {string} type The type of the attribute
   * @param {string} default The default value of the attribute
   * @param {boolean} required Whether the attribute is required
   * @param {boolean} exposeToStyle Should the attribute be made available to the style
   */
  constructor(name, type, defaultVal, required, exposeToStyle) {
    this.name = name;
    this.type = type || 'string';
    this.default = defaultVal;
    this.required = required;
    this.exposeToStyle = exposeToStyle;
  }
}
  
/**
 * Defines a component to be entered into the registry
 */
class ComponentRegistryDef {
  /** @type {HTMLTemplateElement} The template for the component */
  template;
  /** @type {string} The tag name of the component */
  tagName;
  /** @type {string} The script body for the component, stored as a Blob */
  script;
  /** @type {string} The style for the component */
  style;
  /** @type {Attribute} The attributes available in the component */
  attributes;
  /** @type {string} The source of the component */
  href;


  /**
   * Creates a new component definition
   * @param {HTMLTemplateElement} template The template for the component
   * @param {string} tagName The tag name of the component
   * @param {string} script The script body for the component
   * @param {string} style The style for the component
   */
  constructor(href, template, tagName, script, style, attributes) {
    this.href = href;
    this.template = template;
    this.tagName = tagName;
    this.script = this._scriptBlobFromText(script);
    this.style = style;
    this.attributes = attributes;
  }

  _scriptBlobFromText(text) {
    if (!text) return null;
    const blob = new Blob([text], { type: 'text/javascript' });
    return URL.createObjectURL(blob);
  }
}

/**
 * Fetches a component from a URL and returns a ComponentRegistryDef
 * @param {string} tagName The tag name of the component
 * @param {string} href The URL to fetch the component from
 * @returns {Promise<ComponentRegistryDef>} The component definition
 */
export async function fetchComponent(tagName, href) {
  if (ComponentRegistry.has(tagName)) {
    const existingItem = ComponentRegistry.get(tagName);
    if (existingItem.href !== href) {
      throw error(`Component ${tagName} already exists in the registry with a different href`).toError();
    }
    return existingItem;
  }

  const {template, script, style, attributes} = await fetch(href)
    .then(async (response) => ({ content: await response.text(), code: response.status }))
    .then(({content, code}) => {
      if (code !== 200) {
        throw new Error(`Failed to fetch component from ${href}`);
      }

      // Parse the document and extract the template, script, and style
      const parser = new DOMParser();
      // TODO: Handle parsing errors
      const document = parser.parseFromString(content, 'text/html');
      // TODO: Throw a warning if the document does not contain a template
      const template = document.querySelector('template') || document.createElement('template');
      const script = document.querySelector('script:not([src])')?.textContent;
      const style = document.querySelector('style')?.textContent;
      const attributes = Array.from(document.querySelectorAll('attribute')).map((attr) => {
        return new Attribute(
          attr.getAttribute('name'), 
          attr.getAttribute('type'), 
          attr.getAttribute('default'), 
          attr.hasAttribute('required'), 
          attr.hasAttribute('expose-to-style'));
      });

      // Run the component through extensions
      ease.extensions.getExtensionsByArtifact('@easedotjs/components').forEach((extension) => {
        if (extension.onFetchComponent) {
          extension.onFetchComponent({template, script, style});
        }
      });

      return {template, script, style, attributes};
    });

    // Register the component
    return new ComponentRegistryDef(href, template, tagName, script, style, attributes);
}

/**
 * Registers a component with the registry
 * @param {ComponentRegistryDef} def The component definition
 */
export function registerComponent(def) {
  // TODO: Validate the component definition
  if (!ComponentRegistry.has(def.tagName)) {
    ComponentRegistry.set(def.tagName, def);
  }
}

/**
 * Fetches a component from the registry
 * @param {string} tagName The tag name of the component
 * @returns 
 */
export function getComponent(tagName) {
  return ComponentRegistry.get(tagName);
}

/**
 * Fetches a component from a link element and registers it, or returns the existing component
 * @param {HTMLLinkElement} link The link element to fetch the component from
 * @returns {Promise<ComponentRegistryDef>} The component definition
 */
export async function fetchComponentFromLink(link) {
  return fetchComponent(link.getAttribute('rel'), link.href)
    .then((def) => {
      registerComponent(def);
      return def;
    });
}
