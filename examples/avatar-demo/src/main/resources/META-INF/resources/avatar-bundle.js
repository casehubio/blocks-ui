var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i5 = decorators.length - 1, decorator; i5 >= 0; i5--)
    if (decorator = decorators[i5])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// node_modules/@lit/reactive-element/css-tag.js
var t = globalThis;
var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = /* @__PURE__ */ Symbol();
var o = /* @__PURE__ */ new WeakMap();
var n = class {
  constructor(t4, e5, o6) {
    if (this._$cssResult$ = true, o6 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t4, this.t = e5;
  }
  get styleSheet() {
    let t4 = this.o;
    const s4 = this.t;
    if (e && void 0 === t4) {
      const e5 = void 0 !== s4 && 1 === s4.length;
      e5 && (t4 = o.get(s4)), void 0 === t4 && ((this.o = t4 = new CSSStyleSheet()).replaceSync(this.cssText), e5 && o.set(s4, t4));
    }
    return t4;
  }
  toString() {
    return this.cssText;
  }
};
var r = (t4) => new n("string" == typeof t4 ? t4 : t4 + "", void 0, s);
var i = (t4, ...e5) => {
  const o6 = 1 === t4.length ? t4[0] : e5.reduce((e6, s4, o7) => e6 + ((t5) => {
    if (true === t5._$cssResult$) return t5.cssText;
    if ("number" == typeof t5) return t5;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t5 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s4) + t4[o7 + 1], t4[0]);
  return new n(o6, t4, s);
};
var S = (s4, o6) => {
  if (e) s4.adoptedStyleSheets = o6.map((t4) => t4 instanceof CSSStyleSheet ? t4 : t4.styleSheet);
  else for (const e5 of o6) {
    const o7 = document.createElement("style"), n5 = t.litNonce;
    void 0 !== n5 && o7.setAttribute("nonce", n5), o7.textContent = e5.cssText, s4.appendChild(o7);
  }
};
var c = e ? (t4) => t4 : (t4) => t4 instanceof CSSStyleSheet ? ((t5) => {
  let e5 = "";
  for (const s4 of t5.cssRules) e5 += s4.cssText;
  return r(e5);
})(t4) : t4;

// node_modules/@lit/reactive-element/reactive-element.js
var { is: i2, defineProperty: e2, getOwnPropertyDescriptor: h, getOwnPropertyNames: r2, getOwnPropertySymbols: o2, getPrototypeOf: n2 } = Object;
var a = globalThis;
var c2 = a.trustedTypes;
var l = c2 ? c2.emptyScript : "";
var p = a.reactiveElementPolyfillSupport;
var d = (t4, s4) => t4;
var u = { toAttribute(t4, s4) {
  switch (s4) {
    case Boolean:
      t4 = t4 ? l : null;
      break;
    case Object:
    case Array:
      t4 = null == t4 ? t4 : JSON.stringify(t4);
  }
  return t4;
}, fromAttribute(t4, s4) {
  let i5 = t4;
  switch (s4) {
    case Boolean:
      i5 = null !== t4;
      break;
    case Number:
      i5 = null === t4 ? null : Number(t4);
      break;
    case Object:
    case Array:
      try {
        i5 = JSON.parse(t4);
      } catch (t5) {
        i5 = null;
      }
  }
  return i5;
} };
var f = (t4, s4) => !i2(t4, s4);
var b = { attribute: true, type: String, converter: u, reflect: false, useDefault: false, hasChanged: f };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), a.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var y = class extends HTMLElement {
  static addInitializer(t4) {
    this._$Ei(), (this.l ??= []).push(t4);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t4, s4 = b) {
    if (s4.state && (s4.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t4) && ((s4 = Object.create(s4)).wrapped = true), this.elementProperties.set(t4, s4), !s4.noAccessor) {
      const i5 = /* @__PURE__ */ Symbol(), h3 = this.getPropertyDescriptor(t4, i5, s4);
      void 0 !== h3 && e2(this.prototype, t4, h3);
    }
  }
  static getPropertyDescriptor(t4, s4, i5) {
    const { get: e5, set: r6 } = h(this.prototype, t4) ?? { get() {
      return this[s4];
    }, set(t5) {
      this[s4] = t5;
    } };
    return { get: e5, set(s5) {
      const h3 = e5?.call(this);
      r6?.call(this, s5), this.requestUpdate(t4, h3, i5);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t4) {
    return this.elementProperties.get(t4) ?? b;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d("elementProperties"))) return;
    const t4 = n2(this);
    t4.finalize(), void 0 !== t4.l && (this.l = [...t4.l]), this.elementProperties = new Map(t4.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
      const t5 = this.properties, s4 = [...r2(t5), ...o2(t5)];
      for (const i5 of s4) this.createProperty(i5, t5[i5]);
    }
    const t4 = this[Symbol.metadata];
    if (null !== t4) {
      const s4 = litPropertyMetadata.get(t4);
      if (void 0 !== s4) for (const [t5, i5] of s4) this.elementProperties.set(t5, i5);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t5, s4] of this.elementProperties) {
      const i5 = this._$Eu(t5, s4);
      void 0 !== i5 && this._$Eh.set(i5, t5);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s4) {
    const i5 = [];
    if (Array.isArray(s4)) {
      const e5 = new Set(s4.flat(1 / 0).reverse());
      for (const s5 of e5) i5.unshift(c(s5));
    } else void 0 !== s4 && i5.push(c(s4));
    return i5;
  }
  static _$Eu(t4, s4) {
    const i5 = s4.attribute;
    return false === i5 ? void 0 : "string" == typeof i5 ? i5 : "string" == typeof t4 ? t4.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t4) => this.enableUpdating = t4), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t4) => t4(this));
  }
  addController(t4) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t4), void 0 !== this.renderRoot && this.isConnected && t4.hostConnected?.();
  }
  removeController(t4) {
    this._$EO?.delete(t4);
  }
  _$E_() {
    const t4 = /* @__PURE__ */ new Map(), s4 = this.constructor.elementProperties;
    for (const i5 of s4.keys()) this.hasOwnProperty(i5) && (t4.set(i5, this[i5]), delete this[i5]);
    t4.size > 0 && (this._$Ep = t4);
  }
  createRenderRoot() {
    const t4 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S(t4, this.constructor.elementStyles), t4;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t4) => t4.hostConnected?.());
  }
  enableUpdating(t4) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t4) => t4.hostDisconnected?.());
  }
  attributeChangedCallback(t4, s4, i5) {
    this._$AK(t4, i5);
  }
  _$ET(t4, s4) {
    const i5 = this.constructor.elementProperties.get(t4), e5 = this.constructor._$Eu(t4, i5);
    if (void 0 !== e5 && true === i5.reflect) {
      const h3 = (void 0 !== i5.converter?.toAttribute ? i5.converter : u).toAttribute(s4, i5.type);
      this._$Em = t4, null == h3 ? this.removeAttribute(e5) : this.setAttribute(e5, h3), this._$Em = null;
    }
  }
  _$AK(t4, s4) {
    const i5 = this.constructor, e5 = i5._$Eh.get(t4);
    if (void 0 !== e5 && this._$Em !== e5) {
      const t5 = i5.getPropertyOptions(e5), h3 = "function" == typeof t5.converter ? { fromAttribute: t5.converter } : void 0 !== t5.converter?.fromAttribute ? t5.converter : u;
      this._$Em = e5;
      const r6 = h3.fromAttribute(s4, t5.type);
      this[e5] = r6 ?? this._$Ej?.get(e5) ?? r6, this._$Em = null;
    }
  }
  requestUpdate(t4, s4, i5, e5 = false, h3) {
    if (void 0 !== t4) {
      const r6 = this.constructor;
      if (false === e5 && (h3 = this[t4]), i5 ??= r6.getPropertyOptions(t4), !((i5.hasChanged ?? f)(h3, s4) || i5.useDefault && i5.reflect && h3 === this._$Ej?.get(t4) && !this.hasAttribute(r6._$Eu(t4, i5)))) return;
      this.C(t4, s4, i5);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t4, s4, { useDefault: i5, reflect: e5, wrapped: h3 }, r6) {
    i5 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t4) && (this._$Ej.set(t4, r6 ?? s4 ?? this[t4]), true !== h3 || void 0 !== r6) || (this._$AL.has(t4) || (this.hasUpdated || i5 || (s4 = void 0), this._$AL.set(t4, s4)), true === e5 && this._$Em !== t4 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t4));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t5) {
      Promise.reject(t5);
    }
    const t4 = this.scheduleUpdate();
    return null != t4 && await t4, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [t6, s5] of this._$Ep) this[t6] = s5;
        this._$Ep = void 0;
      }
      const t5 = this.constructor.elementProperties;
      if (t5.size > 0) for (const [s5, i5] of t5) {
        const { wrapped: t6 } = i5, e5 = this[s5];
        true !== t6 || this._$AL.has(s5) || void 0 === e5 || this.C(s5, void 0, i5, e5);
      }
    }
    let t4 = false;
    const s4 = this._$AL;
    try {
      t4 = this.shouldUpdate(s4), t4 ? (this.willUpdate(s4), this._$EO?.forEach((t5) => t5.hostUpdate?.()), this.update(s4)) : this._$EM();
    } catch (s5) {
      throw t4 = false, this._$EM(), s5;
    }
    t4 && this._$AE(s4);
  }
  willUpdate(t4) {
  }
  _$AE(t4) {
    this._$EO?.forEach((t5) => t5.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t4)), this.updated(t4);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t4) {
    return true;
  }
  update(t4) {
    this._$Eq &&= this._$Eq.forEach((t5) => this._$ET(t5, this[t5])), this._$EM();
  }
  updated(t4) {
  }
  firstUpdated(t4) {
  }
};
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[d("elementProperties")] = /* @__PURE__ */ new Map(), y[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: y }), (a.reactiveElementVersions ??= []).push("2.1.2");

// node_modules/lit-html/lit-html.js
var t2 = globalThis;
var i3 = (t4) => t4;
var s2 = t2.trustedTypes;
var e3 = s2 ? s2.createPolicy("lit-html", { createHTML: (t4) => t4 }) : void 0;
var h2 = "$lit$";
var o3 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n3 = "?" + o3;
var r3 = `<${n3}>`;
var l2 = document;
var c3 = () => l2.createComment("");
var a2 = (t4) => null === t4 || "object" != typeof t4 && "function" != typeof t4;
var u2 = Array.isArray;
var d2 = (t4) => u2(t4) || "function" == typeof t4?.[Symbol.iterator];
var f2 = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p2 = RegExp(`>|${f2}(?:([^\\s"'>=/]+)(${f2}*=${f2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y2 = /^(?:script|style|textarea|title)$/i;
var x = (t4) => (i5, ...s4) => ({ _$litType$: t4, strings: i5, values: s4 });
var b2 = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l2.createTreeWalker(l2, 129);
function V(t4, i5) {
  if (!u2(t4) || !t4.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e3 ? e3.createHTML(i5) : i5;
}
var N = (t4, i5) => {
  const s4 = t4.length - 1, e5 = [];
  let n5, l3 = 2 === i5 ? "<svg>" : 3 === i5 ? "<math>" : "", c4 = v;
  for (let i6 = 0; i6 < s4; i6++) {
    const s5 = t4[i6];
    let a3, u3, d3 = -1, f3 = 0;
    for (; f3 < s5.length && (c4.lastIndex = f3, u3 = c4.exec(s5), null !== u3); ) f3 = c4.lastIndex, c4 === v ? "!--" === u3[1] ? c4 = _ : void 0 !== u3[1] ? c4 = m : void 0 !== u3[2] ? (y2.test(u3[2]) && (n5 = RegExp("</" + u3[2], "g")), c4 = p2) : void 0 !== u3[3] && (c4 = p2) : c4 === p2 ? ">" === u3[0] ? (c4 = n5 ?? v, d3 = -1) : void 0 === u3[1] ? d3 = -2 : (d3 = c4.lastIndex - u3[2].length, a3 = u3[1], c4 = void 0 === u3[3] ? p2 : '"' === u3[3] ? $ : g) : c4 === $ || c4 === g ? c4 = p2 : c4 === _ || c4 === m ? c4 = v : (c4 = p2, n5 = void 0);
    const x2 = c4 === p2 && t4[i6 + 1].startsWith("/>") ? " " : "";
    l3 += c4 === v ? s5 + r3 : d3 >= 0 ? (e5.push(a3), s5.slice(0, d3) + h2 + s5.slice(d3) + o3 + x2) : s5 + o3 + (-2 === d3 ? i6 : x2);
  }
  return [V(t4, l3 + (t4[s4] || "<?>") + (2 === i5 ? "</svg>" : 3 === i5 ? "</math>" : "")), e5];
};
var S2 = class _S {
  constructor({ strings: t4, _$litType$: i5 }, e5) {
    let r6;
    this.parts = [];
    let l3 = 0, a3 = 0;
    const u3 = t4.length - 1, d3 = this.parts, [f3, v2] = N(t4, i5);
    if (this.el = _S.createElement(f3, e5), P.currentNode = this.el.content, 2 === i5 || 3 === i5) {
      const t5 = this.el.content.firstChild;
      t5.replaceWith(...t5.childNodes);
    }
    for (; null !== (r6 = P.nextNode()) && d3.length < u3; ) {
      if (1 === r6.nodeType) {
        if (r6.hasAttributes()) for (const t5 of r6.getAttributeNames()) if (t5.endsWith(h2)) {
          const i6 = v2[a3++], s4 = r6.getAttribute(t5).split(o3), e6 = /([.?@])?(.*)/.exec(i6);
          d3.push({ type: 1, index: l3, name: e6[2], strings: s4, ctor: "." === e6[1] ? I : "?" === e6[1] ? L : "@" === e6[1] ? z : H }), r6.removeAttribute(t5);
        } else t5.startsWith(o3) && (d3.push({ type: 6, index: l3 }), r6.removeAttribute(t5));
        if (y2.test(r6.tagName)) {
          const t5 = r6.textContent.split(o3), i6 = t5.length - 1;
          if (i6 > 0) {
            r6.textContent = s2 ? s2.emptyScript : "";
            for (let s4 = 0; s4 < i6; s4++) r6.append(t5[s4], c3()), P.nextNode(), d3.push({ type: 2, index: ++l3 });
            r6.append(t5[i6], c3());
          }
        }
      } else if (8 === r6.nodeType) if (r6.data === n3) d3.push({ type: 2, index: l3 });
      else {
        let t5 = -1;
        for (; -1 !== (t5 = r6.data.indexOf(o3, t5 + 1)); ) d3.push({ type: 7, index: l3 }), t5 += o3.length - 1;
      }
      l3++;
    }
  }
  static createElement(t4, i5) {
    const s4 = l2.createElement("template");
    return s4.innerHTML = t4, s4;
  }
};
function M(t4, i5, s4 = t4, e5) {
  if (i5 === E) return i5;
  let h3 = void 0 !== e5 ? s4._$Co?.[e5] : s4._$Cl;
  const o6 = a2(i5) ? void 0 : i5._$litDirective$;
  return h3?.constructor !== o6 && (h3?._$AO?.(false), void 0 === o6 ? h3 = void 0 : (h3 = new o6(t4), h3._$AT(t4, s4, e5)), void 0 !== e5 ? (s4._$Co ??= [])[e5] = h3 : s4._$Cl = h3), void 0 !== h3 && (i5 = M(t4, h3._$AS(t4, i5.values), h3, e5)), i5;
}
var R = class {
  constructor(t4, i5) {
    this._$AV = [], this._$AN = void 0, this._$AD = t4, this._$AM = i5;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t4) {
    const { el: { content: i5 }, parts: s4 } = this._$AD, e5 = (t4?.creationScope ?? l2).importNode(i5, true);
    P.currentNode = e5;
    let h3 = P.nextNode(), o6 = 0, n5 = 0, r6 = s4[0];
    for (; void 0 !== r6; ) {
      if (o6 === r6.index) {
        let i6;
        2 === r6.type ? i6 = new k(h3, h3.nextSibling, this, t4) : 1 === r6.type ? i6 = new r6.ctor(h3, r6.name, r6.strings, this, t4) : 6 === r6.type && (i6 = new Z(h3, this, t4)), this._$AV.push(i6), r6 = s4[++n5];
      }
      o6 !== r6?.index && (h3 = P.nextNode(), o6++);
    }
    return P.currentNode = l2, e5;
  }
  p(t4) {
    let i5 = 0;
    for (const s4 of this._$AV) void 0 !== s4 && (void 0 !== s4.strings ? (s4._$AI(t4, s4, i5), i5 += s4.strings.length - 2) : s4._$AI(t4[i5])), i5++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t4, i5, s4, e5) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t4, this._$AB = i5, this._$AM = s4, this.options = e5, this._$Cv = e5?.isConnected ?? true;
  }
  get parentNode() {
    let t4 = this._$AA.parentNode;
    const i5 = this._$AM;
    return void 0 !== i5 && 11 === t4?.nodeType && (t4 = i5.parentNode), t4;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t4, i5 = this) {
    t4 = M(this, t4, i5), a2(t4) ? t4 === A || null == t4 || "" === t4 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t4 !== this._$AH && t4 !== E && this._(t4) : void 0 !== t4._$litType$ ? this.$(t4) : void 0 !== t4.nodeType ? this.T(t4) : d2(t4) ? this.k(t4) : this._(t4);
  }
  O(t4) {
    return this._$AA.parentNode.insertBefore(t4, this._$AB);
  }
  T(t4) {
    this._$AH !== t4 && (this._$AR(), this._$AH = this.O(t4));
  }
  _(t4) {
    this._$AH !== A && a2(this._$AH) ? this._$AA.nextSibling.data = t4 : this.T(l2.createTextNode(t4)), this._$AH = t4;
  }
  $(t4) {
    const { values: i5, _$litType$: s4 } = t4, e5 = "number" == typeof s4 ? this._$AC(t4) : (void 0 === s4.el && (s4.el = S2.createElement(V(s4.h, s4.h[0]), this.options)), s4);
    if (this._$AH?._$AD === e5) this._$AH.p(i5);
    else {
      const t5 = new R(e5, this), s5 = t5.u(this.options);
      t5.p(i5), this.T(s5), this._$AH = t5;
    }
  }
  _$AC(t4) {
    let i5 = C.get(t4.strings);
    return void 0 === i5 && C.set(t4.strings, i5 = new S2(t4)), i5;
  }
  k(t4) {
    u2(this._$AH) || (this._$AH = [], this._$AR());
    const i5 = this._$AH;
    let s4, e5 = 0;
    for (const h3 of t4) e5 === i5.length ? i5.push(s4 = new _k(this.O(c3()), this.O(c3()), this, this.options)) : s4 = i5[e5], s4._$AI(h3), e5++;
    e5 < i5.length && (this._$AR(s4 && s4._$AB.nextSibling, e5), i5.length = e5);
  }
  _$AR(t4 = this._$AA.nextSibling, s4) {
    for (this._$AP?.(false, true, s4); t4 !== this._$AB; ) {
      const s5 = i3(t4).nextSibling;
      i3(t4).remove(), t4 = s5;
    }
  }
  setConnected(t4) {
    void 0 === this._$AM && (this._$Cv = t4, this._$AP?.(t4));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t4, i5, s4, e5, h3) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t4, this.name = i5, this._$AM = e5, this.options = h3, s4.length > 2 || "" !== s4[0] || "" !== s4[1] ? (this._$AH = Array(s4.length - 1).fill(new String()), this.strings = s4) : this._$AH = A;
  }
  _$AI(t4, i5 = this, s4, e5) {
    const h3 = this.strings;
    let o6 = false;
    if (void 0 === h3) t4 = M(this, t4, i5, 0), o6 = !a2(t4) || t4 !== this._$AH && t4 !== E, o6 && (this._$AH = t4);
    else {
      const e6 = t4;
      let n5, r6;
      for (t4 = h3[0], n5 = 0; n5 < h3.length - 1; n5++) r6 = M(this, e6[s4 + n5], i5, n5), r6 === E && (r6 = this._$AH[n5]), o6 ||= !a2(r6) || r6 !== this._$AH[n5], r6 === A ? t4 = A : t4 !== A && (t4 += (r6 ?? "") + h3[n5 + 1]), this._$AH[n5] = r6;
    }
    o6 && !e5 && this.j(t4);
  }
  j(t4) {
    t4 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t4 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t4) {
    this.element[this.name] = t4 === A ? void 0 : t4;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t4) {
    this.element.toggleAttribute(this.name, !!t4 && t4 !== A);
  }
};
var z = class extends H {
  constructor(t4, i5, s4, e5, h3) {
    super(t4, i5, s4, e5, h3), this.type = 5;
  }
  _$AI(t4, i5 = this) {
    if ((t4 = M(this, t4, i5, 0) ?? A) === E) return;
    const s4 = this._$AH, e5 = t4 === A && s4 !== A || t4.capture !== s4.capture || t4.once !== s4.once || t4.passive !== s4.passive, h3 = t4 !== A && (s4 === A || e5);
    e5 && this.element.removeEventListener(this.name, this, s4), h3 && this.element.addEventListener(this.name, this, t4), this._$AH = t4;
  }
  handleEvent(t4) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t4) : this._$AH.handleEvent(t4);
  }
};
var Z = class {
  constructor(t4, i5, s4) {
    this.element = t4, this.type = 6, this._$AN = void 0, this._$AM = i5, this.options = s4;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t4) {
    M(this, t4);
  }
};
var B = t2.litHtmlPolyfillSupport;
B?.(S2, k), (t2.litHtmlVersions ??= []).push("3.3.3");
var D = (t4, i5, s4) => {
  const e5 = s4?.renderBefore ?? i5;
  let h3 = e5._$litPart$;
  if (void 0 === h3) {
    const t5 = s4?.renderBefore ?? null;
    e5._$litPart$ = h3 = new k(i5.insertBefore(c3(), t5), t5, void 0, s4 ?? {});
  }
  return h3._$AI(t4), h3;
};

// node_modules/lit-element/lit-element.js
var s3 = globalThis;
var i4 = class extends y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t4 = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t4.firstChild, t4;
  }
  update(t4) {
    const r6 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t4), this._$Do = D(r6, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i4._$litElement$ = true, i4["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i4 });
var o4 = s3.litElementPolyfillSupport;
o4?.({ LitElement: i4 });
(s3.litElementVersions ??= []).push("4.2.2");

// node_modules/@lit/reactive-element/decorators/custom-element.js
var t3 = (t4) => (e5, o6) => {
  void 0 !== o6 ? o6.addInitializer(() => {
    customElements.define(t4, e5);
  }) : customElements.define(t4, e5);
};

// node_modules/@lit/reactive-element/decorators/property.js
var o5 = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
var r4 = (t4 = o5, e5, r6) => {
  const { kind: n5, metadata: i5 } = r6;
  let s4 = globalThis.litPropertyMetadata.get(i5);
  if (void 0 === s4 && globalThis.litPropertyMetadata.set(i5, s4 = /* @__PURE__ */ new Map()), "setter" === n5 && ((t4 = Object.create(t4)).wrapped = true), s4.set(r6.name, t4), "accessor" === n5) {
    const { name: o6 } = r6;
    return { set(r7) {
      const n6 = e5.get.call(this);
      e5.set.call(this, r7), this.requestUpdate(o6, n6, t4, true, r7);
    }, init(e6) {
      return void 0 !== e6 && this.C(o6, void 0, t4, e6), e6;
    } };
  }
  if ("setter" === n5) {
    const { name: o6 } = r6;
    return function(r7) {
      const n6 = this[o6];
      e5.call(this, r7), this.requestUpdate(o6, n6, t4, true, r7);
    };
  }
  throw Error("Unsupported decorator location: " + n5);
};
function n4(t4) {
  return (e5, o6) => "object" == typeof o6 ? r4(t4, e5, o6) : ((t5, e6, o7) => {
    const r6 = e6.hasOwnProperty(o7);
    return e6.constructor.createProperty(o7, t5), r6 ? Object.getOwnPropertyDescriptor(e6, o7) : void 0;
  })(t4, e5, o6);
}

// node_modules/@lit/reactive-element/decorators/state.js
function r5(r6) {
  return n4({ ...r6, state: true, attribute: false });
}

// packages/avatar/src/casehub-transcript.ts
var CasehubTranscript = class extends i4 {
  constructor() {
    super(...arguments);
    this.turns = [];
  }
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "log");
    this.setAttribute("aria-live", "polite");
    this.setAttribute("aria-label", "Conversation transcript");
  }
  updated() {
    this.scrollTop = this.scrollHeight;
  }
  render() {
    return b2`${this.turns.map(
      (turn) => b2`
        <div class="turn ${turn.role} ${turn.status === "partial" ? "partial" : ""}"
             aria-label="${turn.role === "user" ? "You said" : "Avatar said"}: ${turn.text}">
          ${turn.text}
        </div>
      `
    )}`;
  }
};
CasehubTranscript.styles = i`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--pages-space-3, 12px);
      padding: var(--pages-space-4, 16px);
      overflow-y: auto;
      flex: 1;
    }
    .turn {
      max-width: 70%;
      padding: var(--pages-space-3, 12px) var(--pages-space-4, 16px);
      border-radius: 12px;
      font-size: 0.95rem;
      line-height: 1.4;
    }
    .turn.user {
      align-self: flex-end;
      background: var(--pages-primary, #2d5aa0);
      color: var(--pages-on-primary, #fff);
    }
    .turn.avatar {
      align-self: flex-start;
      background: var(--pages-surface-variant, #333);
      color: var(--pages-on-surface, #e0e0e0);
    }
    .turn.partial {
      opacity: 0.7;
      font-style: italic;
    }
  `;
__decorateClass([
  n4({ type: Array })
], CasehubTranscript.prototype, "turns", 2);
CasehubTranscript = __decorateClass([
  t3("casehub-transcript")
], CasehubTranscript);

// packages/avatar/src/casehub-speech.ts
var CasehubSpeech = class extends i4 {
  constructor() {
    super(...arguments);
    this.sampleRate = 16e3;
    this.disabled = false;
    this._recording = false;
    this._finishing = false;
    this._starting = false;
    this._audioFrameCount = 0;
    this._micStream = null;
    this._micProcessor = null;
    this._micSource = null;
    this._audioCtx = null;
    this._handleClick = () => {
      if (this._finishing) return;
      if (this._recording) this._stopRecording();
      else this._startRecording();
    };
  }
  get recording() {
    return this._recording;
  }
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "group");
    this.setAttribute("aria-label", "Speech controls");
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopCapture();
  }
  updated(changed) {
    if (changed.has("disabled") && this.disabled && this._recording && !this._finishing) {
      this._stopRecording();
    }
  }
  async _startRecording() {
    if (this._recording || this._starting) return;
    this._starting = true;
    console.log("[MIC] startRecording called");
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      console.log("[MIC] AudioContext sampleRate:", this._audioCtx.sampleRate);
      this._micStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: this.sampleRate, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      console.log("[MIC] getUserMedia succeeded");
      this._micSource = this._audioCtx.createMediaStreamSource(this._micStream);
      this._micProcessor = this._audioCtx.createScriptProcessor(4096, 1, 1);
      this._audioFrameCount = 0;
      this._micProcessor.onaudioprocess = (e5) => {
        if (!this._recording) return;
        const input = e5.inputBuffer.getChannelData(0);
        const resampled = this._resampleTo16k(input, this._audioCtx.sampleRate);
        const buf = new ArrayBuffer(resampled.length * 4);
        new Float32Array(buf).set(resampled);
        this.dispatchEvent(new CustomEvent("speech:audio", { detail: { buffer: buf }, bubbles: true, composed: true }));
        this._audioFrameCount++;
      };
      this._micSource.connect(this._micProcessor);
      this._micProcessor.connect(this._audioCtx.destination);
      console.log("[MIC] dispatching speech:start, sampleRate:", this.sampleRate);
      this.dispatchEvent(new CustomEvent("speech:start", { detail: { sampleRate: this.sampleRate }, bubbles: true, composed: true }));
      this._recording = true;
      console.log("[MIC] recording=true, mic active");
    } catch (e5) {
      console.error("[casehub-speech] mic error:", e5);
    } finally {
      this._starting = false;
    }
  }
  _stopRecording() {
    if (!this._recording) return;
    console.log("[MIC] stopRecording called, frames sent:", this._audioFrameCount);
    this._finishing = true;
    this.requestUpdate();
    setTimeout(() => {
      this._recording = false;
      console.log("[MIC] sending STOP after 500ms delay, total frames:", this._audioFrameCount);
      this._stopCapture();
      this.dispatchEvent(new CustomEvent("speech:stop", { detail: {}, bubbles: true, composed: true }));
      this._finishing = false;
    }, 500);
  }
  _stopCapture() {
    if (this._micProcessor) {
      this._micProcessor.disconnect();
      this._micProcessor = null;
    }
    if (this._micSource) {
      this._micSource.disconnect();
      this._micSource = null;
    }
    if (this._micStream) {
      this._micStream.getTracks().forEach((t4) => t4.stop());
      this._micStream = null;
    }
  }
  _resampleTo16k(input, fromRate) {
    if (fromRate === 16e3) return input;
    const ratio = fromRate / 16e3;
    const len = Math.round(input.length / ratio);
    const out = new Float32Array(len);
    for (let i5 = 0; i5 < len; i5++) {
      out[i5] = input[Math.round(i5 * ratio)];
    }
    return out;
  }
  render() {
    return b2`
      <button
        @click=${this._handleClick}
        ?disabled=${this.disabled || this._finishing}
        aria-pressed=${this._recording ? "true" : "false"}>
        ${this._finishing ? "Finishing..." : this._recording ? "Recording..." : "Mic"}
      </button>
    `;
  }
};
CasehubSpeech.styles = i`
    :host { display: inline-block; }
    button {
      padding: var(--pages-space-3, 12px) var(--pages-space-4, 16px);
      border-radius: 8px;
      border: 2px solid var(--pages-neutral-5, #555);
      background: var(--pages-surface, #2a2a3e);
      color: var(--pages-on-surface, #e0e0e0);
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:disabled { opacity: 0.5; cursor: default; }
    button[aria-pressed="true"] {
      background: var(--pages-error, #d64);
      border-color: var(--pages-error, #d64);
      color: var(--pages-on-error, white);
      animation: pulse 1s infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
  `;
__decorateClass([
  n4({ type: Number, attribute: "sample-rate" })
], CasehubSpeech.prototype, "sampleRate", 2);
__decorateClass([
  n4({ type: Boolean, reflect: true })
], CasehubSpeech.prototype, "disabled", 2);
__decorateClass([
  r5()
], CasehubSpeech.prototype, "_recording", 2);
__decorateClass([
  r5()
], CasehubSpeech.prototype, "_finishing", 2);
CasehubSpeech = __decorateClass([
  t3("casehub-speech")
], CasehubSpeech);

// packages/avatar/src/avatar-ws-controller.ts
var AvatarWsController = class {
  constructor(host, config) {
    this._ws = null;
    this._shouldReconnect = true;
    this._pendingVisemes = null;
    this._audioCtx = null;
    this._audioFramesSent = 0;
    this._host = host;
    this._wsUrl = config.wsUrl;
    this._reconnectMs = config.reconnectMs ?? 2e3;
    host.addController(this);
  }
  hostConnected() {
    console.log("[WS] hostConnected \u2014 connecting");
    this._connect();
  }
  hostDisconnected() {
    this._shouldReconnect = false;
    this._ws?.close();
    this._ws = null;
  }
  _connect() {
    const proto = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
    const host = globalThis.location?.host ?? "localhost";
    const url = this._wsUrl.startsWith("ws") ? this._wsUrl : `${proto}//${host}${this._wsUrl}`;
    this._ws = new WebSocket(url);
    this._host.connectionState = "connecting";
    this._host.requestUpdate();
    this._ws.onopen = () => {
      console.log("[WS] onopen \u2014 connected");
      this._host.connectionState = "connected";
      this._host.requestUpdate();
    };
    this._ws.onmessage = (evt) => {
      if (typeof evt.data === "string") {
        const parsed = JSON.parse(evt.data);
        console.log("[WS] recv text:", parsed.type, JSON.stringify(parsed).slice(0, 120));
        this._handleTextMessage(parsed);
      } else {
        console.log("[WS] recv binary:", evt.data.size || "unknown", "bytes");
        this._handleBinaryMessage(evt.data);
      }
    };
    this._ws.onclose = (evt) => {
      console.log("[WS] onclose \u2014 code:", evt?.code, "reason:", evt?.reason, "wasClean:", evt?.wasClean);
      this._host.connectionState = "disconnected";
      this._host.requestUpdate();
      if (this._shouldReconnect) {
        setTimeout(() => this._connect(), this._reconnectMs);
      }
    };
    this._ws.onerror = (evt) => {
      console.error("[WS] onerror", evt);
      this._host.connectionState = "disconnected";
      this._host.requestUpdate();
    };
  }
  _handleTextMessage(msg) {
    switch (msg.type) {
      case "partial": {
        const last = this._host.turns[this._host.turns.length - 1];
        if (last && last.role === "user" && last.status === "partial") {
          this._host.turns = [...this._host.turns.slice(0, -1), { role: "user", text: msg.text, status: "partial" }];
        } else {
          this._host.turns = [...this._host.turns, { role: "user", text: msg.text, status: "partial" }];
        }
        this._host.requestUpdate();
        break;
      }
      case "transcript": {
        const last = this._host.turns[this._host.turns.length - 1];
        if (last && last.role === "user" && last.status === "partial") {
          this._host.turns = [...this._host.turns.slice(0, -1), { role: "user", text: msg.text, status: "final" }];
        } else {
          this._host.turns = [...this._host.turns, { role: "user", text: msg.text, status: "final" }];
        }
        this._host.requestUpdate();
        break;
      }
      case "response":
        this._host.turns = [...this._host.turns, { role: "avatar", text: msg.text, status: "final" }];
        this._host.requestUpdate();
        break;
      case "phonemes":
        this._pendingVisemes = msg.data ?? null;
        break;
      case "timing":
        if (this._host instanceof EventTarget) {
          this._host.dispatchEvent(new CustomEvent("avatar:timing", { detail: msg, bubbles: true, composed: true }));
        }
        break;
      case "error":
        if (this._host instanceof EventTarget) {
          this._host.dispatchEvent(new CustomEvent("avatar:error", { detail: { message: msg.message }, bubbles: true, composed: true }));
        }
        break;
    }
  }
  async _handleBinaryMessage(data) {
    const myVisemes = this._pendingVisemes;
    this._pendingVisemes = null;
    if (!this._audioCtx) this._audioCtx = new AudioContext();
    try {
      const arrayBuf = data instanceof Blob ? await data.arrayBuffer() : data;
      const audioBuf = await this._audioCtx.decodeAudioData(arrayBuf.slice(0));
      const item = this._buildPlaybackItem(audioBuf, myVisemes);
      this._host.avatarAudioQueue = [...this._host.avatarAudioQueue, item];
      this._host.requestUpdate();
    } catch (e5) {
      console.error("[AvatarWsController] audio decode error:", e5);
    }
  }
  _buildPlaybackItem(audio, frames) {
    return { audio, timeline: frames && frames.length > 0 ? frames : null };
  }
  sendStart(opts) {
    const msg = JSON.stringify({ type: "start", ...opts });
    console.log("[WS] sendStart:", msg);
    this._send(msg);
  }
  sendStop() {
    console.log("[WS] sendStop");
    this._send(JSON.stringify({ type: "stop" }));
  }
  sendText(text, opts) {
    const msg = JSON.stringify({ type: "text", text, ...opts });
    console.log("[WS] sendText:", msg);
    this._send(msg);
  }
  sendAudio(buffer) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(buffer);
    }
  }
  _send(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(data);
    } else {
      console.warn("[WS] send failed \u2014 readyState:", this._ws?.readyState);
    }
  }
};

// packages/avatar/src/casehub-avatar.ts
var CasehubAvatar = class extends i4 {
  constructor() {
    super(...arguments);
    this.avatarUrl = "";
    this.body = "F";
    this.mood = "neutral";
    this.cameraView = "head";
    this.cameraRotate = true;
    this.cameraZoom = true;
    this.cameraPan = true;
    this.lipsyncLang = "en";
    this.speed = 0.9;
    this.audioQueue = [];
    this._loading = true;
    this._speaking = false;
    this._head = null;
    this._processingQueue = false;
    this._audioCtx = null;
    this._visemeMeshes = null;
    this._internalQueue = [];
  }
  get loading() {
    return this._loading;
  }
  get speaking() {
    return this._speaking;
  }
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "img");
    this.setAttribute("aria-label", "3D avatar");
    this.setAttribute("aria-busy", "true");
    this._initTalkingHead();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._head = null;
    this._visemeMeshes = null;
  }
  updated(changed) {
    if (changed.has("audioQueue") && this.audioQueue.length > 0) {
      this._internalQueue.push(...this.audioQueue);
      this.dispatchEvent(new CustomEvent("avatar:queue-accepted", { bubbles: true, composed: true }));
      if (!this._processingQueue) this._processQueue();
    }
  }
  async _initTalkingHead() {
    try {
      const { TalkingHead } = await import("talkinghead");
      const container = this.shadowRoot.querySelector(".avatar-container");
      if (!container) return;
      this._head = new TalkingHead(container, {
        ttsEndpoint: null,
        lipsyncModules: [this.lipsyncLang],
        cameraView: this.cameraView,
        cameraRotateEnable: this.cameraRotate,
        cameraZoomEnable: this.cameraZoom,
        cameraPanEnable: this.cameraPan
      });
      await this._head.showAvatar({
        url: this.avatarUrl,
        body: this.body,
        avatarMood: this.mood,
        lipsyncLang: this.lipsyncLang
      });
      this._loading = false;
      this.setAttribute("aria-busy", "false");
    } catch (e5) {
      console.error("[casehub-avatar] init error:", e5);
      this._loading = false;
      this.setAttribute("aria-busy", "false");
    }
  }
  _discoverVisemeMeshes() {
    if (this._visemeMeshes) return this._visemeMeshes;
    if (!this._head) {
      console.log("[AVATAR] no head instance");
      return null;
    }
    const scene = this._head.scene ?? this._head._scene ?? this._head.model ?? this._head._model;
    if (!scene?.traverse) {
      const keys = Object.keys(this._head).filter((k2) => !k2.startsWith("_"));
      const privKeys = Object.keys(this._head).filter((k2) => k2.startsWith("_") && (k2.includes("scene") || k2.includes("model") || k2.includes("mesh") || k2.includes("avatar")));
      console.log("[AVATAR] no scene found. Public keys:", keys.join(", "), "| Relevant private:", privKeys.join(", "));
      return null;
    }
    const meshes = [];
    scene.traverse((o6) => {
      if (o6.morphTargetDictionary) {
        const dict = {};
        for (const k2 in o6.morphTargetDictionary) {
          if (k2.startsWith("viseme_")) dict[k2] = o6.morphTargetDictionary[k2];
        }
        if (Object.keys(dict).length > 0) meshes.push({ mesh: o6, dict });
      }
    });
    if (meshes.length > 0) {
      console.log("[AVATAR] discovered", meshes.length, "viseme meshes with", Object.keys(meshes[0].dict).length, "targets each");
      this._visemeMeshes = meshes;
    } else {
      console.log("[AVATAR] scene found but no viseme morph targets");
    }
    return this._visemeMeshes;
  }
  async _processQueue() {
    if (this._processingQueue) return;
    this._processingQueue = true;
    while (this._internalQueue.length > 0) {
      const item = this._internalQueue.shift();
      this._speaking = true;
      await this._playItem(item);
    }
    this._speaking = false;
    this._processingQueue = false;
  }
  _playItem(item) {
    return new Promise((resolve) => {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const source = ctx.createBufferSource();
      source.buffer = item.audio;
      source.playbackRate.value = this.speed;
      source.connect(ctx.destination);
      source.start();
      const meshes = item.timeline ? this._discoverVisemeMeshes() : null;
      if (!meshes) {
        source.onended = () => resolve();
        return;
      }
      const timeline = item.timeline;
      const startTime = ctx.currentTime;
      const rate = this.speed;
      let animating = true;
      const animate = () => {
        if (!animating) return;
        const elapsed = (ctx.currentTime - startTime) * 1e3 * rate;
        let activeViseme = "sil";
        let activeWeight = 0;
        for (let i5 = timeline.length - 1; i5 >= 0; i5--) {
          if (elapsed >= timeline[i5].startMs && elapsed < timeline[i5].endMs) {
            activeViseme = timeline[i5].viseme;
            activeWeight = timeline[i5].weight ?? 1;
            break;
          }
        }
        for (const m2 of meshes) {
          for (const k2 in m2.dict) {
            const idx = m2.dict[k2];
            const target = k2 === `viseme_${activeViseme}` ? activeWeight : 0;
            const current = m2.mesh.morphTargetInfluences[idx] ?? 0;
            const lerp = target > current ? CasehubAvatar.ATTACK : CasehubAvatar.DECAY;
            m2.mesh.morphTargetInfluences[idx] = current + (target - current) * lerp;
          }
        }
        requestAnimationFrame(animate);
      };
      source.onended = () => {
        setTimeout(() => {
          animating = false;
          for (const m2 of meshes) {
            for (const k2 in m2.dict) m2.mesh.morphTargetInfluences[m2.dict[k2]] = 0;
          }
          resolve();
        }, 300);
      };
      requestAnimationFrame(animate);
    });
  }
  render() {
    return b2`<div class="avatar-container"></div>`;
  }
};
CasehubAvatar.ATTACK = 0.35;
CasehubAvatar.DECAY = 0.12;
CasehubAvatar.styles = i`
    :host {
      display: block;
      position: relative;
      background: var(--pages-surface, #111);
    }
    .avatar-container {
      width: 100%;
      height: 100%;
      min-height: 200px;
    }
  `;
__decorateClass([
  n4({ type: String, attribute: "avatar-url" })
], CasehubAvatar.prototype, "avatarUrl", 2);
__decorateClass([
  n4({ type: String })
], CasehubAvatar.prototype, "body", 2);
__decorateClass([
  n4({ type: String })
], CasehubAvatar.prototype, "mood", 2);
__decorateClass([
  n4({ type: String, attribute: "camera-view" })
], CasehubAvatar.prototype, "cameraView", 2);
__decorateClass([
  n4({ type: Boolean, attribute: "camera-rotate" })
], CasehubAvatar.prototype, "cameraRotate", 2);
__decorateClass([
  n4({ type: Boolean, attribute: "camera-zoom" })
], CasehubAvatar.prototype, "cameraZoom", 2);
__decorateClass([
  n4({ type: Boolean, attribute: "camera-pan" })
], CasehubAvatar.prototype, "cameraPan", 2);
__decorateClass([
  n4({ type: String, attribute: "lipsync-lang" })
], CasehubAvatar.prototype, "lipsyncLang", 2);
__decorateClass([
  n4({ type: Number })
], CasehubAvatar.prototype, "speed", 2);
__decorateClass([
  n4({ type: Array })
], CasehubAvatar.prototype, "audioQueue", 2);
__decorateClass([
  r5()
], CasehubAvatar.prototype, "_loading", 2);
__decorateClass([
  r5()
], CasehubAvatar.prototype, "_speaking", 2);
CasehubAvatar = __decorateClass([
  t3("casehub-avatar")
], CasehubAvatar);

// packages/avatar/src/casehub-avatar-panel.ts
var VOICE_GROUPS = [
  { label: "Piper VITS \u2014 MOS ~3.7", voices: [
    { value: "lessac-medium", label: "Lessac medium", mos: "3.6" },
    { value: "lessac-high", label: "Lessac high", mos: "3.9" },
    { value: "amy", label: "Amy (US)", mos: "3.7" },
    { value: "ryan", label: "Ryan (US)", mos: "3.8" },
    { value: "jenny", label: "Jenny (UK)", mos: "3.7" }
  ] },
  { label: "Piper via sherpa \u2014 MOS ~3.7", voices: [
    { value: "sherpa:lessac-medium", label: "Sherpa: Lessac", mos: "3.6" },
    { value: "sherpa:amy", label: "Sherpa: Amy", mos: "3.7" },
    { value: "sherpa:ryan", label: "Sherpa: Ryan", mos: "3.8" },
    { value: "sherpa:jenny", label: "Sherpa: Jenny", mos: "3.7" }
  ] },
  { label: "Kokoro StyleTTS2 \u2014 MOS ~4.3", voices: [
    { value: "kokoro:af", label: "Kokoro: AF (US)", mos: "4.3" },
    { value: "kokoro:af_bella", label: "Kokoro: Bella (US)", mos: "4.2" },
    { value: "kokoro:af_nicole", label: "Kokoro: Nicole (US)", mos: "4.3" },
    { value: "kokoro:af_sarah", label: "Kokoro: Sarah (US)", mos: "4.3" },
    { value: "kokoro:af_sky", label: "Kokoro: Sky (US)", mos: "4.3" },
    { value: "kokoro:am_adam", label: "Kokoro: Adam (US)", mos: "4.2" },
    { value: "kokoro:am_michael", label: "Kokoro: Michael (US)", mos: "4.1" },
    { value: "kokoro:bf_emma", label: "Kokoro: Emma (UK)", mos: "4.3" },
    { value: "kokoro:bf_isabella", label: "Kokoro: Isabella (UK)", mos: "4.2" },
    { value: "kokoro:bm_george", label: "Kokoro: George (UK)", mos: "4.2" },
    { value: "kokoro:bm_lewis", label: "Kokoro: Lewis (UK)", mos: "4.1" }
  ] },
  // Audio8 uses OnnxRuntimeLibrary which loads sherpa-onnx's ORT 1.27.1.
  // DualAR autoregressive inference is CPU-only and extremely slow (~10s/sentence).
  // Models load but synthesis may fail with ORT API version conflicts.
  { label: "Audio8 DualAR \u2014 preview (ORT conflict)", voices: [
    { value: "audio8", label: "Audio8 0.1B (INT8)", mos: "~2.8", warn: "slow", broken: "ORT 1.27 conflict" },
    { value: "audio8:0.6b", label: "Audio8 0.6B (INT4)", mos: "~3.2", warn: "slow", broken: "ORT 1.27 conflict" }
  ] },
  // CosyVoice3 needs ORT 1.18.0 for FP16 models (SimplifiedLayerNormFusion crash,
  // precision cast errors in ORT 1.21+). Pinned via ~/.casehub/ort-1.18.0/ but
  // sherpa-onnx loads ORT 1.27.1 first, poisoning the process. See blocks#217.
  { label: "CosyVoice3 \u2014 voice cloning (ORT conflict)", voices: [
    { value: "cosyvoice3", label: "CosyVoice3 (24kHz)", mos: "clone", warn: "slow", broken: "needs ORT 1.18.0" }
  ] }
];
var CasehubAvatarPanel = class extends i4 {
  constructor() {
    super(...arguments);
    this.wsUrl = "/ws/avatar";
    this.avatarUrl = "";
    this.body = "F";
    this.mood = "neutral";
    this.llmModel = "claude-haiku-4-5@20251001";
    this.ttsModel = "lessac-medium";
    this.speed = 0.9;
    this.turns = [];
    this.avatarAudioQueue = [];
    this.connectionState = "disconnected";
    this._statusText = "Connecting...";
    this._modelStatus = {};
    this._timingText = "";
    this._showAvatar = true;
    this._modelPollTimer = null;
    this._audioSendCount = 0;
  }
  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("role", "region");
    this.setAttribute("aria-label", "Avatar conversation");
    this._controller = new AvatarWsController(this, { wsUrl: this.wsUrl });
    this._pollModelStatus();
    this._modelPollTimer = setInterval(() => this._pollModelStatus(), 2e3);
    this.addEventListener("avatar:timing", ((e5) => {
      const t4 = e5.detail;
      this._timingText = `Cleanup: ${t4.cleanupMs}ms | LLM: ${t4.llmMs}ms | TTS: ${t4.ttsMs}ms | Total: ${t4.totalMs}ms`;
    }));
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._modelPollTimer) {
      clearInterval(this._modelPollTimer);
      this._modelPollTimer = null;
    }
  }
  async _pollModelStatus() {
    try {
      const resp = await fetch("/api/models/status");
      if (resp.ok) {
        this._modelStatus = await resp.json();
        const total = Object.keys(this._modelStatus).length;
        const ready = Object.values(this._modelStatus).filter((s4) => s4 === "READY").length;
        if (ready === total && this._modelPollTimer) {
          clearInterval(this._modelPollTimer);
          this._modelPollTimer = null;
        }
      }
    } catch {
    }
  }
  updated(changed) {
    if (changed.has("connectionState")) {
      console.log("[PANEL] connectionState changed:", changed.get("connectionState"), "->", this.connectionState);
      switch (this.connectionState) {
        case "connecting":
          this._statusText = "Connecting...";
          break;
        case "connected":
          this._statusText = "Connected";
          break;
        case "disconnected":
          this._statusText = "Disconnected \u2014 reconnecting...";
          break;
      }
    }
  }
  _onSpeechStart(e5) {
    console.log("[PANEL] speech:start received, sending WS start");
    this._controller.sendStart({
      sampleRate: e5.detail.sampleRate,
      llmModel: this.llmModel,
      ttsModel: this.ttsModel
    });
    this._statusText = "Listening...";
  }
  _onSpeechAudio(e5) {
    this._audioSendCount++;
    if (this._audioSendCount <= 3 || this._audioSendCount % 50 === 0) {
      console.log("[PANEL] speech:audio #" + this._audioSendCount + ", buffer:", e5.detail.buffer.byteLength, "bytes");
    }
    this._controller.sendAudio(e5.detail.buffer);
  }
  _onSpeechStop() {
    console.log("[PANEL] speech:stop received, total audio frames sent:", this._audioSendCount);
    this._audioSendCount = 0;
    this._controller.sendStop();
    this._statusText = "Processing speech...";
  }
  // Matches original sendText (line 193-201)
  _onSendText() {
    const input = this.shadowRoot.querySelector("#msg");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    this._controller.sendText(text, { llmModel: this.llmModel, ttsModel: this.ttsModel });
    input.value = "";
    this._statusText = "Processing...";
  }
  _onInputKeydown(e5) {
    if (e5.key === "Enter") this._onSendText();
  }
  _onLlmChange(e5) {
    this.llmModel = e5.target.value;
  }
  _onTtsChange(e5) {
    this.ttsModel = e5.target.value;
  }
  _onSpeedChange(e5) {
    this.speed = parseFloat(e5.target.value);
  }
  get _modelStatusHtml() {
    const entries = Object.entries(this._modelStatus);
    if (entries.length === 0) return "";
    const ready = entries.filter(([, s4]) => s4 === "READY").length;
    const downloading = entries.filter(([, s4]) => s4 === "DOWNLOADING").length;
    if (ready === entries.length) return b2`<span class="ready">All voice models ready</span>`;
    if (downloading > 0) return b2`<span class="downloading">Downloading voice models: ${ready}/${entries.length} ready</span>`;
    return "";
  }
  render() {
    const connected = this.connectionState === "connected";
    return b2`
      <div class="controls">
        <label>LLM: <select @change=${this._onLlmChange}>
          <option value="claude-haiku-4-5@20251001" ?selected=${this.llmModel === "claude-haiku-4-5@20251001"}>Haiku 4.5 (fast)</option>
          <option value="claude-sonnet-4@20250514" ?selected=${this.llmModel === "claude-sonnet-4@20250514"}>Sonnet 4</option>
          <option value="claude-opus-4@20250514" ?selected=${this.llmModel === "claude-opus-4@20250514"}>Opus 4</option>
        </select></label>
        <label>Voice: <select @change=${this._onTtsChange}>
          ${VOICE_GROUPS.map((g2) => b2`
            <optgroup label=${g2.label}>
              ${g2.voices.map((v2) => {
      const st = this._modelStatus[v2.value];
      const stUnavail = st != null && st !== "READY";
      const disabled = !!v2.broken || stUnavail;
      const suffix = v2.broken ? ` (${v2.broken})` : st === "DOWNLOADING" ? " (downloading...)" : st === "ERROR" ? " (error)" : "";
      const warn = v2.warn ? ` \u26A0\uFE0F ${v2.warn}` : "";
      return b2`<option value=${v2.value}
                  ?selected=${this.ttsModel === v2.value}
                  ?disabled=${disabled}
                  >${v2.label} ▸ MOS ${v2.mos}${warn}${suffix}</option>`;
    })}
            </optgroup>
          `)}
        </select></label>
        <label>Speed: <input type="range" min="0.6" max="1.4" step="0.05" .value=${String(this.speed)}
          @input=${this._onSpeedChange} style="width:80px;vertical-align:middle">
          <span>${this.speed}x</span></label>
      </div>
      <casehub-avatar
        ?hidden=${!this._showAvatar}
        avatar-url=${this.avatarUrl}
        body=${this.body}
        mood=${this.mood}
        .speed=${this.speed}
        .audioQueue=${this.avatarAudioQueue}
        @avatar:queue-accepted=${() => {
      this.avatarAudioQueue = [];
    }}>
      </casehub-avatar>
      <div class="model-status">${this._modelStatusHtml}</div>
      <div class="status">${this._statusText}</div>
      <div class="timing">${this._timingText}</div>
      <casehub-transcript .turns=${this.turns}></casehub-transcript>
      <div class="input-bar">
        <casehub-speech
          ?disabled=${!connected}
          @speech:start=${this._onSpeechStart}
          @speech:audio=${this._onSpeechAudio}
          @speech:stop=${this._onSpeechStop}>
        </casehub-speech>
        <input id="msg" type="text" placeholder="Type a message..."
          autocomplete="off" ?disabled=${!connected}
          @keydown=${this._onInputKeydown}>
        <button ?disabled=${!connected} @click=${this._onSendText}>Send</button>
      </div>
    `;
  }
};
CasehubAvatarPanel.styles = i`
    :host { display: flex; flex-direction: column; height: 100%; background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; }
    .controls { display: flex; gap: 1rem; padding: 0.5rem 1rem; border-bottom: 1px solid #333; align-items: center; justify-content: center; flex-wrap: wrap; }
    .controls label { font-size: 0.8rem; color: #999; }
    .controls select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid #555; background: #2a2a3e; color: #e0e0e0; font-size: 0.85rem; }
    casehub-avatar { flex: 0 0 300px; border-bottom: 1px solid #333; }
    casehub-avatar[hidden] { display: none; }
    .model-status { padding: 0.25rem 1rem; font-size: 0.75rem; color: #999; text-align: center; }
    .model-status .downloading { color: #d9a547; }
    .model-status .ready { color: #4a9; }
    .status { padding: 0.25rem 1rem; font-size: 0.75rem; color: #666; text-align: center; }
    .timing { margin: 0.5rem 1rem; padding: 0.5rem 0.75rem; background: #1e1e32; border-radius: 8px; font-size: 0.8rem; font-family: monospace; }
    .timing:empty { display: none; }
    casehub-transcript { flex: 1; overflow-y: auto; }
    .input-bar { display: flex; gap: 0.5rem; padding: 1rem; border-top: 1px solid #333; }
    .input-bar input { flex: 1; padding: 0.75rem; border-radius: 8px; border: 1px solid #555; background: #2a2a3e; color: #e0e0e0; font-size: 1rem; }
    .input-bar input:focus { outline: none; border-color: #2d5aa0; }
    .input-bar button { padding: 0.75rem 1.5rem; border-radius: 8px; border: none; background: #2d5aa0; color: white; font-size: 1rem; cursor: pointer; }
    .input-bar button:disabled { opacity: 0.5; cursor: default; }
  `;
__decorateClass([
  n4({ type: String, attribute: "ws-url" })
], CasehubAvatarPanel.prototype, "wsUrl", 2);
__decorateClass([
  n4({ type: String, attribute: "avatar-url" })
], CasehubAvatarPanel.prototype, "avatarUrl", 2);
__decorateClass([
  n4({ type: String })
], CasehubAvatarPanel.prototype, "body", 2);
__decorateClass([
  n4({ type: String })
], CasehubAvatarPanel.prototype, "mood", 2);
__decorateClass([
  n4({ type: String, attribute: "llm-model" })
], CasehubAvatarPanel.prototype, "llmModel", 2);
__decorateClass([
  n4({ type: String, attribute: "tts-model" })
], CasehubAvatarPanel.prototype, "ttsModel", 2);
__decorateClass([
  n4({ type: Number })
], CasehubAvatarPanel.prototype, "speed", 2);
__decorateClass([
  r5()
], CasehubAvatarPanel.prototype, "turns", 2);
__decorateClass([
  r5()
], CasehubAvatarPanel.prototype, "avatarAudioQueue", 2);
__decorateClass([
  r5()
], CasehubAvatarPanel.prototype, "connectionState", 2);
__decorateClass([
  r5()
], CasehubAvatarPanel.prototype, "_statusText", 2);
__decorateClass([
  r5()
], CasehubAvatarPanel.prototype, "_modelStatus", 2);
__decorateClass([
  r5()
], CasehubAvatarPanel.prototype, "_timingText", 2);
__decorateClass([
  r5()
], CasehubAvatarPanel.prototype, "_showAvatar", 2);
CasehubAvatarPanel = __decorateClass([
  t3("casehub-avatar-panel")
], CasehubAvatarPanel);
export {
  AvatarWsController,
  CasehubAvatar,
  CasehubAvatarPanel,
  CasehubSpeech,
  CasehubTranscript
};
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
@lit/reactive-element/decorators/custom-element.js:
@lit/reactive-element/decorators/property.js:
@lit/reactive-element/decorators/state.js:
@lit/reactive-element/decorators/event-options.js:
@lit/reactive-element/decorators/base.js:
@lit/reactive-element/decorators/query.js:
@lit/reactive-element/decorators/query-all.js:
@lit/reactive-element/decorators/query-async.js:
@lit/reactive-element/decorators/query-assigned-nodes.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
