/**
 * 商品图片兜底
 *
 * 后端商品表的 image 字段大量是非法的（如 "https:dining-table-cover.jpg"），
 * 目前只有 /api/banner/list 的图片链接是能用的，所以商品图基本都会走到占位图。
 * 后端修好后这里不用改，合法地址会自动透传。
 */

const PLACEHOLDER_IMAGES = [1, 2, 3, 4, 5, 6].map((n) => `/static/goods/goods-${n}.png`)

/** 按商品 id 取占位图，取模是为了让网格里不至于整屏同一张图 */
export function placeholderFor(id) {
	const n = Math.abs(Number(id) || 0)
	return PLACEHOLDER_IMAGES[n % PLACEHOLDER_IMAGES.length]
}

/**
 * 解析商品该用哪张图
 * @param {object} item 商品
 * @param {Array} failedIds 已加载失败过的商品 id（由调用方维护）
 */
export function resolveProductImage(item, failedIds = []) {
	if (!item) return PLACEHOLDER_IMAGES[0]
	if (failedIds.indexOf(item.id) !== -1) return placeholderFor(item.id)
	const raw = item.image || ''
	// 明显不是完整 URL 的直接用占位图，省掉一次必然失败的请求
	if (!/^https?:\/\//i.test(raw)) return placeholderFor(item.id)
	return raw
}

/** 商品价格格式化：后端返回数字（如 1299.0），统一显示两位小数 */
export function formatPrice(price) {
	const n = Number(price)
	return Number.isFinite(n) ? n.toFixed(2) : '--'
}
