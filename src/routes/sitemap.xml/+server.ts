import type { RequestHandler } from '@sveltejs/kit';
import { BRAND } from '$lib/brand';

/**
 * Sitemap dinámico — sólo lista las URLs públicas indexables.
 * Las rutas internas (clientes, facturas, MikroTik, etc.) están
 * tras autenticación y se excluyen explícitamente por privacidad.
 */
export const GET: RequestHandler = async () => {
	const base = BRAND.canonicalUrl.replace(/\/$/, '');
	const today = new Date().toISOString().split('T')[0];

	const urls: Array<{ loc: string; priority: string; changefreq: string }> = [
		{ loc: `${base}/`,       priority: '1.0', changefreq: 'weekly' },
		{ loc: `${base}/login`,  priority: '0.8', changefreq: 'monthly' },
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		(u) => `	<url>
		<loc>${u.loc}</loc>
		<lastmod>${today}</lastmod>
		<changefreq>${u.changefreq}</changefreq>
		<priority>${u.priority}</priority>
	</url>`
	)
	.join('\n')}
</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=86400'
		}
	});
};
