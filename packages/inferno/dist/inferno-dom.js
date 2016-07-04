/*!
 * inferno-dom v0.7.14
 * (c) 2016 Dominic Gannaway
 * Released under the MIT License.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.InfernoDOM = factory());
}(this, function () { 'use strict';

	function addChildrenToProps(children, props) {
		if (!isNullOrUndefined(children)) {
			var isChildrenArray = isArray(children);
			if (isChildrenArray && children.length > 0 || !isChildrenArray) {
				if (props) {
					props = Object.assign({}, props, { children: children });
				} else {
					props = {
						children: children
					};
				}
			}
		}
		return props;
	}

	var NO_RENDER = 'NO_RENDER';

	// Runs only once in applications lifetime
	var isBrowser = typeof window !== 'undefined' && window.document;

	function isArray(obj) {
		return obj instanceof Array;
	}

	function isStatefulComponent(obj) {
		return obj.prototype.render !== undefined;
	}

	function isStringOrNumber(obj) {
		return isString(obj) || isNumber(obj);
	}

	function isNullOrUndefined(obj) {
		return isUndefined(obj) || isNull(obj);
	}

	function isInvalidNode(obj) {
		return isNull(obj) || obj === false || obj === true || isUndefined(obj);
	}

	function isFunction(obj) {
		return typeof obj === 'function';
	}

	function isString(obj) {
		return typeof obj === 'string';
	}

	function isNumber(obj) {
		return typeof obj === 'number';
	}

	function isNull(obj) {
		return obj === null;
	}

	function isUndefined(obj) {
		return obj === undefined;
	}

	function deepScanChildrenForNode(children, node) {
		if (!isInvalidNode(children)) {
			if (isArray(children)) {
				for (var i = 0; i < children.length; i++) {
					var child = children[i];

					if (!isInvalidNode(child)) {
						if (child === node) {
							return true;
						} else if (child.children) {
							return deepScanChildrenForNode(child.children, node);
						}
					}
				}
			} else {
				if (children === node) {
					return true;
				} else if (children.children) {
					return deepScanChildrenForNode(children.children, node);
				}
			}
		}
		return false;
	}

	function getRefInstance(node, instance) {
		var children = instance.props.children;

		if (deepScanChildrenForNode(children, node)) {
			return getRefInstance(node, instance._parentComponent);
		}
		return instance;
	}

	var recyclingEnabled = true;

	function recycle(node, bp, lifecycle, context, instance) {
		if (bp !== undefined) {
			var key = node.key;
			var pool = key === null ? bp.pools.nonKeyed : bp.pools.keyed[key];
			if (!isNullOrUndefined(pool)) {
				var recycledNode = pool.pop();
				if (!isNullOrUndefined(recycledNode)) {
					patch(recycledNode, node, null, lifecycle, context, instance, true, bp.isSVG);
					return node.dom;
				}
			}
		}
		return null;
	}

	function pool(node) {
		var bp = node.bp;

		if (!isNullOrUndefined(bp)) {
			var key = node.key;
			var pools = bp.pools;

			if (key === null) {
				var pool = pools.nonKeyed;
				pool && pool.push(node);
			} else {
				var pool$1 = pools.keyed;
				(pool$1[key] || (pool$1[key] = [])).push(node);
			}
			return true;
		}
		return false;
	}

	function VText(text) {
		this.text = text;
		this.dom = null;
		this.key = null;
	}

	function VPlaceholder(text) {
		this.placeholder = true;
		this.dom = null;
		this.key = null;
	}

	function VList(items) {
		this.dom = null;
		this.key = null;
		this.pointer = null;
		this.items = items;
	}

	function createVText(text) {
		return new VText(text);
	}

	function createVPlaceholder() {
		return new VPlaceholder();
	}

	function createVList(items) {
		return new VList(items);
	}

	function mount(input, parentDom, lifecycle, context, instance, isSVG) {
		if (isVPlaceholder(input)) {
			return mountVPlaceholder(input, parentDom);
		}
		if (isVText(input)) {
			return mountVText(input, parentDom);
		}
		if (isVList(input)) {
			return mountVList(input, parentDom, lifecycle, context, instance, isSVG);
		}
		var bp = input.bp;

		if (recyclingEnabled && bp) {
			var dom = recycle(input, bp, lifecycle, context, instance);

			if (dom !== null) {
				if (parentDom !== null) {
					parentDom.appendChild(dom);
				}
				return dom;
			}
		}
		if (bp === undefined) {
			return appendNode(input, parentDom, lifecycle, context, instance, isSVG);
		} else {
			return appendNodeWithBlueprint(input, bp, parentDom, lifecycle, context, instance);
		}
	}

	function mountVList(vList, parentDom, lifecycle, context, instance, isSVG) {
		var items = vList.items;
		var pointer = document.createTextNode('');
		var dom = document.createDocumentFragment();

		mountArrayChildren(items, dom, lifecycle, context, instance, isSVG);
		vList.pointer = pointer;
		vList.dom = dom;
		dom.appendChild(pointer);
		if (parentDom) {
			insertOrAppend(parentDom, dom);
		}
		return dom;
	}

	function mountVText(vText, parentDom) {
		var dom = document.createTextNode(vText.text);

		vText.dom = dom;
		if (parentDom) {
			insertOrAppend(parentDom, dom);
		}
		return dom;
	 }

	 function mountVPlaceholder(vPlaceholder, parentDom) {
		var dom = document.createTextNode('');

		vPlaceholder.dom = dom;
		if (parentDom) {
			insertOrAppend(parentDom, dom);
		}
		return dom;
	 }

	function handleSelects(node) {
		if (node.tag === 'select') {
			selectValue(node);
		}
	}

	function mountBlueprintAttrs(node, bp, dom, instance) {
		handleSelects(node);
		var attrs = node.attrs;

		if (bp.attrKeys === null) {
			var newKeys = Object.keys(attrs);
			bp.attrKeys = bp.attrKeys ? bp.attrKeys.concat(newKeys) : newKeys;
		}
		var attrKeys = bp.attrKeys;

		mountAttributes(node, attrs, attrKeys, dom, instance);
	}

	function mountBlueprintEvents(node, bp, dom) {
		var events = node.events;

		if (bp.eventKeys === null) {
			bp.eventKeys = Object.keys(events);
		}
		var eventKeys = bp.eventKeys;

		mountEvents(events, eventKeys, dom);
	}

	function appendNodeWithBlueprint(node, bp, parentDom, lifecycle, context, instance) {
		var tag = node.tag;

		if (bp.isComponent === true) {
			return mountComponent(node, tag, node.attrs || {}, node.hooks, node.children, instance, parentDom, lifecycle, context);
		}
		var dom = documentCreateElement(bp.tag, bp.isSVG);

		node.dom = dom;
		if (bp.hasHooks === true) {
			handleAttachedHooks(node.hooks, lifecycle, dom);
		}
		if (bp.lazy === true) {
			handleLazyAttached(node, lifecycle, dom);
		}
		// bp.childrenType:
		// 0: no children
		// 1: text node
		// 2: single child
		// 3: multiple children
		// 4: multiple children (keyed)
		// 5: variable children (defaults to no optimisation)

		switch (bp.childrenType) {
			case 1:
				appendText(node.children, dom, true);
				break;
			case 2:
				mount(node.children, dom, lifecycle, context, instance);
				break;
			case 3:
				mountArrayChildren(node.children, dom, lifecycle, context, instance);
				break;
			case 4:
				mountArrayChildrenWithKeys(node.children, dom, lifecycle, context, instance);
				break;
			case 5:
				mountChildren(node, node.children, dom, lifecycle, context, instance);
				break;
			default:
				break;
		}

		if (bp.hasAttrs === true) {
			mountBlueprintAttrs(node, bp, dom, instance);
		}
		if (bp.hasClassName === true) {
			dom.className = node.className;
		}
		if (bp.hasStyle === true) {
			patchStyle(null, node.style, dom);
		}
		if (bp.hasEvents === true) {
			mountBlueprintEvents(node, bp, dom);
		}
		if (parentDom !== null) {
			parentDom.appendChild(dom);
		}
		return dom;
	}

	function appendNode(node, parentDom, lifecycle, context, instance, isSVG) {
		var tag = node.tag;

		if (isFunction(tag)) {
			return mountComponent(node, tag, node.attrs || {}, node.hooks, node.children, instance, parentDom, lifecycle, context);
		}
		if (!isString(tag) || tag === '') {
			throw Error('Inferno Error: Expected function or string for element tag type');
		}
		if (tag === 'svg') {
			isSVG = true;
		}
		var dom = documentCreateElement(tag, isSVG);
		var children = node.children;
		var attrs = node.attrs;
		var events = node.events;
		var hooks = node.hooks;
		var className = node.className;
		var style = node.style;

		node.dom = dom;
		if (!isNullOrUndefined(hooks)) {
			handleAttachedHooks(hooks, lifecycle, dom);
		}
		if (!isInvalidNode(children)) {
			mountChildren(node, children, dom, lifecycle, context, instance, isSVG);
		}
		if (!isNullOrUndefined(attrs)) {
			handleSelects(node);
			mountAttributes(node, attrs, Object.keys(attrs), dom, instance);
		}
		if (!isNullOrUndefined(className)) {
			dom.className = className;
		}
		if (!isNullOrUndefined(style)) {
			patchStyle(null, style, dom);
		}
		if (!isNullOrUndefined(events)) {
			mountEvents(events, Object.keys(events), dom);
		}
		if (!isNull(parentDom)) {
			parentDom.appendChild(dom);
		}
		return dom;
	}

	function mountArrayChildrenWithKeys(children, parentDom, lifecycle, context, instance) {
		for (var i = 0; i < children.length; i++) {
			mount(children[i], parentDom, lifecycle, context, instance);
		}
	}

	function mountArrayChildren(children, parentDom, lifecycle, context, instance, isSVG) {
		for (var i = 0; i < children.length; i++) {
			var child = children[i];

			if (isStringOrNumber(child)) {
				var vText = createVText(child);

				children[i] = vText;
				mountVText(vText, parentDom);
			} else if (isInvalidNode(child)) {
				var vPlaceholder = createVPlaceholder();

				children[i] = vPlaceholder;
				mountVPlaceholder(vPlaceholder, parentDom);
			} else if (isArray(child)) {
				var vList = createVList(child);

				children[i] = vList;
				mountVList(vList, parentDom, lifecycle, context, instance, isSVG);
			} else if (isVText(child)) {
				mountVText(child, parentDom);
			} else if (isVPlaceholder(child)) {
				mountVPlaceholder(child, parentDom);
			} else if (isVList(child)) {
				mountVList(child, parentDom, lifecycle, context, instance, isSVG);
			} else {
				mount(child, parentDom, lifecycle, context, instance, isSVG);
			}
		}
	}

	function mountChildren(node, children, parentDom, lifecycle, context, instance, isSVG) {
		if (isArray(children)) {
			mountArrayChildren(children, parentDom, lifecycle, context, instance, isSVG);
		} else if (isStringOrNumber(children)) {
			appendText(children, parentDom, true);
		} else if (!isInvalidNode(children)) {
			mount(children, parentDom, lifecycle, context, instance, isSVG);
		}
	}

	function mountRef(instance, value, refValue) {
		if (!isInvalidNode(instance) && isString(value)) {
			instance.refs[value] = refValue;
		}
	}

	function mountEvents(events, eventKeys, dom) {
		for (var i = 0; i < eventKeys.length; i++) {
			var event = eventKeys[i];

			dom[event] = events[event];
		}
	}

	function mountComponent(parentNode, Component, props, hooks, children, lastInstance, parentDom, lifecycle, context) {
		props = addChildrenToProps(children, props);

		var dom;
		if (isStatefulComponent(Component)) {
			var instance = new Component(props);

			instance._patch = patch;
			instance._componentToDOMNodeMap = componentToDOMNodeMap;
			if (!isNullOrUndefined(lastInstance) && props.ref) {
				mountRef(lastInstance, props.ref, instance);
			}
			var childContext = instance.getChildContext();

			if (!isNullOrUndefined(childContext)) {
				context = Object.assign({}, context, childContext);
			}
			instance.context = context;
			instance._unmounted = false;
			instance._parentNode = parentNode;
			if (lastInstance) {
				instance._parentComponent = lastInstance;
			}
			instance._pendingSetState = true;
			instance.componentWillMount();
			var node = instance.render();

			if (isInvalidNode(node)) {
				node = createVPlaceholder();
			}
			instance._pendingSetState = false;
			dom = mount(node, null, lifecycle, context, instance, false);
			instance._lastNode = node;
			instance.componentDidMount();
			if (parentDom !== null && !isInvalidNode(dom)) {
				parentDom.appendChild(dom);
			}
			componentToDOMNodeMap.set(instance, dom);
			parentNode.dom = dom;
			parentNode.instance = instance;
		} else {
			if (!isNullOrUndefined(hooks)) {
				if (!isNullOrUndefined(hooks.componentWillMount)) {
					hooks.componentWillMount(null, props);
				}
				if (!isNullOrUndefined(hooks.componentDidMount)) {
					lifecycle.addListener(function () {
						hooks.componentDidMount(dom, props);
					});
				}
			}

			/* eslint new-cap: 0 */
			var node$1 = Component(props, context);
			dom = mount(node$1, null, lifecycle, context, null, false);

			parentNode.instance = node$1;

			if (parentDom !== null && !isInvalidNode(dom)) {
				parentDom.appendChild(dom);
			}
			parentNode.dom = dom;
		}
		return dom;
	}

	function mountAttributes(node, attrs, attrKeys, dom, instance) {
		for (var i = 0; i < attrKeys.length; i++) {
			var attr = attrKeys[i];

			if (attr === 'ref') {
				mountRef(getRefInstance(node, instance), attrs[attr], dom);
			} else {
				patchAttribute(attr, null, attrs[attr], dom);
			}
		}
	}

	function constructDefaults(string, object, value) {
		/* eslint no-return-assign: 0 */
		string.split(',').forEach(function (i) { return object[i] = value; });
	}

	var xlinkNS = 'http://www.w3.org/1999/xlink';
	var xmlNS = 'http://www.w3.org/XML/1998/namespace';
	var strictProps = {};
	var booleanProps = {};
	var namespaces = {};
	var isUnitlessNumber = {};

	constructDefaults('xlink:href,xlink:arcrole,xlink:actuate,xlink:role,xlink:titlef,xlink:type', namespaces, xlinkNS);
	constructDefaults('xml:base,xml:lang,xml:space', namespaces, xmlNS);
	constructDefaults('volume,value', strictProps, true);
	constructDefaults('muted,scoped,loop,open,checked,default,capture,disabled,selected,readonly,multiple,required,autoplay,controls,seamless,reversed,allowfullscreen,novalidate', booleanProps, true);
	constructDefaults('animationIterationCount,borderImageOutset,borderImageSlice,borderImageWidth,boxFlex,boxFlexGroup,boxOrdinalGroup,columnCount,flex,flexGrow,flexPositive,flexShrink,flexNegative,flexOrder,gridRow,gridColumn,fontWeight,lineClamp,lineHeight,opacity,order,orphans,tabSize,widows,zIndex,zoom,fillOpacity,floodOpacity,stopOpacity,strokeDasharray,strokeDashoffset,strokeMiterlimit,strokeOpacity,strokeWidth,', isUnitlessNumber, true);

	function isVText(o) {
		return o.text !== undefined;
	}

	function isVPlaceholder(o) {
		return o.placeholder === true;
	}

	function isVList(o) {
		return o.items !== undefined;
	}

	function insertOrAppend(parentDom, newNode, nextNode) {
		if (isNullOrUndefined(nextNode)) {
			parentDom.appendChild(newNode);
		} else {
			parentDom.insertBefore(newNode, nextNode);
		}
	}

	function replaceVListWithNode(parentDom, vList, dom) {
		var items = vList.items;
		var pointer = vList.pointer;
		var itemsLength = items.length;

		if (itemsLength > 0) {
			for (var i = 0; i < itemsLength; i++) {
				var item = items[i];

				if (isVList(item)) {
					debugger;
				} else {
					removeChild(parentDom, item.dom);
				}
			}
		}
		replaceNode(parentDom, dom, pointer);
	}

	function documentCreateElement(tag, isSVG) {
		var dom;

		if (isSVG === true) {
			dom = document.createElementNS('http://www.w3.org/2000/svg', tag);
		} else {
			dom = document.createElement(tag);
		}
		return dom;
	}

	function appendText(text, parentDom, singleChild) {
		if (parentDom === null) {
			return document.createTextNode(text);
		} else {
			if (singleChild) {
				if (text !== '') {
					parentDom.textContent = text;
					return parentDom.firstChild;
				} else {
					var textNode = document.createTextNode('');

					parentDom.appendChild(textNode);
					return textNode;
				}
			} else {
				var textNode$1 = document.createTextNode(text);

				parentDom.appendChild(textNode$1);
				return textNode$1;
			}
		}
	}

	function replaceWithNewNode(lastNode, nextNode, parentDom, lifecycle, context, instance, isSVG) {
		var lastInstance = null;
		var instanceLastNode = lastNode._lastNode;

		if (!isNullOrUndefined(instanceLastNode)) {
			lastInstance = lastNode;
			lastNode = instanceLastNode;
		}
		detachNode(lastNode);
		var dom = mount(nextNode, null, lifecycle, context, instance, isSVG);

		nextNode.dom = dom;
		replaceNode(parentDom, dom, lastNode.dom);
		if (lastInstance !== null) {
			lastInstance._lastNode = nextNode;
		}
	}

	function replaceNode(parentDom, nextDom, lastDom) {
		parentDom.replaceChild(nextDom, lastDom);
	}

	function detachNode(node, shallow) {
		if (isInvalidNode(node) || isStringOrNumber(node)) {
			return;
		}
		var instance = node.instance;
		var instanceHooks = null;
		var instanceChildren = null;

		if (!isNullOrUndefined(instance)) {
			instanceHooks = instance.hooks;
			instanceChildren = instance.children;

			if (instance.render !== undefined) {
				instance.componentWillUnmount();
				instance._unmounted = true;
				componentToDOMNodeMap.delete(instance);
				!shallow && detachNode(instance._lastNode);
			}
		}
		var hooks = node.hooks || instanceHooks;

		if (!isNullOrUndefined(hooks)) {
			if (!isNullOrUndefined(hooks.willDetach)) {
				hooks.willDetach(node.dom);
			}
			if (!isNullOrUndefined(hooks.componentWillUnmount)) {
				hooks.componentWillUnmount(node.dom, hooks);
			}
		}
		var children = (isNullOrUndefined(instance) ? node.children : null) || instanceChildren;

		if (!isNullOrUndefined(children)) {
			if (isArray(children)) {
				for (var i = 0; i < children.length; i++) {
					detachNode(children[i]);
				}
			} else {
				detachNode(children);
			}
		}
	}

	function normaliseChild(children, i) {
		var child = children[i];

		if (isStringOrNumber(child)) {
			child = children[i] = createVText(child);
		}
		if (isInvalidNode(child)) {
			child = children[i] = createVPlaceholder();
		}
		if (isArray(child)) {
			child = children[i] = createVList(child);
		}
		return child;
	}

	function remove(node, parentDom) {
		var dom = node.dom;
		if (dom === parentDom) {
			dom.innerHTML = '';
		} else {
			parentDom.removeChild(dom);
			if (recyclingEnabled) {
				pool(node);
			}
		}
		detachNode(node);
	}

	function removeChild(parentDom, dom) {
		parentDom.removeChild(dom);
	}

	function removeEvents(events, lastEventKeys, dom) {
		var eventKeys = lastEventKeys || Object.keys(events);

		for (var i = 0; i < eventKeys.length; i++) {
			var event = eventKeys[i];

			dom[event] = null;
		}
	}

	// TODO: for node we need to check if document is valid
	function getActiveNode() {
		return document.activeElement;
	}

	function removeAllChildren(dom, children) {
		if (recyclingEnabled) {
			var childrenLength = children.length;

			if (childrenLength > 5) {
				for (var i = 0; i < childrenLength; i++) {
					var child = children[i];

					if (!isInvalidNode(child)) {
						pool(child);
					}
				}
			}
		}
		dom.textContent = '';
	}

	function resetActiveNode(activeNode) {
		if (activeNode !== null && activeNode !== document.body && document.activeElement !== activeNode) {
			activeNode.focus(); // TODO: verify are we doing new focus event, if user has focus listener this might trigger it
		}
	}

	function isKeyed(lastChildren, nextChildren) {
		return nextChildren.length && !isNullOrUndefined(nextChildren[0]) && !isNullOrUndefined(nextChildren[0].key)
			|| lastChildren.length && !isNullOrUndefined(lastChildren[0]) && !isNullOrUndefined(lastChildren[0].key);
	}

	function selectOptionValueIfNeeded(vdom, values) {
		if (vdom.tag !== 'option') {
			for (var i = 0, len = vdom.children.length; i < len; i++) {
				selectOptionValueIfNeeded(vdom.children[i], values);
			}
			// NOTE! Has to be a return here to catch optGroup elements
			return;
		}

		var value = vdom.attrs && vdom.attrs.value;

		if (values[value]) {
			vdom.attrs = vdom.attrs || {};
			vdom.attrs.selected = 'selected';
			vdom.dom.selected = true;
		} else {
			vdom.dom.selected = false;
		}
	}

	function selectValue(vdom) {
		var value = vdom.attrs && vdom.attrs.value;

		var values = {};
		if (isArray(value)) {
			for (var i = 0, len = value.length; i < len; i++) {
				values[value[i]] = value[i];
			}
		} else {
			values[value] = value;
		}
		for (var i$1 = 0, len$1 = vdom.children.length; i$1 < len$1; i$1++) {
			selectOptionValueIfNeeded(vdom.children[i$1], values);
		}

		if (vdom.attrs && vdom.attrs[value]) {
			delete vdom.attrs.value; // TODO! Avoid deletion here. Set to null or undef. Not sure what you want to usev
		}
	}

	function handleAttachedHooks(hooks, lifecycle, dom) {
		if (!isNullOrUndefined(hooks.created)) {
			hooks.created(dom);
		}
		if (!isNullOrUndefined(hooks.attached)) {
			lifecycle.addListener(function () {
				hooks.attached(dom);
			});
		}
	}

	function setValueProperty(nextNode) {
		var value = nextNode.attrs.value;
		if (!isNullOrUndefined(value)) {
			nextNode.dom.value = value;
		}
	}

	function setFormElementProperties(nextTag, nextNode) {
		if (nextTag === 'input') {
			var inputType = nextNode.attrs.type;
			if (inputType === 'text') {
				setValueProperty(nextNode);
			} else if (inputType === 'checkbox' || inputType === 'radio') {
				var checked = nextNode.attrs.checked;
				nextNode.dom.checked = !!checked;
			}
		} else if (nextTag === 'textarea') {
			setValueProperty(nextNode);
		}
	}

	function diffChildren(lastNode, nextNode, dom, lifecycle, context, instance, isSVG) {
		var nextChildren = nextNode.children;
		var lastChildren = lastNode.children;

		if (lastChildren === nextChildren) {
			return;
		}
		if (isInvalidNode(lastChildren)) {
			if (isStringOrNumber(nextChildren)) {
				updateTextNode(dom, lastChildren, nextChildren);
			} else if (!isInvalidNode(nextChildren)) {
				if (isArray(nextChildren)) {
					mountArrayChildren(nextChildren, dom, lifecycle, context, instance, isSVG);
				} else {
					mount(nextChildren, dom, lifecycle, context, instance, isSVG);
				}
			}
		} else {
			if (isInvalidNode(nextChildren)) {
				removeAllChildren(dom, lastChildren);
			} else {
				if (isArray(lastChildren)) {
					if (isArray(nextChildren)) {
						if (isKeyed(lastChildren, nextChildren)) {
							patchKeyedChildren(lastChildren, nextChildren, dom, lifecycle, context, instance, isSVG);
						} else {
							patchNonKeyedChildren(lastChildren, nextChildren, dom, lifecycle, context, instance, isSVG, null);
						}
					} else {
						patchNonKeyedChildren(lastChildren, [nextChildren], dom, lifecycle, context, instance, null);
					}
				} else {
					if (isArray(nextChildren)) {
						var lastChild = lastChildren;

						if (isStringOrNumber(lastChildren)) {
							lastChild = createVText(lastChild);
							lastChild.dom = dom.firstChild;
						}
						patchNonKeyedChildren([lastChild], nextChildren, dom, lifecycle, context, instance, isSVG, null);
					} else if (isStringOrNumber(nextChildren)) {
						updateTextNode(dom, lastChildren, nextChildren);
					} else if (isStringOrNumber(lastChildren)) {
						patch(lastChildren, nextChildren, dom, lifecycle, context, instance, null, isSVG);
					} else {
						patch(lastChildren, nextChildren, dom, lifecycle, context, instance, true, isSVG);
					}
				}
			}
		}
	}


	function diffRef(instance, lastValue, nextValue, dom) {
		if (instance) {
			if (isString(lastValue)) {
				delete instance.refs[lastValue];
			}
			if (isString(nextValue)) {
				instance.refs[nextValue] = dom;
			}
		}
	}

	function diffEvents(lastNode, nextNode, lastEventKeys, nextEventKeys, dom) {
		var nextEvents = nextNode.events;
		var lastEvents = lastNode.events;
		var nextEventsDefined = !isNullOrUndefined(nextEvents);
		var lastEventsDefined = !isNullOrUndefined(lastEvents);

		if (nextEventsDefined) {
			if (lastEventsDefined) {
				patchEvents(lastEvents, nextEvents, lastEventKeys, nextEventKeys, dom);
			} else {
				mountEvents(nextEvents, nextEventKeys, dom);
			}
		} else if (lastEventsDefined) {
			removeEvents(lastEvents, lastEventKeys, dom);
		}
	}

	function diffAttributes(lastNode, nextNode, lastAttrKeys, nextAttrKeys, dom, instance) {
		if (lastNode.tag === 'select') {
			selectValue(nextNode);
		}
		var nextAttrs = nextNode.attrs;
		var lastAttrs = lastNode.attrs;
		var nextAttrsIsUndef = isNullOrUndefined(nextAttrs);
		var lastAttrsIsNotUndef = !isNullOrUndefined(lastAttrs);

		if (!nextAttrsIsUndef) {
			var nextAttrsKeys = nextAttrKeys || Object.keys(nextAttrs);
			var attrKeysLength = nextAttrsKeys.length;

			for (var i = 0; i < attrKeysLength; i++) {
				var attr = nextAttrsKeys[i];
				var lastAttrVal = lastAttrsIsNotUndef && lastAttrs[attr];
				var nextAttrVal = nextAttrs[attr];

				if (lastAttrVal !== nextAttrVal) {
					if (attr === 'ref') {
						diffRef(instance, lastAttrVal, nextAttrVal, dom);
					} else {
						patchAttribute(attr, lastAttrVal, nextAttrVal, dom);
					}
				}
			}
		}
		if (lastAttrsIsNotUndef) {
			var lastAttrsKeys = lastAttrKeys || Object.keys(lastAttrs);
			var attrKeysLength$1 = lastAttrsKeys.length;

			for (var i$1 = 0; i$1 < attrKeysLength$1; i$1++) {
				var attr$1 = lastAttrsKeys[i$1];

				if (nextAttrsIsUndef || isNullOrUndefined(nextAttrs[attr$1])) {
					if (attr$1 === 'ref') {
						diffRef(getRefInstance(node, instance), lastAttrs[attr$1], null, dom);
					} else {
						dom.removeAttribute(attr$1);
					}
				}
			}
		}
	}

	function diffNodesWithBlueprint(lastNode, nextNode, lastBp, nextBp, parentDom, lifecycle, context, instance, skipLazyCheck) {
		var nextHooks;

		if (nextBp.hasHooks === true) {
			nextHooks = nextNode.hooks;
			if (nextHooks && !isNullOrUndefined(nextHooks.willUpdate)) {
				nextHooks.willUpdate(lastNode.dom);
			}
		}
		var nextTag = nextNode.tag || nextBp.tag;
		var lastTag = lastNode.tag || lastBp.tag;

		if (lastTag !== nextTag) {
			if (lastBp.isComponent === true) {
				var lastNodeInstance = lastNode.instance;

				if (nextBp.isComponent === true) {
					replaceWithNewNode(lastNode, nextNode, parentDom, lifecycle, context, instance, false);
				} else if (isStatefulComponent(lastTag)) {
					detachNode(lastNode, true);
					diffNodes(lastNodeInstance._lastNode, nextNode, parentDom, lifecycle, context, instance, nextBp.isSVG);
				} else {
					detachNode(lastNode, true);
					diffNodes(lastNodeInstance, nextNode, parentDom, lifecycle, context, instance, nextBp.isSVG);
				}
			} else {
				replaceWithNewNode(lastNode, nextNode, parentDom, lifecycle, context, instance, nextBp.isSVG);
			}
		} else if (isNullOrUndefined(lastTag)) {
			nextNode.dom = lastNode.dom;
		} else {
			if (lastBp.isComponent === true) {
				if (nextBp.isComponent === true) {
					var instance$1 = lastNode.instance;

					if (!isNullOrUndefined(instance$1) && instance$1._unmounted) {
						var newDom = mountComponent(nextNode, lastTag, nextNode.attrs || {}, nextNode.hooks, nextNode.children, instance$1, parentDom, lifecycle, context);
						if (parentDom !== null) {
							replaceNode(parentDom, newDom, lastNode.dom);
						}
					} else {
						nextNode.instance = instance$1;
						nextNode.dom = lastNode.dom;
						patchComponent(true, nextNode, nextNode.tag, lastBp, nextBp, instance$1, lastNode.attrs || {}, nextNode.attrs || {}, nextNode.hooks, nextNode.children, parentDom, lifecycle, context);
					}
				}
			} else {
				var dom = lastNode.dom;
				var lastChildrenType = lastBp.childrenType;
				var nextChildrenType = nextBp.childrenType;
				nextNode.dom = dom;

				if (nextBp.lazy === true && skipLazyCheck === false) {
					var clipData = lastNode.clipData;

					if (lifecycle.scrollY === null) {
						lifecycle.refresh();
					}

					nextNode.clipData = clipData;
					if (clipData.pending === true || clipData.top - lifecycle.scrollY > lifecycle.screenHeight) {
						if (setClipNode(clipData, dom, lastNode, nextNode, parentDom, lifecycle)) {
							return;
						}
					}
					if (clipData.bottom < lifecycle.scrollY) {
						if (setClipNode(clipData, dom, lastNode, nextNode, parentDom, lifecycle)) {
							return;
						}
					}
				}

				if (lastChildrenType > 0 || nextChildrenType > 0) {
					if (nextChildrenType === 5 || lastChildrenType === 5) {
						diffChildren(lastNode, nextNode, dom, lifecycle, context, instance);
					} else {
						var lastChildren = lastNode.children;
						var nextChildren = nextNode.children;

						if (lastChildrenType === 0 || isInvalidNode(lastChildren)) {
							if (nextChildrenType > 2) {
								mountArrayChildren(nextChildren, dom, lifecycle, context, instance);
							} else {
								mount(nextChildren, dom, lifecycle, context, instance);
							}
						} else if (nextChildrenType === 0 || isInvalidNode(nextChildren)) {
							if (lastChildrenType > 2) {
								removeAllChildren(dom, lastChildren);
							} else {
								remove(lastChildren, dom);
							}
						} else {
							if (lastChildren !== nextChildren) {
								if (lastChildrenType === 4 && nextChildrenType === 4) {
									patchKeyedChildren(lastChildren, nextChildren, dom, lifecycle, context, instance, null);
								} else if (lastChildrenType === 2 && nextChildrenType === 2) {
									patch(lastChildren, nextChildren, dom, lifecycle, context, instance, true, false);
								} else if (lastChildrenType === 1 && nextChildrenType === 1) {
									updateTextNode(dom, lastChildren, nextChildren);
								} else {
									diffChildren(lastNode, nextNode, dom, lifecycle, context, instance);
								}
							}
						}
					}
				}
				if (lastBp.hasAttrs === true || nextBp.hasAttrs === true) {
					diffAttributes(lastNode, nextNode, lastBp.attrKeys, nextBp.attrKeys, dom, instance);
				}
				if (lastBp.hasEvents === true || nextBp.hasEvents === true) {
					diffEvents(lastNode, nextNode, lastBp.eventKeys, nextBp.eventKeys, dom);
				}
				if (lastBp.hasClassName === true || nextBp.hasClassName === true) {
					var nextClassName = nextNode.className;

					if (lastNode.className !== nextClassName) {
						if (isNullOrUndefined(nextClassName)) {
							dom.removeAttribute('class');
						} else {
							dom.className = nextClassName;
						}
					}
				}
				if (lastBp.hasStyle === true || nextBp.hasStyle === true) {
					var nextStyle = nextNode.style;

					if (lastNode.style !== nextStyle) {
						patchStyle(lastNode.style, nextStyle, dom);
					}
				}
				if (nextBp.hasHooks === true && !isNullOrUndefined(nextHooks.didUpdate)) {
					nextHooks.didUpdate(dom);
				}
				setFormElementProperties(nextTag, nextNode);
			}
		}
	}


	function diffNodes(lastNode, nextNode, parentDom, lifecycle, context, instance, isSVG) {
		var nextHooks = nextNode.hooks;
		var nextHooksDefined = !isNullOrUndefined(nextHooks);

		if (nextHooksDefined && !isNullOrUndefined(nextHooks.willUpdate)) {
			nextHooks.willUpdate(lastNode.dom);
		}
		var nextTag = nextNode.tag || ((isNullOrUndefined(nextNode.bp)) ? null : nextNode.bp.tag);
		var lastTag = lastNode.tag || ((isNullOrUndefined(lastNode.bp)) ? null : lastNode.bp.tag);

		if (nextTag === 'svg') {
			isSVG = true;
		}
		if (lastTag !== nextTag) {
			var lastNodeInstance = lastNode.instance;

			if (isFunction(lastTag)) {
				if (isFunction(nextTag)) {
					replaceWithNewNode(lastNode, nextNode, parentDom, lifecycle, context, instance, isSVG);
				} else if (isStatefulComponent(lastTag)) {
					detachNode(lastNode, true);
					diffNodes(lastNodeInstance._lastNode, nextNode, parentDom, lifecycle, context, instance, isSVG);
				} else {
					detachNode(lastNode, true);
					diffNodes(lastNodeInstance, nextNode, parentDom, lifecycle, context, instance, isSVG);
				}
			} else {
				replaceWithNewNode(lastNodeInstance || lastNode, nextNode, parentDom, lifecycle, context, instance, isSVG);
			}
		} else if (isNullOrUndefined(lastTag)) {
			nextNode.dom = lastNode.dom;
		} else {
			if (isFunction(lastTag)) {
				if (isFunction(nextTag)) {
					var instance$1 = lastNode._instance;

					if (!isNullOrUndefined(instance$1) && instance$1._unmounted) {
						var newDom = mountComponent(nextNode, lastTag, nextNode.attrs || {}, nextNode.hooks, nextNode.children, instance$1, parentDom, lifecycle, context);
						if (parentDom !== null) {
							replaceNode(parentDom, newDom, lastNode.dom);
						}
					} else {
						nextNode.instance = lastNode.instance;
						nextNode.dom = lastNode.dom;
						patchComponent(false, nextNode, nextNode.tag, null, null, nextNode.instance, lastNode.attrs || {}, nextNode.attrs || {}, nextNode.hooks, nextNode.children, parentDom, lifecycle, context);
					}
				}
			} else {
				var dom = lastNode.dom;
				var nextClassName = nextNode.className;
				var nextStyle = nextNode.style;

				nextNode.dom = dom;

				diffChildren(lastNode, nextNode, dom, lifecycle, context, instance, isSVG);
				diffAttributes(lastNode, nextNode, null, null, dom, instance);
				diffEvents(lastNode, nextNode, null, null, dom);

				if (lastNode.className !== nextClassName) {
					if (isNullOrUndefined(nextClassName)) {
						dom.removeAttribute('class');
					} else {
						dom.className = nextClassName;
					}
				}
				if (lastNode.style !== nextStyle) {
					patchStyle(lastNode.style, nextStyle, dom);
				}
				if (nextHooksDefined && !isNullOrUndefined(nextHooks.didUpdate)) {
					nextHooks.didUpdate(dom);
				}
				setFormElementProperties(nextTag, nextNode);
			}
		}
	}

	function updateTextNode(dom, lastChildren, nextChildren) {
		if (isStringOrNumber(lastChildren)) {
			dom.firstChild.nodeValue = nextChildren;
		} else {
			dom.textContent = nextChildren;
		}
	}

	function patchNode(lastNode, nextNode, parentDom, lifecycle, context, instance, isSVG, skipLazyCheck) {
		var lastBp = lastNode.bp;
		var nextBp = nextNode.bp;

		if (lastBp === undefined || nextBp === undefined) {
			diffNodes(lastNode, nextNode, parentDom, lifecycle, context, instance, isSVG);
		} else {
			diffNodesWithBlueprint(lastNode, nextNode, lastBp, nextBp, parentDom, lifecycle, context, instance, skipLazyCheck);
		}
	}

	function patch(lastInput, nextInput, parentDom, lifecycle, context, instance, isNode, isSVG) {
		if (isNode !== null) {
			patchNode(lastInput, nextInput, parentDom, lifecycle, context, instance, isSVG, false);
		} else if (isInvalidNode(lastInput)) {
			mount(nextInput, parentDom, lifecycle, context, instance, isSVG);
		} else if (isInvalidNode(nextInput)) {
			remove(lastInput, parentDom);
		} else if (isStringOrNumber(lastInput)) {
			if (isStringOrNumber(nextInput)) {
				parentDom.firstChild.nodeValue = nextInput;
			} else {
				var dom = mount(nextInput, null, lifecycle, context, instance, isSVG);
				nextInput.dom = dom;
				replaceNode(parentDom, dom, parentDom.firstChild);
			}
		} else if (isStringOrNumber(nextInput)) {
			var textNode = document.createTextNode(nextInput);
			replaceNode(parentDom, textNode, lastInput.dom);
		} else if (!isNullOrUndefined(nextInput.null)) {
			var dom$1;

			if (lastInput.dom) {
				detachNode(lastInput);
				dom$1 = lastInput.dom;
			} else {
				// TODO
			}
			replaceNode(parentDom, nextInput.dom, dom$1);
		} else {
			patchNode(lastInput, nextInput, parentDom, lifecycle, context, instance, isSVG, false);
		}
	}

	function patchStyle(lastAttrValue, nextAttrValue, dom) {
		if (isString(nextAttrValue)) {
			dom.style.cssText = nextAttrValue;
		} else if (isNullOrUndefined(lastAttrValue)) {
			if (!isNullOrUndefined(nextAttrValue)) {
				var styleKeys = Object.keys(nextAttrValue);

				for (var i = 0; i < styleKeys.length; i++) {
					var style = styleKeys[i];
					var value = nextAttrValue[style];

					if (isNumber(value) && !isUnitlessNumber[style]) {
						dom.style[style] = value + 'px';
					} else {
						dom.style[style] = value;
					}
				}
			}
		} else if (isNullOrUndefined(nextAttrValue)) {
			dom.removeAttribute('style');
		} else {
			var styleKeys$1 = Object.keys(nextAttrValue);

			for (var i$1 = 0; i$1 < styleKeys$1.length; i$1++) {
				var style$1 = styleKeys$1[i$1];
				var value$1 = nextAttrValue[style$1];

				if (isNumber(value$1) && !isUnitlessNumber[style$1]) {
					dom.style[style$1] = value$1 + 'px';
				} else {
					dom.style[style$1] = value$1;
				}
			}
			var lastStyleKeys = Object.keys(lastAttrValue);

			for (var i$2 = 0; i$2 < lastStyleKeys.length; i$2++) {
				var style$2 = lastStyleKeys[i$2];
				if (isNullOrUndefined(nextAttrValue[style$2])) {
					dom.style[style$2] = '';
				}
			}
		}
	}

	function patchEvents(lastEvents, nextEvents, _lastEventKeys, _nextEventKeys, dom) {
		var nextEventKeys = _nextEventKeys || Object.keys(nextEvents);

		for (var i = 0; i < nextEventKeys.length; i++) {
			var event = nextEventKeys[i];
			var lastEvent = lastEvents[event];
			var nextEvent = nextEvents[event];

			if (lastEvent !== nextEvent) {
				dom[event] = nextEvent;
			}
		}
		var lastEventKeys = _lastEventKeys || Object.keys(lastEvents);

		for (var i$1 = 0; i$1 < lastEventKeys.length; i$1++) {
			var event$1 = lastEventKeys[i$1];

			if (isNullOrUndefined(nextEvents[event$1])) {
				dom[event$1] = null;
			}
		}
	}

	function patchAttribute(attrName, lastAttrValue, nextAttrValue, dom) {
		if (attrName === 'dangerouslySetInnerHTML') {
			var lastHtml = lastAttrValue && lastAttrValue.__html;
			var nextHtml = nextAttrValue && nextAttrValue.__html;

			if (isNullOrUndefined(nextHtml)) {
				throw new Error('Inferno Error: dangerouslySetInnerHTML requires an object with a __html propety containing the innerHTML content');
			}
			if (lastHtml !== nextHtml) {
				dom.innerHTML = nextHtml;
			}
		} else if (strictProps[attrName]) {
			dom[attrName] = nextAttrValue === null ? '' : nextAttrValue;
		} else {
			if (booleanProps[attrName]) {
				dom[attrName] = nextAttrValue ? true : false;
			} else {
				var ns = namespaces[attrName];

				if (nextAttrValue === false || isNullOrUndefined(nextAttrValue)) {
					if (ns !== undefined) {
						dom.removeAttributeNS(ns, attrName);
					} else {
						dom.removeAttribute(attrName);
					}
				} else {
					if (ns !== undefined) {
						dom.setAttributeNS(ns, attrName, nextAttrValue === true ? attrName : nextAttrValue);
					} else {
						dom.setAttribute(attrName, nextAttrValue === true ? attrName : nextAttrValue);
					}
				}
			}
		}
	}


	function patchComponent(hasBlueprint, lastNode, Component, lastBp, nextBp, instance, lastProps, nextProps, nextHooks, nextChildren, parentDom, lifecycle, context) {
		nextProps = addChildrenToProps(nextChildren, nextProps);

		if (isStatefulComponent(Component)) {
			var prevProps = instance.props;
			var prevState = instance.state;
			var nextState = instance.state;

			var childContext = instance.getChildContext();
			if (!isNullOrUndefined(childContext)) {
				context = Object.assign({}, context, childContext);
			}
			instance.context = context;
			var nextNode = instance._updateComponent(prevState, nextState, prevProps, nextProps);

			if (nextNode === NO_RENDER) {
				nextNode = instance._lastNode;
			} else if (isNullOrUndefined(nextNode)) {
				nextNode = createVPlaceholder();
			}
			patch(instance._lastNode, nextNode, parentDom, lifecycle, context, instance, null, false);
			lastNode.dom = nextNode.dom;
			instance._lastNode = nextNode;
			componentToDOMNodeMap.set(instance, nextNode.dom);
		} else {
			var shouldUpdate = true;
			var nextHooksDefined = (hasBlueprint && nextBp.hasHooks === true) || !isNullOrUndefined(nextHooks);

			if (nextHooksDefined && !isNullOrUndefined(nextHooks.componentShouldUpdate)) {
				shouldUpdate = nextHooks.componentShouldUpdate(lastNode.dom, lastProps, nextProps);
			}
			if (shouldUpdate !== false) {
				if (nextHooksDefined && !isNullOrUndefined(nextHooks.componentWillUpdate)) {
					nextHooks.componentWillUpdate(lastNode.dom, lastProps, nextProps);
				}
				var nextNode$1 = Component(nextProps, context);

				if (isInvalidNode(nextNode$1)) {
					nextNode$1 = createVPlaceholder();
				}
				nextNode$1.dom = lastNode.dom;
				patch(instance, nextNode$1, parentDom, lifecycle, context, null, null, false);
				lastNode.instance = nextNode$1;
				if (nextHooksDefined && !isNullOrUndefined(nextHooks.componentDidUpdate)) {
					nextHooks.componentDidUpdate(lastNode.dom, lastProps, nextProps);
				}
			}
		}
	}

	function patchVList(lastVList, nextVList, parentDom, lifecycle, context, instance, isSVG) {
		var lastItems = lastVList.items;
		var nextItems = nextVList.items;
		var pointer = lastVList.pointer;
		var dom = lastVList.dom;

		nextVList.dom = dom;
		nextVList.pointer = pointer;
		if (!lastItems !== nextItems) {
			if (isKeyed(lastItems, nextItems)) {
				patchKeyedChildren(lastItems, nextItems, parentDom, lifecycle, context, instance, isSVG, nextVList);
			} else {
				patchNonKeyedChildren(lastItems, nextItems, parentDom, lifecycle, context, instance, isSVG, nextVList);
			}
		}
	}

	function patchNonKeyedChildren(lastChildren, nextChildren, dom, lifecycle, context, instance, isSVG, parentVList) {
		var lastChildrenLength = lastChildren.length;
		var nextChildrenLength = nextChildren.length;
		var commonLength = lastChildrenLength > nextChildrenLength ? nextChildrenLength : lastChildrenLength;
		var i = 0;

		for (; i < commonLength; i++) {
			var lastChild = lastChildren[i];
			var nextChild = normaliseChild(nextChildren, i);
			var domNode;

			if (lastChild !== nextChild) {
				if (isVList(nextChild)) {
					if (isVList(lastChild)) {
						patchVList(lastChild, nextChild, dom, lifecycle, context, instance, isSVG);
					} else {
						replaceNode(dom, mountVList(nextChild, null), lastChild.dom);
						detachNode(lastChild);
					}
				} else if (isVList(lastChild)) {
					replaceVListWithNode(dom, lastChild, mount(nextChild));
				} else if (isVPlaceholder(nextChild)) {
					if (isVPlaceholder(lastChild)) {
						patchVFragment(lastChild, nextChild);
					} else {
						replaceNode(dom, mountVPlaceholder(nextChild, null), lastChild.dom);
						detachNode(lastChild);
					}
				} else if (isVPlaceholder(lastChild)) {
					replaceNode(dom, mount(nextChild, null), lastChild.dom);
				} else if (isVText(nextChild)) {
					if (isVText(lastChild)) {
						patchVText(lastChild, nextChild);
					} else {
						replaceNode(dom, mountVText(nextChild, null), lastChild.dom);
						detachNode(lastChild);
					}
				} else if (isVText(lastChild)) {
					replaceNode(dom, mount(nextChild, null, lifecycle, context, instance, isSVG), lastChild.dom);
				} else {
					patch(lastChild, nextChild, dom, lifecycle, context, instance, false, isSVG);
				}
			}
		}
		if (lastChildrenLength < nextChildrenLength) {
			for (i = commonLength; i < nextChildrenLength; i++) {
				var child = normaliseChild(nextChildren, i);
				var domNode$1;

				if (isVText(child)) {
					domNode$1 = mountVText(child, null);
				} else {
					domNode$1 = mount(child, null, lifecycle, context, instance, isSVG);
				}
				if (!isInvalidNode(domNode$1)) {
					insertOrAppend(dom, domNode$1, parentVList && parentVList.pointer);
				}
			}
		} else if (lastChildrenLength > nextChildrenLength) {
			for (i = commonLength; i < lastChildrenLength; i++) {
				var child$1 = lastChildren[i];

				removeChild(dom, child$1.dom);
				detachNode(child$1);
			}
		}
	}

	function patchVFragment(lastVFragment, nextVFragment) {
		nextVFragment.dom = lastVFragment.dom;
	}

	function patchVText(lastVText, nextVText) {
		var nextText = nextVText.text;
		var dom = lastVText.dom;

		nextVText.dom = dom;
		if (lastVText.text !== nextText) {
			dom.nodeValue = nextText;
		}
	}

	function patchKeyedChildren(lastChildren, nextChildren, dom, lifecycle, context, instance, isSVG, parentVList) {
		var lastChildrenLength = lastChildren.length;
		var nextChildrenLength = nextChildren.length;
		var i;
		var lastEndIndex = lastChildrenLength - 1;
		var nextEndIndex = nextChildrenLength - 1;
		var lastStartIndex = 0;
		var nextStartIndex = 0;
		var lastStartNode = null;
		var nextStartNode = null;
		var nextEndNode = null;
		var lastEndNode = null;
		var index;
		var nextNode;
		var lastTarget = 0;
		var pos;
		var prevItem;

		while (lastStartIndex <= lastEndIndex && nextStartIndex <= nextEndIndex) {
			nextStartNode = nextChildren[nextStartIndex];
			lastStartNode = lastChildren[lastStartIndex];

			if (nextStartNode.key !== lastStartNode.key) {
				break;
			}
			patch(lastStartNode, nextStartNode, dom, lifecycle, context, instance, true, isSVG);
			nextStartIndex++;
			lastStartIndex++;
		}
		while (lastStartIndex <= lastEndIndex && nextStartIndex <= nextEndIndex) {
			nextEndNode = nextChildren[nextEndIndex];
			lastEndNode = lastChildren[lastEndIndex];

			if (nextEndNode.key !== lastEndNode.key) {
				break;
			}
			patch(lastEndNode, nextEndNode, dom, lifecycle, context, instance, true, isSVG);
			nextEndIndex--;
			lastEndIndex--;
		}
		while (lastStartIndex <= lastEndIndex && nextStartIndex <= nextEndIndex) {
			nextEndNode = nextChildren[nextEndIndex];
			lastStartNode = lastChildren[lastStartIndex];

			if (nextEndNode.key !== lastStartNode.key) {
				break;
			}
			nextNode = (nextEndIndex + 1 < nextChildrenLength) ? nextChildren[nextEndIndex + 1].dom : null;
			patch(lastStartNode, nextEndNode, dom, lifecycle, context, instance, true, isSVG);
			insertOrAppend(dom, nextEndNode.dom, nextNode);
			nextEndIndex--;
			lastStartIndex++;
		}
		while (lastStartIndex <= lastEndIndex && nextStartIndex <= nextEndIndex) {
			nextStartNode = nextChildren[nextStartIndex];
			lastEndNode = lastChildren[lastEndIndex];

			if (nextStartNode.key !== lastEndNode.key) {
				break;
			}
			nextNode = lastChildren[lastStartIndex].dom;
			patch(lastEndNode, nextStartNode, dom, lifecycle, context, instance, true, isSVG);
			insertOrAppend(dom, nextStartNode.dom, nextNode);
			nextStartIndex++;
			lastEndIndex--;
		}

		if (lastStartIndex > lastEndIndex) {
			if (nextStartIndex <= nextEndIndex) {
				nextNode = (nextEndIndex + 1 < nextChildrenLength) ? nextChildren[nextEndIndex + 1].dom : parentVList && parentVList.pointer;
				for (; nextStartIndex <= nextEndIndex; nextStartIndex++) {
					insertOrAppend(dom, mount(nextChildren[nextStartIndex], null, lifecycle, context, instance, isSVG), nextNode);
				}
			}
		} else if (nextStartIndex > nextEndIndex) {
			while (lastStartIndex <= lastEndIndex) {
				remove(lastChildren[lastStartIndex++], dom);
			}
		} else {
			var aLength = lastEndIndex - lastStartIndex + 1;
			var bLength = nextEndIndex - nextStartIndex + 1;
			var sources = new Array(bLength);

			// Mark all nodes as inserted.
			for (i = 0; i < bLength; i++) {
				sources[i] = -1;
			}
			var moved = false;
			var removeOffset = 0;

			if (aLength * bLength <= 16) {
				for (i = lastStartIndex; i <= lastEndIndex; i++) {
					var removed = true;
					lastEndNode = lastChildren[i];
					for (index = nextStartIndex; index <= nextEndIndex; index++) {
						nextEndNode = nextChildren[index];
						if (lastEndNode.key === nextEndNode.key) {
							sources[index - nextStartIndex] = i;

							if (lastTarget > index) {
								moved = true;
							} else {
								lastTarget = index;
							}
							patch(lastEndNode, nextEndNode, dom, lifecycle, context, instance, true, isSVG);
							removed = false;
							break;
						}
					}
					if (removed) {
						remove(lastEndNode, dom);
						removeOffset++;
					}
				}
			} else {
				var prevItemsMap = new Map();

				for (i = nextStartIndex; i <= nextEndIndex; i++) {
					prevItem = nextChildren[i];
					prevItemsMap.set(prevItem.key, i);
				}
				for (i = lastEndIndex; i >= lastStartIndex; i--) {
					lastEndNode = lastChildren[i];
					index = prevItemsMap.get(lastEndNode.key);

					if (index === undefined) {
						remove(lastEndNode, dom);
						removeOffset++;
					} else {
						nextEndNode = nextChildren[index];

						sources[index - nextStartIndex] = i;
						if (lastTarget > index) {
							moved = true;
						} else {
							lastTarget = index;
						}
						patch(lastEndNode, nextEndNode, dom, lifecycle, context, instance, true, isSVG);
					}
				}
			}

			if (moved) {
				var seq = lis_algorithm(sources);
				index = seq.length - 1;
				for (i = bLength - 1; i >= 0; i--) {
					if (sources[i] === -1) {
						pos = i + nextStartIndex;
						nextNode = (pos + 1 < nextChildrenLength) ? nextChildren[pos + 1].dom : parentVList && parentVList.pointer;
						insertOrAppend(dom, mount(nextChildren[pos], null, lifecycle, context, instance, isSVG), nextNode);
					} else {
						if (index < 0 || i !== seq[index]) {
							pos = i + nextStartIndex;
							nextNode = (pos + 1 < nextChildrenLength) ? nextChildren[pos + 1].dom : parentVList && parentVList.pointer;
							insertOrAppend(dom, nextChildren[pos].dom, nextNode);
						} else {
							index--;
						}
					}
				}
			} else if (aLength - removeOffset !== bLength) {
				for (i = bLength - 1; i >= 0; i--) {
					if (sources[i] === -1) {
						pos = i + nextStartIndex;
						nextNode = (pos + 1 < nextChildrenLength) ? nextChildren[pos + 1].dom : parentVList && parentVList.pointer;
						insertOrAppend(dom, mount(nextChildren[pos], null, lifecycle, context, instance, isSVG), nextNode);
					}
				}
			}
		}
	}

	// https://en.wikipedia.org/wiki/Longest_increasing_subsequence
	function lis_algorithm(a) {
		var p = a.slice(0);
		var result = [];
		result.push(0);
		var i;
		var j;
		var u;
		var v;
		var c;

		for (i = 0; i < a.length; i++) {
			if (a[i] === -1) {
				continue;
			}

			j = result[result.length - 1];
			if (a[j] < a[i]) {
				p[i] = j;
				result.push(i);
				continue;
			}

			u = 0;
			v = result.length - 1;

			while (u < v) {
				c = ((u + v) / 2) | 0;
				if (a[result[c]] < a[i]) {
					u = c + 1;
				} else {
					v = c;
				}
			}

			if (a[i] < a[result[u]]) {
				if (u > 0) {
					p[i] = result[u - 1];
				}
				result[u] = i;
			}
		}

		u = result.length;
		v = result[u - 1];

		while (u-- > 0) {
			result[u] = v;
			v = p[v];
		}

		return result;
	}

	var screenWidth = isBrowser && window.screen.width;
	var screenHeight = isBrowser && window.screen.height;
	var scrollX = 0;
	var scrollY = 0;
	var lastScrollTime = 0;

	if (isBrowser) {
		window.onscroll = function (e) {
			scrollX = window.scrollX;
			scrollY = window.scrollY;
			lastScrollTime = performance.now();
		};

		window.resize = function (e) {
			scrollX = window.scrollX;
			scrollY = window.scrollY;
			screenWidth = window.screen.width;
			screenHeight = window.screen.height;
			lastScrollTime = performance.now();
		};
	}

	function Lifecycle() {
		this._listeners = [];
		this.scrollX = null;
		this.scrollY = null;
		this.screenHeight = screenHeight;
		this.screenWidth = screenWidth;
	}

	Lifecycle.prototype = {
		refresh: function refresh() {
			this.scrollX = isBrowser && window.scrollX;
			this.scrollY = isBrowser && window.scrollY;
		},
		addListener: function addListener(callback) {
			this._listeners.push(callback);
		},
		trigger: function trigger() {
			var this$1 = this;

			for (var i = 0; i < this._listeners.length; i++) {
				this$1._listeners[i]();
			}
		}
	};

	var lazyNodeMap = new Map();
	var lazyCheckRunning = false;

	function handleLazyAttached(node, lifecycle, dom) {
		lifecycle.addListener(function () {
			var rect = dom.getBoundingClientRect();

			if (lifecycle.scrollY === null) {
				lifecycle.refresh();
			}
			node.clipData = {
				top: rect.top + lifecycle.scrollY,
				left: rect.left + lifecycle.scrollX,
				bottom: rect.bottom + lifecycle.scrollY,
				right: rect.right + lifecycle.scrollX,
				pending: false
			};
		});
	}

	function patchLazyNode(value) {
		patchNode(value.lastNode, value.nextNode, value.parentDom, value.lifecycle, null, null, false, true);
		value.clipData.pending = false;
	}

	function runPatchLazyNodes() {
		lazyCheckRunning = true;
		setTimeout(patchLazyNodes, 100);
	}

	function patchLazyNodes() {
		lazyNodeMap.forEach(patchLazyNode);
		lazyNodeMap.clear();
		lazyCheckRunning = false;
	}

	function setClipNode(clipData, dom, lastNode, nextNode, parentDom, lifecycle) {
		if (performance.now() > lastScrollTime + 2000) {
			var lazyNodeEntry = lazyNodeMap.get(dom);

			if (lazyNodeEntry === undefined) {
				lazyNodeMap.set(dom, { lastNode: lastNode, nextNode: nextNode, parentDom: parentDom, clipData: clipData, lifecycle: lifecycle });
			} else {
				lazyNodeEntry.nextNode = nextNode;
			}
			clipData.pending = true;
			if (lazyCheckRunning === false) {
				runPatchLazyNodes();
			}
			return true;
		} else {
			patchLazyNodes();
		}
		return false;
	}

	function hydrateChild(child, childNodes, counter, parentDom, lifecycle, context, instance) {
		var domNode = childNodes[counter.i];

		if (isVText(child)) {
			var text = child.text;

			child.dom = domNode;
			if (domNode.nodeType === 3 && text !== '') {
				domNode.nodeValue = text;
			} else {
				var newDomNode = mountVText(text);

				replaceNode(parentDom, newDomNodetextNode, domNode);
				parentChildNodes.splice(parentChildNodes.indexOf(domNode), 1, newDomNode);
				child.dom = newDomNode;
			}
		} else if (isVPlaceholder(child)) {
			child.dom = domNode;
		} else if (isVList(child)) {
			var items = child.items;

			// this doesn't really matter, as it won't be used again, but it's what it should be given the purpose of VList
			child.dom = document.createDocumentFragment();
			for (var i = 0; i < items.length; i++) {
				var rebuild = hydrateChild(normaliseChild(items, i), childNodes, counter, parentDom, lifecycle, context, instance);

				if (rebuild) {
					return true;
				}
			}
			// at the end of every VList, there should be a "pointer". It's an empty TextNode used for tracking the VList
			var pointer = childNodes[counter.i++];

			if (pointer && pointer.nodeType === 3) {
				child.pointer = pointer;
			} else {
				// there is a problem, we need to rebuild this tree
				return true;
			}
		} else {
			var rebuild$1 = hydrateNode(child, domNode, parentDom, lifecycle, context, instance, false);

			if (rebuild$1) {
				return true;
			}
		}
		counter.i++;
	}

	function getChildNodesWithoutComments(domNode) {
		var childNodes = [];
		var rawChildNodes = domNode.childNodes;
		var length = rawChildNodes.length;
		var i = 0;

		while (i < length) {
			var rawChild = rawChildNodes[i];

			if (rawChild.nodeType === 8) {
				if (rawChild.data === '!') {
					var placeholder = document.createTextNode('');

					domNode.replaceChild(placeholder, rawChild);
					childNodes.push(placeholder);
					i++;
				} else {
					domNode.removeChild(rawChild);
					length--;
				}
			} else {
				childNodes.push(rawChild);
				i++;
			}
		}
		return childNodes;
	}

	function hydrateComponent(node, Component, props, hooks, children, domNode, parentDom, lifecycle, context, lastInstance, isRoot) {
		props = addChildrenToProps(children, props);

		if (isStatefulComponent(Component)) {
			var instance = node.instance = new Component(props);

			instance._patch = patch;
			if (!isNullOrUndefined(lastInstance) && props.ref) {
				mountRef(lastInstance, props.ref, instance);
			}
			var childContext = instance.getChildContext();

			if (!isNullOrUndefined(childContext)) {
				context = Object.assign({}, context, childContext);
			}
			instance.context = context;
			instance._unmounted = false;
			instance._parentNode = node;
			if (lastInstance) {
				instance._parentComponent = lastInstance;
			}
			instance._pendingSetState = true;
			instance.componentWillMount();
			var nextNode = instance.render();

			instance._pendingSetState = false;
			if (isInvalidNode(nextNode)) {
				nextNode = createVPlaceholder();
			}
			hydrateNode(nextNode, domNode, parentDom, lifecycle, context, instance, isRoot);
			instance._lastNode = nextNode;
			instance.componentDidMount();

		} else {
			var instance$1 = node.instance = Component(props);

			if (!isNullOrUndefined(hooks)) {
				if (!isNullOrUndefined(hooks.componentWillMount)) {
					hooks.componentWillMount(null, props);
				}
				if (!isNullOrUndefined(hooks.componentDidMount)) {
					lifecycle.addListener(function () {
						hooks.componentDidMount(domNode, props);
					});
				}
			}
			return hydrateNode(instance$1, domNode, parentDom, lifecycle, context, instance$1, isRoot);
		}
	}

	function hydrateNode(node, domNode, parentDom, lifecycle, context, instance, isRoot) {
		var bp = node.bp;
		var tag = node.tag || bp.tag;

		if (isFunction(tag)) {
			node.dom = domNode;
			hydrateComponent(node, tag, node.attrs || {}, node.hooks, node.children, domNode, parentDom, lifecycle, context, instance, isRoot);
		} else {
			if (
				domNode.nodeType !== 1 ||
				tag !== domNode.tagName.toLowerCase()
			) {
				// TODO remake node
			} else {
				node.dom = domNode;
				var hooks = node.hooks;

				if ((bp && bp.hasHooks === true) || !isNullOrUndefined(hooks)) {
					handleAttachedHooks(hooks, lifecycle, domNode);
				}
				var children = node.children;

				if (!isNullOrUndefined(children)) {
					if (isStringOrNumber(children)) {
						if (domNode.textContent !== children) {
							domNode.textContent = children;
						}
					} else {
						var childNodes = getChildNodesWithoutComments(domNode);
						var counter = { i: 0 };
						var rebuild = false;

						if (isArray(children)) {
							for (var i = 0; i < children.length; i++) {
								rebuild = hydrateChild(normaliseChild(children, i), childNodes, counter, domNode, lifecycle, context, instance);

								if (rebuild) {
									break;
								}
							}
						} else {
							if (childNodes.length === 1) {
								rebuild = hydrateChild(children, childNodes, counter, domNode, lifecycle, context, instance);
							} else {
								rebuild = true;
							}
						}

						if (rebuild) {
							// TODO scrap children and rebuild again
						}
					}
				}
				var className = node.className;
				var style = node.style;

				if (!isNullOrUndefined(className)) {
					domNode.className = className;
				}
				if (!isNullOrUndefined(style)) {
					patchStyle(null, style, domNode);
				}
				if (bp && bp.hasAttrs === true) {
					mountBlueprintAttrs(node, bp, domNode, instance);
				} else {
					var attrs = node.attrs;

					if (!isNullOrUndefined(attrs)) {
						handleSelects(node);
						mountAttributes(node, attrs, Object.keys(attrs), domNode, instance);
					}
				}
				if (bp && bp.hasEvents === true) {
					mountBlueprintEvents(node, bp, domNode);
				} else {
					var events = node.events;

					if (!isNullOrUndefined(events)) {
						mountEvents(events, Object.keys(events), domNode);
					}
				}
			}
		}
	}

	var documetBody = document.body;

	function hydrate(node, parentDom, lifecycle) {
		if (parentDom && parentDom.nodeType === 1) {
			var rootNode = parentDom.querySelector('[data-infernoroot]');

			if (rootNode && rootNode.parentNode === parentDom) {
				hydrateNode(node, rootNode, parentDom, lifecycle, {}, true);
				return true;
			}
		}
		// clear parentDom, unless it's document.body
		if (parentDom !== documetBody) {
			parentDom.textContent = '';
		} else {
			console.warn('Inferno Warning: rendering to the "document.body" is dangerous! Use a dedicated container element instead.');
		}
		return false;
	}

	var roots = new Map();
	var componentToDOMNodeMap = new Map();

	function findDOMNode(domNode) {
		return componentToDOMNodeMap.get(domNode) || null;
	}

	function render(input, parentDom) {
		var root = roots.get(parentDom);
		var lifecycle = new Lifecycle();

		if (isUndefined(root)) {
			if (!isInvalidNode(input)) {
				var skipMount = true;

				if (!hydrate(input, parentDom, lifecycle)) {
					mount(input, parentDom, lifecycle, {}, null, false);
				}
				lifecycle.trigger();
				roots.set(parentDom, { input: input });
			}
		} else {
			var activeNode = getActiveNode();

			patch(root.input, input, parentDom, lifecycle, {}, null, null, false);
			lifecycle.trigger();
			if (isNull(input)) {
				roots.delete(parentDom);
			}
			root.input = input;
			resetActiveNode(activeNode);
		}
	}

	var index = {
		render: render,
		findDOMNode: findDOMNode
	};

	return index;

}));