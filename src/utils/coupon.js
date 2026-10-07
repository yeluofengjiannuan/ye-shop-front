/**
 * 优惠券数据归一化
 *
 * 后端两张表返回的结构不一样，字段也不全（为 null 的字段 Jackson 直接不输出），
 * 所以在进 UI 之前统一在这一层拍平，卡片组件只管渲染、不去猜后端字段。
 */

/** 券类型 */
export const COUPON_TYPE = {
	FULL_REDUCE: 1, // 满减
	DISCOUNT: 2, // 折扣
	NO_THRESHOLD: 3, // 无门槛
}

/** 使用范围 */
const SCOPE_TEXT = {
	1: '全场通用',
	2: '指定商品可用',
	3: '指定分类可用',
}

/**
 * 解析后端时间。
 *
 * 后端两种格式混着来：CouponUser 上有 @JsonFormat，返回 '2026-10-20 23:59:59'；
 * CouponUserVO 上没有，返回 '2026-10-20T23:59:59'。
 * iOS Safari 不认识带空格的那种，统一换成带 T 的 ISO 形式再解析。
 */
export function parseDate(raw) {
	if (!raw) return null
	const date = new Date(String(raw).replace(' ', 'T'))
	return Number.isNaN(date.getTime()) ? null : date
}

/** 去掉小数末尾多余的 0：20.00 → '20'，0.85 → '0.85' */
function trimNumber(value) {
	const n = Number(value)
	if (!Number.isFinite(n)) return ''
	return String(Number(n.toFixed(2)))
}

/** 金额文案：0 → ''，否则 '20' */
function amountText(value) {
	const text = trimNumber(value)
	return text === '0' ? '' : text
}

/** 时间戳格式化成 'YYYY-MM-DD' */
function formatDay(date) {
	if (!date) return ''
	const pad = (n) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * 券面主数字拆成三段，好让「¥」「折」用更小的字号。
 * 键名要和 CouponCard 里的 coupon.amount* 对齐 —— 这里是用 ... 展开进券对象的，
 * 名字对不上不会报错，只会渲染成空白（踩过一次）。
 *
 * 满减/无门槛 → { amountPrefix: '¥', amountValue: '20', amountSuffix: '' }
 * 折扣        → { amountPrefix: '',  amountValue: '8',  amountSuffix: '折' }
 */
function buildAmountParts(coupon) {
	const type = Number(coupon.type)
	if (type === COUPON_TYPE.DISCOUNT) {
		const rate = Number(coupon.discountAmount)
		if (!Number.isFinite(rate) || rate <= 0) {
			return { amountPrefix: '', amountValue: '--', amountSuffix: '' }
		}
		// 0.8 → 8，0.85 → 8.5
		const value = Number((rate * 10).toFixed(2))
		return { amountPrefix: '', amountValue: String(value), amountSuffix: '折' }
	}
	const amount = amountText(coupon.discountAmount)
	return amount
		? { amountPrefix: '¥', amountValue: amount, amountSuffix: '' }
		: { amountPrefix: '', amountValue: '--', amountSuffix: '' }
}

/** 按 type 算门槛文案 */
function buildConditionText(coupon) {
	const type = Number(coupon.type)
	if (type === COUPON_TYPE.NO_THRESHOLD) return '无门槛'
	const condition = amountText(coupon.conditionAmount)
	return condition ? `满${condition}可用` : '无门槛'
}

/** 折扣券的封顶文案，没有就返回空串 */
function buildMaxText(coupon) {
	if (Number(coupon.type) !== COUPON_TYPE.DISCOUNT) return ''
	const max = amountText(coupon.maxDiscount)
	return max ? `最高减¥${max}` : ''
}

/**
 * 活动列表项（Coupon）→ 卡片结构
 *
 * 注意：/api/coupon/activity 不筛已过期，实测 5 张里有 2 张 validEnd 早就过了
 * 却还是 ON_SHELF，所以这里自己算 expired，由调用方决定藏起来还是置灰。
 */
export function normalizeActivity(raw) {
	const coupon = raw || {}
	const validEnd = parseDate(coupon.validEnd)
	const validMode = Number(coupon.validMode)

	let validText = ''
	if (validMode === 2) {
		const days = Number(coupon.validDays)
		validText = Number.isFinite(days) && days > 0 ? `领取后 ${days} 天内有效` : '领取后限时有效'
	} else if (validEnd) {
		validText = `${formatDay(validEnd)} 前有效`
	}

	const total = Number(coupon.totalQty)
	const received = Number(coupon.receiveQty)
	// receiveQty 要等 MQ 消费后才更新，所以这个余量天然有滞后
	const remaining =
		Number.isFinite(total) && Number.isFinite(received) ? Math.max(0, total - received) : null

	return {
		id: coupon.id,
		name: coupon.name || '优惠券',
		activityName: coupon.activityName || '',
		type: Number(coupon.type),
		...buildAmountParts(coupon),
		conditionText: buildConditionText(coupon),
		maxText: buildMaxText(coupon),
		scopeText: SCOPE_TEXT[Number(coupon.useScope)] || '',
		validText,
		perUserQty: Number(coupon.perUserQty) || 0,
		remaining,
		expired: !!validEnd && validEnd.getTime() < Date.now(),
	}
}

/**
 * 我持有的券（CouponUserVO）→ 卡片结构
 *
 * 这个 VO 字段比活动列表少：没有 useScope、没有 maxDiscount，有效期只有 expireTime。
 */
export function normalizeMine(raw) {
	const item = raw || {}
	const expireTime = parseDate(item.expireTime)
	const unused = Number(item.unusedCount) || 0
	const locked = Number(item.lockedCount) || 0

	return {
		id: item.couponId,
		couponUserId: item.couponUserId,
		name: item.couponName || '优惠券',
		activityName: '',
		type: Number(item.type),
		...buildAmountParts(item),
		conditionText: buildConditionText(item),
		maxText: buildMaxText(item),
		scopeText: '',
		validText: expireTime ? `${formatDay(expireTime)} 前有效` : '',
		// 我的券展示的是「还剩几张」，不是库存
		countText: locked > 0 ? `可用 ${unused} 张 · 锁定 ${locked} 张` : `可用 ${unused} 张`,
		expired: !!expireTime && expireTime.getTime() < Date.now(),
	}
}
