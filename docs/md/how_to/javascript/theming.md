# Theming

Theming is supported in `perspective-viewer` and its accompanying plugins. A
number of themes come bundled with `perspective-viewer`; you can import any of
these themes directly into your app, and the `perspective-viewer`s will be
themed accordingly:

```javascript
// Themes based on Thought Merchants's Prospective design. `pro.css` ("Pro")
// follows the browser's `prefers-color-scheme`; `pro-light.css` ("Pro Light")
// and `pro-dark.css` ("Pro Dark") pin one palette.
import "@perspective-dev/viewer/dist/css/pro.css";
import "@perspective-dev/viewer/dist/css/pro-light.css";
import "@perspective-dev/viewer/dist/css/pro-dark.css";

// Other themes
import "@perspective-dev/viewer/dist/css/solarized.css";
import "@perspective-dev/viewer/dist/css/monokai.css";
import "@perspective-dev/viewer/dist/css/vaporwave.css";

// ...

```

Alternatively, you may use `themes.css`, which bundles all default themes

```javascript
import "@perspective-dev/viewer/dist/css/themes.css";
```

If you choose not to bundle the themes yourself, they are available through
[CDN](https://cdn.jsdelivr.net/npm/@perspective-dev/viewer/dist/css/). These can
be directly linked in your HTML file:

```html
<link
    rel="stylesheet"
    crossorigin="anonymous"
    href="https://cdn.jsdelivr.net/npm/@perspective-dev/viewer/dist/css/pro.css"
/>
```

Note the `crossorigin="anonymous"` attribute. When including a theme from a
cross-origin context, this attribute may be required to allow
`<perspective-viewer>` to detect the theme. Stylesheets added to the
`document` after `<perspective-viewer>` init are detected automatically the
next time the theme list is read. If detection fails for any other reason, such
as a CORS-blocked stylesheet or rules inserted into an existing stylesheet with
`insertRule()`, you may manually inform `<perspective-viewer>` of the available
theme names with the `.resetThemes()` method.

```javascript
// re-auto-detect themes
viewer.resetThemes();

// Set available themes explicitly (they still must be imported as CSS!)
viewer.resetThemes(["Pro Light", "Pro Dark"]);
```

`<perspective-viewer>` will default to the first loaded theme when initialized.
You may override this via `.restore()`, or provide an initial theme by setting
the `theme` attribute:

```html
<perspective-viewer theme="Pro Light"></perspective-viewer>
```

or

```javascript
const viewer = document.querySelector("perspective-viewer");
await viewer.restore({ theme: "Pro Dark" });
```

## Following the browser color scheme at runtime

The `"Pro"` theme (`pro.css`) resolves its palette from
`prefers-color-scheme`. The viewer's own UI follows a change in that preference
on its own, but plugins such as the datagrid and charts capture their colors
when they render, so an application should call `restyleElement()` when the
preference changes:

```javascript
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    viewer.restyleElement();
});
```

Applications with their own light/dark switch should keep selecting
`"Pro Light"` or `"Pro Dark"` by name instead, since a page cannot change the
browser's `prefers-color-scheme`.

## Custom Themes

The best way to write a new theme is to
[fork and modify an existing theme](https://github.com/perspective-dev/perspective/tree/master/rust/perspective-viewer/src/themes),
which are _just_ collections of regular CSS variables — Perspective's own
themes are plain `.css` files, with no preprocessor involved (the one
exception is the `Pro` family which is templated for auto support). A theme is
registered by any style rule which declares `--psp-theme-name: "<Name>"` and
whose selector names `perspective-viewer`; the rule may be nested inside
`@media`, `@layer` or any other grouping rule, reached through `@import`, or
live in a constructed stylesheet adopted by the `document` or by the shadow root
hosting the viewer.
`<perspective-viewer>` is
not "themed" by default and will lack icons and label text in addition to colors
and fonts, so starting from an empty theme forces you to define _every_
theme-able variable to get a functional UI.

### Icons and Translation

UI icons are defined by CSS variables provided by
[`@perspective-dev/viewer/dist/css/icons.css`](https://github.com/perspective-dev/perspective/blob/master/rust/perspective-viewer/src/themes/icons.css).
These variables must be defined for the UI icons to work - there are no default
icons without a theme.

UI text is also defined in CSS variables provided by
[`@perspective-dev/viewer/dist/css/intl.css`](https://github.com/perspective-dev/perspective/blob/master/rust/perspective-viewer/src/themes/intl.css),
and has identical import requirements. Some _example definitions_
(automatically-translated sans-editing) can be found
[`@perspective-dev/viewer/dist/css/intl/` folder](https://github.com/perspective-dev/perspective/tree/master/rust/perspective-viewer/src/themes/intl).

Importing the pre-built `themes.css` stylesheet as well as a custom theme will
define Icons and Translation globally as a side-effect. You can still customize
icons in this mode with rules (of the appropriate specificity), _but_ if you do
not still remember to define these variables yourself, your theme will not work
without the base `themes.css` package available.
