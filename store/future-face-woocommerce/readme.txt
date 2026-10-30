=== Future Face for WooCommerce ===
Requires at least: 6.5
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Shows the Future Face sun-ageing preview and an SPF routine on single product pages.

== Description ==

On every WooCommerce single product page the plugin loads the Future Face widget script and adds a
`div[data-future-face]` after the add-to-cart form. It sets:

* `data-product`: the product's GTIN, or its SKU when there is no GTIN
* `data-spf`: the value of the product's "SPF" attribute, when it has one
* `data-cart`: a JSON map of barcode to add-to-cart URL for every published product, so the widget can add a routine to the real cart

Nothing is output when WooCommerce is not active.

== Installation ==

1. Copy this folder to `wp-content/plugins/` and activate it.
2. Go to Settings > Future Face and set the address of your Future Face app (default `http://localhost:3000`).

== Changelog ==

= 0.1.0 =
* First version.
