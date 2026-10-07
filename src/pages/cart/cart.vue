<template>
	<view class="page">
		<PageHeader title="购物车">
			<template #right>
				<text v-if="items.length" class="clear" @click="clearAll">清空</text>
			</template>
		</PageHeader>

		<view v-if="loading" class="status">
			<text class="status__text">加载中…</text>
		</view>

		<view v-else-if="failed" class="status">
			<text class="status__text">购物车加载失败</text>
			<view class="status__btn" @click="refresh(true)">
				<text class="status__btn-text">重新加载</text>
			</view>
		</view>

		<view v-else-if="!items.length" class="status">
			<text class="status__text">购物车还是空的</text>
			<view class="status__btn" @click="goShopping">
				<text class="status__btn-text">去逛逛</text>
			</view>
		</view>

		<block v-else>
			<view class="list">
				<view class="row" v-for="item in items" :key="item.id">
					<view
						class="row__check"
						:class="{ 'row__check--on': isChecked(item.id) }"
						@click="toggleCheck(item.id)"
					>
						<view class="row__check-tick"></view>
					</view>

					<image
						class="row__img"
						:src="imageFor(item)"
						mode="aspectFill"
						@error="onImageError(item)"
					/>

					<view class="row__body">
						<text class="row__name">{{ item.productName }}</text>
						<text v-if="item.specText" class="row__spec">{{ item.specText }}</text>

						<view class="row__foot">
							<text class="row__price">
								<text class="row__symbol">¥</text>{{ formatPrice(item.price) }}
							</text>

							<view class="stepper">
								<view
									class="stepper__btn"
									:class="{ 'stepper__btn--off': !canDec(item) }"
									@click="changeQuantity(item, -1)"
								>
									<text class="stepper__sign">−</text>
								</view>
								<text class="stepper__num">{{ item.quantity }}</text>
								<view
									class="stepper__btn"
									:class="{ 'stepper__btn--off': !canInc(item) }"
									@click="changeQuantity(item, 1)"
								>
									<text class="stepper__sign">+</text>
								</view>
							</view>
						</view>

						<text v-if="isOutOfStock(item)" class="row__warn">库存不足</text>
					</view>

					<text class="row__remove" @click="removeOne(item)">删除</text>
				</view>
			</view>
		</block>

		<!-- 底部结算栏 -->
		<view v-if="items.length" class="actionbar">
			<view class="actionbar__all" @click="toggleAll">
				<view
					class="row__check"
					:class="{ 'row__check--on': allChecked }"
				>
					<view class="row__check-tick"></view>
				</view>
				<text class="actionbar__all-text">全选</text>
			</view>

			<view class="actionbar__total">
				<text class="actionbar__total-label">合计</text>
				<text class="actionbar__total-price">
					<text class="actionbar__total-symbol">¥</text>{{ formatPrice(totalPrice) }}
				</text>
			</view>

			<view
				class="actionbar__btn"
				:class="{ 'actionbar__btn--off': !checkedQuantity }"
				@click="goCheckout"
			>
				<text class="actionbar__btn-text">结算({{ checkedQuantity }})</text>
			</view>
		</view>
		<view v-if="items.length" class="actionbar-spacer"></view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { useCartStore } from '@/store/modules/cart'
import { resolveImage, formatPrice } from '@/utils/productImage'

export default {
	components: { PageHeader },
	data() {
		return {
			loading: true,
			failed: false,
			/*
			 * 勾选状态只能放在页面本地：后端 cart 表虽然有 checked 列，
			 * 但 CartItem 没把它返回，也没有任何修改它的接口，
			 * 所以这里选中什么刷新一次就没了，改不了。
			 */
			checkedIds: [],
			selectionReady: false,
			// 正在提交数量修改的行，避免连点产生竞态
			busyIds: [],
			failedImageIds: [],
			removing: false,
			clearing: false,
		}
	},
	computed: {
		items() {
			return useCartStore().items
		},
		checkedItems() {
			return this.items.filter((item) => this.isChecked(item.id))
		},
		allChecked() {
			return this.items.length > 0 && this.checkedIds.length === this.items.length
		},
		checkedQuantity() {
			return this.checkedItems.reduce((sum, item) => sum + item.quantity, 0)
		},
		totalPrice() {
			return this.checkedItems.reduce(
				(sum, item) => sum + Number(item.price || 0) * item.quantity,
				0
			)
		},
	},
	// 用 onShow：从商品详情/规格半屏加购后返回，购物车要能立刻反映出来
	onShow() {
		this.refresh()
	},
	methods: {
		formatPrice,
		async refresh(resetSelection = false) {
			this.loading = true
			this.failed = false
			const ok = await useCartStore().load()
			this.failed = !ok
			this.loading = false

			const ids = this.items.map((item) => item.id)
			if (resetSelection || !this.selectionReady) {
				// 首次进页面默认全选：用户加进购物车就是为了买，
				// 而且这样「合计」一进来就是有意义的数字
				this.checkedIds = ids
				this.selectionReady = true
			} else {
				this.pruneSelection()
			}
		},
		/**
		 * 只把已经消失的行从勾选集合里剔掉。
		 * 不能整个重置，否则用户改个数量（也会触发一次刷新）就把自己勾的全清了。
		 */
		pruneSelection() {
			const ids = this.items.map((item) => item.id)
			this.checkedIds = this.checkedIds.filter((id) => ids.indexOf(id) !== -1)
		},
		isChecked(id) {
			return this.checkedIds.indexOf(id) !== -1
		},
		toggleCheck(id) {
			this.checkedIds = this.isChecked(id)
				? this.checkedIds.filter((item) => item !== id)
				: this.checkedIds.concat(id)
		},
		toggleAll() {
			this.checkedIds = this.allChecked ? [] : this.items.map((item) => item.id)
		},
		/** 后端不校验数量（实测能写进 0 和负数），上下限全在前端卡 */
		stockLimit(item) {
			const stock = Number(item.stock)
			return Number.isFinite(stock) && stock > 0 ? stock : 0
		},
		canDec(item) {
			return this.busyIds.indexOf(item.id) === -1 && item.quantity > 1
		},
		canInc(item) {
			const limit = this.stockLimit(item)
			return this.busyIds.indexOf(item.id) === -1 && limit > 0 && item.quantity < limit
		},
		isOutOfStock(item) {
			const limit = this.stockLimit(item)
			return limit === 0 || item.quantity > limit
		},
		async changeQuantity(item, delta) {
			if (this.busyIds.indexOf(item.id) !== -1) return

			const limit = this.stockLimit(item)
			const next = item.quantity + delta
			if (next < 1) {
				uni.showToast({ title: '数量不能再少了，可删除该商品', icon: 'none' })
				return
			}
			if (limit === 0) {
				uni.showToast({ title: '该规格已售罄', icon: 'none' })
				return
			}
			if (next > limit) {
				uni.showToast({ title: `库存仅剩 ${limit} 件`, icon: 'none' })
				return
			}

			const prev = item.quantity
			// 先本地回显，手感是即时的；失败再回滚
			item.quantity = next
			this.busyIds.push(item.id)
			try {
				await useCartStore().updateQuantity({ cartId: item.id, quantity: next })
			} catch (err) {
				item.quantity = prev
				uni.showToast({ title: (err && err.message) || '修改数量失败', icon: 'none' })
			} finally {
				this.busyIds = this.busyIds.filter((id) => id !== item.id)
			}
		},
		removeOne(item) {
			uni.showModal({
				title: '提示',
				content: `确定从购物车移除「${item.productName}」吗？`,
				success: async (res) => {
					if (!res.confirm || this.removing) return
					this.removing = true
					try {
						// store 的 action 里已经刷过一次列表了，这里只同步勾选状态，
						// 不能再调 refresh()，否则每次删除都白跑一次 /api/cart/list
						await useCartStore().remove({ ids: [item.id] })
						this.pruneSelection()
						uni.showToast({ title: '已移除', icon: 'none' })
					} catch (err) {
						uni.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
					} finally {
						this.removing = false
					}
				},
			})
		},
		clearAll() {
			uni.showModal({
				title: '提示',
				content: '确定清空购物车吗？',
				success: async (res) => {
					if (!res.confirm || this.clearing) return
					this.clearing = true
					try {
						// 同上，store 内部已经刷新过，这里只清本地勾选
						await useCartStore().clear()
						this.checkedIds = []
						uni.showToast({ title: '已清空', icon: 'none' })
					} catch (err) {
						uni.showToast({ title: (err && err.message) || '清空失败', icon: 'none' })
					} finally {
						this.clearing = false
					}
				},
			})
		},
		goCheckout() {
			if (!this.checkedQuantity) {
				uni.showToast({ title: '请先选择商品', icon: 'none' })
				return
			}
			// 确认订单页自己去拉购物车、按这些行 id 挑商品，
			// 不把商品数据塞进 URL（太长，而且可能已经过期）
			const ids = this.checkedItems.map((item) => item.id).join(',')
			uni.navigateTo({ url: `/pages/order/confirm?cartIds=${ids}` })
		},
		goShopping() {
			uni.reLaunch({ url: '/pages/index/index' })
		},
		imageFor(item) {
			/*
			 * CartItem 的图片字段是 productImage（不是 image），
			 * 所以这里直接用 resolveImage，不走 resolveProductImage。
			 * key 传 productId 而不是 item.id：item.id 是购物车行 id，
			 * 拿它算占位图会让同一个商品在购物车和首页显示不同的图。
			 */
			return resolveImage(item.productImage, item.productId, this.failedImageIds)
		},
		onImageError(item) {
			if (this.failedImageIds.indexOf(item.productId) === -1) {
				this.failedImageIds.push(item.productId)
			}
		},
	},
}
</script>

<style>
page {
	background-color: #f5f5f5;
}
</style>

<style scoped>
/* 主题色板与全局一致：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 / 次要 #999999 */

.clear {
	padding: 10rpx 0 10rpx 20rpx;
	font-size: 26rpx;
	color: #999999;
}

.status {
	padding: 160rpx 0;
	text-align: center;
}

.status__text {
	display: block;
	font-size: 28rpx;
	color: #999999;
}

.status__btn {
	display: inline-block;
	margin-top: 32rpx;
	padding: 0 48rpx;
	height: 68rpx;
	border-radius: 34rpx;
	border: 2rpx solid #ff6b35;
}

.status__btn-text {
	font-size: 28rpx;
	line-height: 64rpx;
	color: #ff6b35;
}

/* ---------- 列表 ---------- */
.list {
	padding: 20rpx 24rpx 0;
}

.row {
	position: relative;
	display: flex;
	align-items: center;
	margin-bottom: 20rpx;
	padding: 24rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

/* ---------- 勾选框（后端存不下来，纯前端状态） ---------- */
.row__check {
	width: 40rpx;
	height: 40rpx;
	flex-shrink: 0;
	box-sizing: border-box;
	border: 2rpx solid #cccccc;
	border-radius: 50%;
	background-color: #ffffff;
	display: flex;
	align-items: center;
	justify-content: center;
}

.row__check--on {
	border-color: #ff6b35;
	background-color: #ff6b35;
}

.row__check-tick {
	width: 10rpx;
	height: 18rpx;
	margin-top: -4rpx;
	box-sizing: border-box;
	border-right: 4rpx solid #ffffff;
	border-bottom: 4rpx solid #ffffff;
	transform: rotate(45deg);
	opacity: 0;
}

.row__check--on .row__check-tick {
	opacity: 1;
}

/* ---------- 单行 ---------- */
.row__img {
	width: 160rpx;
	height: 160rpx;
	flex-shrink: 0;
	margin-left: 20rpx;
	border-radius: 16rpx;
	background-color: #f5f5f5;
}

.row__body {
	flex: 1;
	margin-left: 20rpx;
	overflow: hidden;
}

.row__name {
	font-size: 28rpx;
	line-height: 38rpx;
	color: #333333;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	/* 给右上角的「删除」让位 */
	padding-right: 72rpx;
}

.row__spec {
	display: inline-block;
	margin-top: 8rpx;
	padding: 0 12rpx;
	height: 36rpx;
	border-radius: 18rpx;
	background-color: #f5f5f5;
	font-size: 22rpx;
	line-height: 36rpx;
	color: #999999;
}

.row__foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 14rpx;
}

.row__price {
	font-size: 32rpx;
	font-weight: bold;
	color: #ff6b35;
}

.row__symbol {
	font-size: 24rpx;
}

.row__warn {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #ff6b35;
}

.row__remove {
	position: absolute;
	right: 24rpx;
	top: 24rpx;
	padding: 4rpx 0 4rpx 20rpx;
	font-size: 24rpx;
	color: #999999;
}

/* ---------- 数量步进器 ---------- */
.stepper {
	display: flex;
	align-items: center;
}

.stepper__btn {
	width: 48rpx;
	height: 48rpx;
	border-radius: 10rpx;
	background-color: #f5f5f5;
	display: flex;
	align-items: center;
	justify-content: center;
}

.stepper__btn--off {
	opacity: 0.5;
}

/* 只降透明度不够：底色本来就是 #f5f5f5，浅灰符号压上去看不出来。
   这里直接把符号本身调成浅灰，和可用态的 #333 拉开差距。 */
.stepper__btn--off .stepper__sign {
	color: #cccccc;
}

.stepper__sign {
	font-size: 28rpx;
	line-height: 28rpx;
	color: #333333;
}

.stepper__num {
	min-width: 64rpx;
	text-align: center;
	font-size: 28rpx;
	color: #333333;
}

/* ---------- 底部结算栏 ---------- */
.actionbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	padding: 16rpx 24rpx;
	background-color: #ffffff;
	box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
	padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
	padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.actionbar__all {
	display: flex;
	align-items: center;
	flex-shrink: 0;
	margin-right: 20rpx;
}

.actionbar__all-text {
	margin-left: 12rpx;
	font-size: 26rpx;
	color: #333333;
}

.actionbar__total {
	flex: 1;
	display: flex;
	align-items: baseline;
	justify-content: flex-end;
	margin-right: 20rpx;
	overflow: hidden;
}

.actionbar__total-label {
	font-size: 26rpx;
	color: #333333;
}

.actionbar__total-price {
	margin-left: 8rpx;
	font-size: 34rpx;
	font-weight: bold;
	color: #ff6b35;
}

.actionbar__total-symbol {
	font-size: 24rpx;
}

.actionbar__btn {
	flex-shrink: 0;
	padding: 0 44rpx;
	height: 84rpx;
	border-radius: 42rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 8rpx 20rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.actionbar__btn--off {
	background-image: none;
	background-color: #cccccc;
	box-shadow: none;
}

.actionbar__btn-text {
	font-size: 30rpx;
	font-weight: bold;
	color: #ffffff;
}

.actionbar-spacer {
	height: 140rpx;
}
</style>
