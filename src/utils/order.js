/**
 * 订单相关的枚举映射与归一化
 *
 * OrderWithItemVO 里**金额和 id 全是字符串**（"2598.00" / "53"），和商品、购物车
 * 接口返回数字不一致。在这一层统一转成数字，页面不碰原始类型。
 */

import { normalizeMine, scopeTextOf } from './coupon'

/**
 * 订单列表的 5 个 tab，对应后端 OrderPageEnum.pageKey。
 * 只能取这几个值 —— 传别的后端抛 IllegalArgumentException，直接 HTTP 500（不是 400）。
 */
export const ORDER_PAGES = [
	{ key: 'allPage', name: '全部' },
	{ key: 'pendingPayPage', name: '待付款' },
	{ key: 'packagingPage', name: '打包中' },
	{ key: 'pendingReceiptPage', name: '待收货' },
	{ key: 'pendingEvalPage', name: '评价' },
]

/** OrderStatusEnum 的 @JsonValue 值 → 中文 */
const STATUS_TEXT = {
	pendingPayment: '待支付',
	pendingConfirm: '待确认',
	pendingShipment: '待发货',
	pendingReceipt: '待收货',
	completed: '已完成',
	cancelled: '已取消',
	afterSale: '售后中',
	evaluated: '已评价',
	reviewed: '已追评',
}

/** PayTypeEnum 的 @JsonValue 值 → 中文 */
const PAY_TYPE_TEXT = {
	unpaid: '未支付',
	wechatPay: '微信支付',
	aliPay: '支付宝支付',
}

export function orderStatusText(status) {
	return STATUS_TEXT[status] || status || ''
}

export function payTypeText(payType) {
	return PAY_TYPE_TEXT[payType] || ''
}

/** 只有待支付能取消和支付，和后端 cancelOrder / paySuccess 的前置条件一致 */
export function canCancel(order) {
	return !!order && order.status === 'pendingPayment'
}

export function canPay(order) {
	return !!order && order.status === 'pendingPayment'
}

function toNumber(value) {
	const n = Number(value)
	return Number.isFinite(n) ? n : 0
}

function normalizeItem(raw) {
	const item = raw || {}
	const price = toNumber(item.price)
	const quantity = toNumber(item.quantity)
	return {
		productId: item.productId,
		specId: item.specId,
		productName: item.productName || '',
		productImage: item.productImage || '',
		specText: item.specText || '',
		price,
		quantity,
		subtotal: price * quantity,
	}
}

/**
 * OrderWithItemVO → 页面用的结构
 *
 * 注意：**列表接口返回的数据里没有 orderItems，也没有 address**（后端 buildResult
 * 只做了实体到 VO 的拷贝，没有联查 order_item）。详情接口才有。所以这里都兜成空。
 */
export function normalizeOrder(raw) {
	const order = raw || {}
	return {
		orderNo: order.orderNo || '',
		status: order.status || '',
		statusText: orderStatusText(order.status),
		payType: order.payType || '',
		payTypeText: payTypeText(order.payType),
		totalGoodsAmount: toNumber(order.totalGoodsAmount),
		totalAmount: toNumber(order.totalAmount),
		freight: toNumber(order.freight),
		remark: order.remark || '',
		createTime: order.createTime || '',
		payTime: order.payTime || '',
		orderItems: (order.orderItems || []).map(normalizeItem),
		address: order.address || null,
		canCancel: canCancel(order),
		canPay: canPay(order),
	}
}

/**
 * 预估优惠金额。
 *
 * 为什么要标 exact：CouponUserVO 里没有 useScope，后端算优惠时只对**适用商品**的小计
 * 打折，而前端拿不到"这张券能覆盖订单里哪几件"。所以只有全场通用的券能算准。
 *
 * @param couponUser 原始的 CouponUserVO
 * @param activityCoupon 从 /api/coupon/activity 里按 couponId 找到的那张券（可能没有）
 * @param goodsAmount 商品总金额
 * @returns {{ amount: number, exact: boolean }}
 */
export function estimateDiscount(couponUser, activityCoupon, goodsAmount) {
	if (!couponUser || !(goodsAmount > 0)) return { amount: 0, exact: true }

	const type = Number(couponUser.type)
	const discountAmount = toNumber(couponUser.discountAmount)
	const conditionAmount = toNumber(couponUser.conditionAmount)
	// 活动列表里才有 useScope；找不到就当作不确定
	const scope = activityCoupon ? Number(activityCoupon.useScope) : 0
	const exact = scope === 1

	let amount = 0
	if (type === 1) {
		// 满减：没到门槛后端不报错，只是给 0 优惠
		amount = goodsAmount >= conditionAmount ? discountAmount : 0
	} else if (type === 2) {
		// 折扣：discountAmount 是折扣率（0.8 = 8 折）
		amount = goodsAmount * (1 - discountAmount)
		const max = activityCoupon ? toNumber(activityCoupon.maxDiscount) : 0
		if (max > 0) amount = Math.min(amount, max)
	} else if (type === 3) {
		amount = discountAmount
	}

	// 兜底：优惠不能超过商品总价（后端也是这么兜的）
	amount = Math.max(0, Math.min(amount, goodsAmount))
	// 后端按分四舍五入
	amount = Number(amount.toFixed(2))

	return { amount, exact }
}

/**
 * 组装确认订单页的优惠券选项。
 *
 * 不过滤"用不上"的券，只把明显不划算的满减券标出来（金额没到门槛），
 * 让用户自己判断 —— 因为范围 2/3 的券前端根本算不出能不能用，
 * 那些由后端在下单时校验并返回「订单商品不符合优惠券使用范围」。
 */
export function buildCouponOptions(myList, activityList, goodsAmount) {
	const activityMap = {}
	;(activityList || []).forEach((c) => {
		if (c && c.id != null) activityMap[c.id] = c
	})

	return (myList || [])
		.filter((c) => c && Number(c.unusedCount) > 0)
		.map((raw) => {
			const display = normalizeMine(raw)
			const activity = activityMap[raw.couponId] || null
			const { amount, exact } = estimateDiscount(raw, activity, goodsAmount)
			// 满减券没到门槛时后端给 0 优惠，提前告诉用户
			const wasted = Number(raw.type) === 1 && amount === 0
			return {
				couponUserId: raw.couponUserId,
				couponId: raw.couponId,
				name: display.name,
				// 券面主数字是拆成 prefix/value/suffix 三段的，这里拼回一行
				amountText: `${display.amountPrefix || ''}${display.amountValue || ''}${display.amountSuffix || ''}`,
				conditionText: display.conditionText,
				// 范围只有活动列表里有，CouponUserVO 没这个字段
				scopeText: scopeTextOf(activity && activity.useScope),
				validText: display.validText,
				discount: amount,
				exact,
				wasted,
			}
		})
		/*
		 * 排序分三层，顺序不能反：
		 * 1. 用不上的（满减没到门槛）沉底
		 * 2. **能算准的排前面** —— 范围 2/3 的券前端算不出实际能减多少，
		 *    预估数字往往虚高（折扣券按整单算再封顶）。光按预估金额排，
		 *    会把一张"看起来减 50 但可能压根不适用"的券排到"确定减 20"前面，
		 *    用户照着选就容易下单失败。
		 * 3. 同层再按金额从大到小
		 */
		.sort((a, b) => {
			if (a.wasted !== b.wasted) return a.wasted ? 1 : -1
			if (a.exact !== b.exact) return a.exact ? -1 : 1
			return b.discount - a.discount
		})
}
