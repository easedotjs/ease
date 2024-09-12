if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}
ease.extensions.before(['@easedotjs/components'])

const { error } = ease.log;
const { live } = ease;

// Get the live method from the reactive extension
let evals = [];

function markNodesReactive(node) {
  const { EaseTextNode } = ease.extensions.get('@easedotjs/components').vdom;
  switch (node.constructor.name) {
    case 'EaseTextNode':
      const regex = /(\{\{.*?\}\})/g;
      const result = node.text.split(regex).filter(Boolean);
      const newChildren = [];
      result.forEach((text) => {
        if (text.startsWith('{{') && text.endsWith('}}')) {
          const dynamic = new EaseTextNode(text.substring(2, text.length - 2));
          dynamic.addMeta('reactive', true);
          newChildren.push(dynamic);
        } else {
          newChildren.push(new EaseTextNode(text));
        }
      });
      node.replace(...newChildren);
      break;
    case 'EaseNode':
      node.children.forEach(markNodesReactive);
      break;
  }
}

/**
 * Parses a template string and converts all {{}} to <reactive-text></reactive-text>
 * @param {string} The text content of a <template> tag 
 * @returns A string with the text wrapped in <reactive-text></reactive-text>
 */
function onFetchComponent({template}) {
  template.children.forEach(markNodesReactive);  
}

function makeReactive(node, rx) {
  if (node.getMeta('reactive')) {
    const key = node.text.trim();
    rx[key] = live();
    rx[key].subscribe((value) => {
      node.text = value.value;
      node.htmlNode.textContent = value.value;
    });
  }
  node.children.forEach((node) => makeReactive(node, rx));
}

/**
 * When a component is initialized, this method is called to convert all reactive-text elements to reactive values
 * @param {object} An object containing the shadow root and args 
 */
function onInit({instance, args}) {
  args.rx = args.rx || {};

  instance.vdom.children.forEach((node) => makeReactive(node, args.rx));
}

/**
 * Cleans up reactive values when a component is removed
 */
function onCleanup({args}) {
  if (args.rx) {
    Object.keys(args.rx).forEach((key) => {
      args.rx[key].unsubscribe();
    })
  } 
  evals = [];
}

ease.extensions.add({
  name: '@easedotjs/reactive-dom',
  ['@easedotjs/components']: { 
    onFetchComponent,
    onInit,
    onCleanup
  }
});