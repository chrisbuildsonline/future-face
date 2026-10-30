<?php
/**
 * Plugin Name: Future Face for WooCommerce
 * Description: Shows the Future Face sun-ageing preview on single product pages.
 * Version: 0.1.0
 * Requires Plugins: woocommerce
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: future-face-woocommerce
 */

defined( 'ABSPATH' ) || exit;

const FF_WC_OPTION = 'ff_wc_url';
const FF_WC_DEFAULT_URL = 'http://localhost:3000';

function ff_wc_base_url() {
	return untrailingslashit( get_option( FF_WC_OPTION, FF_WC_DEFAULT_URL ) );
}

// Settings > Future Face.
add_action( 'admin_menu', function () {
	add_options_page( 'Future Face', 'Future Face', 'manage_options', 'future-face', 'ff_wc_render_settings' );
} );

add_action( 'admin_init', function () {
	register_setting( 'future-face', FF_WC_OPTION, array(
		'type'              => 'string',
		'sanitize_callback' => 'esc_url_raw',
		'default'           => FF_WC_DEFAULT_URL,
	) );
	add_settings_section( 'ff_wc_main', '', '__return_null', 'future-face' );
	add_settings_field( FF_WC_OPTION, 'Future Face URL', function () {
		printf(
			'<input type="url" class="regular-text" name="%s" value="%s"><p class="description">Where the Future Face app runs. Its widget.js is loaded from here.</p>',
			esc_attr( FF_WC_OPTION ),
			esc_attr( ff_wc_base_url() )
		);
	}, 'future-face', 'ff_wc_main' );
} );

function ff_wc_render_settings() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	echo '<div class="wrap"><h1>Future Face</h1><form method="post" action="options.php">';
	settings_fields( 'future-face' );
	do_settings_sections( 'future-face' );
	submit_button();
	echo '</form></div>';
}

// Single product pages: load the widget script.
add_action( 'wp_enqueue_scripts', function () {
	if ( ! class_exists( 'WooCommerce' ) || ! is_product() ) {
		return;
	}
	wp_enqueue_script( 'future-face-widget', ff_wc_base_url() . '/widget.js', array(), null, array( 'strategy' => 'defer' ) );
} );

// ...and print the placeholder div after the add-to-cart form.
add_action( 'woocommerce_after_add_to_cart_form', function () {
	if ( ! class_exists( 'WooCommerce' ) ) {
		return;
	}
	$product = wc_get_product( get_the_ID() );
	if ( ! $product ) {
		return;
	}

	$spf = $product->get_attribute( 'SPF' );
	printf(
		'<div data-future-face data-product="%s"%s data-cart="%s"></div>',
		esc_attr( ff_wc_barcode( $product ) ),
		'' !== $spf ? ' data-spf="' . esc_attr( $spf ) . '"' : '',
		esc_attr( wp_json_encode( ff_wc_cart_map() ) )
	);
}, 20 );

function ff_wc_barcode( $product ) {
	return $product->get_global_unique_id() ? $product->get_global_unique_id() : $product->get_sku();
}

// Barcode (GTIN, else SKU) => add-to-cart URL, for every published product.
function ff_wc_cart_map() {
	$base = wc_get_cart_url() ? wc_get_cart_url() : home_url( '/' );
	$map  = array();
	foreach ( wc_get_products( array( 'status' => 'publish', 'limit' => -1 ) ) as $p ) {
		$code = ff_wc_barcode( $p );
		if ( '' !== $code ) {
			$map[ $code ] = add_query_arg( 'add-to-cart', $p->get_id(), $base );
		}
	}
	return $map;
}
