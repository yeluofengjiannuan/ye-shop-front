import { defineStore } from 'pinia'
import { cartApi } from '@/utils/api'
import { useUserStore } from './user'

/**
 * 后端没有购物车件数接口，角标只能从列表算。
 * 反正加购/改数量/删除之后都要拿服务端权威值刷新，顺带就把 count 带出来了。
 */
function normalize(list) {
	return (Array.isArray(list) ? list : [])
		.filter((item) => item && item.id != null)
		.map((item) => ({
			...item,
			// 后端对数量不做任何校验（实测能写进 0 和负数），
			// 这里兜一下下界，免得渲染出一个没法操作的步进器
			quantity: Math.max(1, Number(item.quantity) || 1),
		}))
}

/**
 * 在途去重。App 启动时会拉一次（为了角标），页面 onShow 又会拉一次，
 * 两边撞在一起就是同一份数据请求两遍。这里让并发调用共用同一个 Promise。
 * 注意只对「同时在途」生效，不缓存结果 —— onShow 拿到的仍是最新数据。
 */
let inflight = null
let inflightId = 0

export const useCartStore = defineStore('cart', {
	state: () => ({
		items: [],
		loaded: false,
	}),

	getters: {
		/** 角标用的总件数：按数量求和，不是行数 */
		count: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),
	},

	actions: {
		/**
		 * 拉取购物车。
		 * 故意不往外抛：它会在 App 启动、页面 onShow 这些地方被调用，
		 * 一个网络抖动不该让页面崩掉，也不该把用户踢到登录页
		 * （request.js 在刷新令牌失败时会 logout，所以这里必须兜住）。
		 *
		 * force 的用途：改完数量/删完东西后的那次刷新必须拿到改完之后的数据，
		 * 不能去复用另一个「改之前就发出去了」的在途请求，否则本地会被旧数据覆盖。
		 */
		async load({ force = false } = {}) {
			const userStore = useUserStore()
			if (!userStore.isLogin) {
				this.reset()
				return false
			}
			if (inflight && !force) return inflight

			// 用递增 id 标记「当前这次」，避免旧请求的 finally 把新请求的标记清掉
			const myId = ++inflightId
			inflight = (async () => {
				try {
					this.items = normalize(await cartApi.getList())
					this.loaded = true
					return true
				} catch (err) {
					console.warn('[cart] 加载失败：', (err && err.message) || err)
					return false
				} finally {
					if (myId === inflightId) inflight = null
				}
			})()
			return inflight
		},

		/** 加购成功后立刻刷新，保证角标是服务端的真实件数 */
		async add({ productId, specId, quantity = 1 }) {
			if (!productId || !specId) throw new Error('请先选择商品规格')
			const qty = Math.max(1, Number(quantity) || 1)
			await cartApi.add({ productId, specId, quantity: qty })
			await this.load({ force: true })
		},

		/**
		 * 改数量。quantity 必须在 [1, stock] 内 —— 后端不校验，
		 * 传 0 或负数会真的写进库，所以这里直接挡掉。
		 */
		async updateQuantity({ cartId, quantity }) {
			const qty = Number(quantity)
			if (!cartId || !Number.isFinite(qty) || qty < 1) {
				throw new Error('数量不正确')
			}
			await cartApi.updateQuantity({ cartId, quantity: qty })
			await this.load({ force: true })
		},

		async remove({ ids }) {
			await cartApi.removeBatch({ ids })
			await this.load({ force: true })
		},

		async clear() {
			// 空车调 /api/cart/clear 后端会 500，这里先挡一道
			if (!this.items.length) return
			await cartApi.clear()
			await this.load({ force: true })
		},

		/** 登出时清空，避免换个账号登录后角标串号 */
		reset() {
			this.items = []
			this.loaded = false
		},
	},
})
