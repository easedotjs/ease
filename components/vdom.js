const svgns = 'http://www.w3.org/2000/svg';

export class EaseAttribute {
  name;value;

  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
}

export class EaseNode {
  #tag;#attributes;#parent;#ns = undefined;
  #children = [];

  constructor(tag, attributes, ns, children = []) {
    this.#tag = tag;
    this.#attributes = attributes;
    this.#children.push(...children);
    this.#ns = ns;
  }

  addChild(node) {
    this.#children.push(node);
    node.setParent(this);
  }

  setParent(node) {
    this.#parent = node;
  }

  static fromString(text, ns) {
    text = text.replace('>', '');
    let [tag, ...attrs] = text.split(' ');
    tag = tag.replace('<', '').trim();
    let attrsArray = [];

    // Parse attributes
    attrs = attrs.join(' ');
    let key, value, step = 0, buffer = '', quoted = false;
    for (let i = 0; i < attrs.length; i++) {
      if (attrs[i] === '=' && step === 0) {
        key = buffer;
        buffer = '';
        step = 1;
      } else if (attrs[i] === '"') {
        if (step === 2) {
          value = buffer;
          buffer = '';
          step = 0;
          const attr = new EaseAttribute(key.trim(), value);
          attrsArray.push(attr);
        } else {
          quoted = true;
        }
      } else if (attrs[i] !== '"' && step === 1 ) { 
        buffer += attrs[i];
        step = 2;
      } else {
        buffer += attrs[i];
      }
    }

    if (tag === 'svg') {
      return new EaseNode(tag, attrsArray, svgns);
    } else {
      return new EaseNode(tag, attrsArray, ns);
    }
  }

  get parent() { return this.#parent }
  get tag() { return this.#tag; }
  get attributes() { return this.#attributes; }
  get children() { return this.#children; }
  get ns() { return this.#ns; }

  toString() {
    return `<${this.#tag}${this.#attributes.length?' ':''}${this.#attributes.map((attr) => `${attr.name}${attr.value?`="${attr.value}"`:''}`).join(' ')}>${this.#children.map((child) => child.toString()).join('')}</${this.#tag}>`;
  }

  get htmlNode() {
    const node = this.#ns ? document.createElementNS(this.#ns, this.#tag) : document.createElement(this.#tag);
    this.#attributes.forEach((attr) => {
      node.setAttribute(attr.name, attr.value.replace(/"/g, ''));
    });
    this.#children.forEach((child) => {
      node.appendChild(child.htmlNode);
    });
    return node;
  }
}

export class EaseTextNode extends EaseNode {
  #text;

  constructor(text) {
    super('#TEXT', [], []);
    this.#text = text;
  }

  get text() { return this.#text; }
  get htmlNode() { return document.createTextNode(this.#text); }
  toString() { return this.#text; }
  addChild() { throw new Error('Cannot add children to text node'); }
}

export class EaseNodeParser {
  constructor() {}

  // TODO: Analyze regex vs manual parsing performance
  parse(text) {
    let root = new EaseNode('root');
    let activeNode = root;
    text.split(/(<[^>]+>)/).filter(it => !!it).forEach((block) => {
      if (block.startsWith('<!')) return;
      if (block.startsWith('</')) {
        activeNode = activeNode.parent;
      } else if (block.startsWith('<')) {
        const newNode = EaseNode.fromString(block, activeNode.ns);
        activeNode.addChild(newNode);
        if (!block.endsWith('/>')) {
          activeNode = newNode;
        }
      } else if (block.trim().length > 0) {
        activeNode.addChild(new EaseTextNode(block.trim()));
      }
    });
    return root;
  }
}
