<?php
/**
 * Imports fixtures/products.json into WooCommerce. Run by seed.ts via `wp eval-file`.
 * Idempotent: a product whose SKU already exists is skipped.
 * Prices are placeholders (one per product kind): Open Beauty Facts has none.
 * Existing products still get their category and price refreshed.
 */

require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

$data = json_decode( file_get_contents( '/tmp/products.json' ), true );
if ( empty( $data['products'] ) ) {
	WP_CLI::error( 'fixtures/products.json has no products' );
}

$admin = get_user_by( 'login', 'admin' );
if ( $admin ) {
	wp_set_current_user( $admin->ID );
}

function ff_term( $name, $parent = 0 ) {
	$t = term_exists( $name, 'product_cat', $parent );
	if ( ! $t ) {
		$t = wp_insert_term( $name, 'product_cat', array( 'parent' => $parent ) );
	}
	return (int) ( is_wp_error( $t ) ? 0 : $t['term_id'] );
}

// One demo price per product kind.
function ff_price( $p ) {
	switch ( $p['kind'] ) {
		case 'spray':
		case 'stick':
			return '12.90';
		case 'cleanser':
			return '9.90';
		default:
			return (int) $p['spf'] >= 50 ? '18.90' : '14.90';
	}
}

$sun = ff_term( 'Sun care' );
update_option( 'default_product_cat', $sun );
$kind_cat = array(
	'cream'    => ff_term( 'Face SPF', $sun ),
	'fluid'    => ff_term( 'Face SPF', $sun ),
	'spray'    => ff_term( 'Sticks & sprays', $sun ),
	'stick'    => ff_term( 'Sticks & sprays', $sun ),
	'cleanser' => ff_term( 'Cleansers', $sun ),
);

$created = 0;
$skipped = 0;
$spf50_url = '';

foreach ( $data['products'] as $p ) {
	$code = (string) $p['code'];
	$existing = wc_get_product_id_by_sku( $code );

	if ( ! $existing ) {
		$product = new WC_Product_Simple();
		$product->set_name( $p['name'] );
		$product->set_status( 'publish' );
		$product->set_sku( $code );
		$product->set_global_unique_id( $code );
		$product->set_regular_price( ff_price( $p ) );
		$product->set_short_description(
			'<p>' . esc_html( $p['brand'] ) . ' &middot; ' . esc_html( $p['size'] ) . '</p><p><em>Demo price.</em></p>'
		);
		$product->set_description(
			'<p><strong>Ingredients:</strong> ' . esc_html( $p['ingredients'] ) . '</p>'
			. '<p><small>Product data: <a href="' . esc_url( $p['url'] ) . '">Open Beauty Facts</a>, ODbL.</small></p>'
		);

		if ( null !== $p['spf'] ) {
			$attr = new WC_Product_Attribute();
			$attr->set_name( 'SPF' );
			$attr->set_options( array( (string) $p['spf'] ) );
			$attr->set_visible( true );
			$attr->set_variation( false );
			$product->set_attributes( array( $attr ) );
		}

		$product->set_category_ids( array_filter( array( $sun, $kind_cat[ $p['kind'] ] ?? 0 ) ) );
		$existing = $product->save();

		// sideload moves its source file: work on a copy.
		$src = '/tmp/products/' . basename( $p['image'] );
		if ( file_exists( $src ) ) {
			$tmp = wp_tempnam( $code . '.jpg' );
			copy( $src, $tmp );
			$att = media_handle_sideload( array( 'name' => $code . '.jpg', 'tmp_name' => $tmp ), $existing );
			if ( is_wp_error( $att ) ) {
				WP_CLI::warning( "image for $code: " . $att->get_error_message() );
			} else {
				$product->set_image_id( $att );
				$product->save();
			}
		} else {
			WP_CLI::warning( "no image file for $code ($src)" );
		}

		++$created;
	} else {
		$product = wc_get_product( $existing );
		$product->set_regular_price( ff_price( $p ) );
		$product->set_category_ids( array_filter( array( $sun, $kind_cat[ $p['kind'] ] ?? 0 ) ) );
		$product->save();
		++$skipped;
	}

	if ( '' === $spf50_url && 50 === (int) $p['spf'] ) {
		$spf50_url = get_permalink( $existing );
	}
}

WP_CLI::log( "SEED created=$created skipped=$skipped" );
WP_CLI::log( "SPF50_URL=$spf50_url" );
