<template>
	<view v-if="visible" class="sheet-mask" @click="onMaskTap">
		<view class="sheet" @click.stop>
			<view class="sheet__header">
				<text class="sheet__title">选择规格</text>
				<view class="sheet__close" @click="onMaskTap">
					<view class="sheet__close-line sheet__close-line--a"></view>
					<view class="sheet__close-line sheet__close-line--b"></view>
				</view>
			</view>

			<view v-if="loading" class="sheet__status">
				<text class="sheet__status-text">加载中…</text>
			</view>

			<view v-else-if="!detail" class="sheet__status">
				<text class="sheet__status-text">商品信息加载失败</text>
			</view>

			<block v-else>
				<view class="sku">
					<image
						class="sku__img"
						:src="coverSrc"
						mode="aspectFill"
						@error="onImageError"
					/>
					<view class="sku__info">
						<text class="sku__price">
							<text class="sku__symbol">¥</text>{{ formatPrice(currentPrice) }}
						</text>
						<text class="sku__stock">
							{{ activeSpec ? `库存 ${currentStock} 件` : '请选择规格' }}
						</text>
						<text class="sku__name">{{ detail.name }}</text>
					</view>
				</view>

				<view class="block">
					<text class="block__title">规格</text>
					<view v-if="specs.length" class="chips">
						<view
							v-for="item in specs"
							:key="item.id"
							class="chip"
							:class="{
								'chip--active': activeSpec && activeSpec.id === item.id,
								'chip--disabled': isSoldOut(item),
							}"
							@click="selectSpec(item)"
						>
							<text class="chip__text">{{ item.specText || '默认' }}</text>
						</view>
					</view>
					<text v-else class="block__empty">
						该商品暂无可选规格，无法加入购物车
					</text>
				</view>

				<view class="block block--row">
					<text class="block__title block__title--inline">数量</text>
					<view class="stepper">
						<view
							class="stepper__btn"
							:class="{ 'stepper__btn--off': quantity <= 1 }"
							@click="dec"
						>
							<text class="stepper__sign">−</text>
						</view>
						<text class="stepper__num">{{ quantity }}</text>
						<view
							class="stepper__btn"
							:class="{ 'stepper__btn--off': quantity >= maxQuantity }"
							@click="inc"
						>
							<text class="stepper__sign">+</text>
						</view>
					</view>
				</view>
			</block>

			<view class="sheet__footer">
				<view class="confirm" :class="{ 'confirm--off': !canSubmit }" @click="confirm">
					<text class="confirm__text">{{ submitting ? '加入中…' : '加入购物车' }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { productApi } from '@/utils/api'
import { useUserStore } from '@/store/modules/user'
import { useCartStore } from '@/store/modules/cart'
import { resolveImage, formatPrice } from '@/utils/productImage'

/**
 * 列表页的「加入购物车」规格半屏。
 *
 * 为什么必须有这个组件：后端 /api/cart/add 事实必填 specId
 * （specId 为 null 时 checkProductStatus 的 INNER JOIN 恒不成立，
 * 返回「数据异常，请重试」），而列表接口只给商品、不给规格。
 * 所以只能点加购时现拉一次详情拿 specList。
 */
export default {
	name: 'SpecSheet',
	props: {
		productId: {
			type: [String, Number],
			default: '',
		},
		visible: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['close', 'added'],
	data() {
		return {
			detail: null,
			loading: false,
			// 不预选规格：既然选了「弹规格让用户挑」，就不该替他决定
			activeSpec: null,
			quantity: 1,
			submitting: false,
			failedImageKeys: [],
		}
	},
	computed: {
		specs() {
			return (this.detail && this.detail.specList) || []
		},
		coverSrc() {
			if (!this.detail) return ''
			const list = (this.detail.imageUrls || []).filter((item) => item && item.imageUrl)
			const raw = list.length ? list[0].imageUrl : this.detail.image
			return resolveImage(raw, `${this.detail.id}-cover`, this.failedImageKeys)
		},
		currentPrice() {
			if (this.activeSpec) return this.activeSpec.price
			return this.detail ? this.detail.price : 0
		},
		currentStock() {
			return this.activeSpec ? Math.max(0, Number(this.activeSpec.stock) || 0) : 0
		},
		/** 步进器上限。没选规格时锁在 1，避免出现「没选规格却能调数量」的怪状态 */
		maxQuantity() {
			if (!this.activeSpec) return 1
			return Math.max(1, this.currentStock)
		},
		canSubmit() {
			return (
				!this.loading &&
				!this.submitting &&
				!!this.activeSpec &&
				this.currentStock > 0
			)
		},
	},
	watch: {
		visible(value) {
			if (value) this.open()
		},
	},
	methods: {
		formatPrice,
		async open() {
			// 每次打开都重置，不要把上一次的规格和数量带过来
			this.detail = null
			this.activeSpec = null
			this.quantity = 1
			this.submitting = false
			this.failedImageKeys = []

			if (!this.productId) return
			this.loading = true
			try {
				const data = await productApi.getDetail({
					productId: this.productId,
					isLogin: useUserStore().isLogin,
				})
				this.detail = data || null
			} catch (err) {
				this.detail = null
				uni.showToast({ title: (err && err.message) || '商品信息加载失败', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		isSoldOut(item) {
			return Number(item && item.stock) <= 0
		},
		selectSpec(item) {
			if (this.submitting) return
			if (this.isSoldOut(item)) {
				uni.showToast({ title: '该规格已售罄', icon: 'none' })
				return
			}
			this.activeSpec = item
			// 换规格后数量可能超出新规格库存，收一下
			this.quantity = Math.min(this.quantity, this.maxQuantity)
		},
		dec() {
			if (this.quantity <= 1) {
				uni.showToast({ title: '数量不能再少了', icon: 'none' })
				return
			}
			this.quantity -= 1
		},
		inc() {
			if (this.quantity >= this.maxQuantity) {
				uni.showToast({ title: '已达库存上限', icon: 'none' })
				return
			}
			this.quantity += 1
		},
		onMaskTap() {
			if (this.submitting) return
			this.$emit('close')
		},
		onImageError() {
			const key = `${this.detail && this.detail.id}-cover`
			if (this.failedImageKeys.indexOf(key) === -1) this.failedImageKeys.push(key)
		},
		async confirm() {
			if (!this.canSubmit) {
				if (!this.activeSpec && this.specs.length) {
					uni.showToast({ title: '请先选择规格', icon: 'none' })
				}
				return
			}
			this.submitting = true
			try {
				await useCartStore().add({
					productId: this.detail.id,
					specId: this.activeSpec.id,
					quantity: this.quantity,
				})
				uni.showToast({ title: '已加入购物车', icon: 'none' })
				this.$emit('added')
				this.$emit('close')
			} catch (err) {
				uni.showToast({ title: (err && err.message) || '加入购物车失败', icon: 'none' })
			} finally {
				this.submitting = false
			}
		},
	},
}
</script>

<style scoped>
/* 主题色板与全局一致：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 / 次要 #999999 */

.sheet-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 200;
	background-color: rgba(0, 0, 0, 0.4);
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
}

.sheet {
	width: 100%;
	background-color: #ffffff;
	border-radius: 24rpx 24rpx 0 0;
	overflow: hidden;
	padding-bottom: constant(safe-area-inset-bottom);
	padding-bottom: env(safe-area-inset-bottom);
}

.sheet__header {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 96rpx;
	border-bottom: 2rpx solid #f0f0f0;
}

.sheet__title {
	font-size: 32rpx;
	font-weight: bold;
	color: #333333;
}

.sheet__close {
	position: absolute;
	right: 12rpx;
	top: 0;
	width: 80rpx;
	height: 96rpx;
}

.sheet__close-line {
	position: absolute;
	left: 28rpx;
	top: 47rpx;
	width: 26rpx;
	height: 3rpx;
	border-radius: 2rpx;
	background-color: #999999;
}

.sheet__close-line--a {
	transform: rotate(45deg);
}

.sheet__close-line--b {
	transform: rotate(-45deg);
}

.sheet__status {
	padding: 120rpx 0;
	text-align: center;
}

.sheet__status-text {
	font-size: 28rpx;
	color: #999999;
}

/* ---------- 商品摘要 ---------- */
.sku {
	display: flex;
	padding: 28rpx 24rpx;
}

.sku__img {
	width: 180rpx;
	height: 180rpx;
	flex-shrink: 0;
	border-radius: 16rpx;
	background-color: #f5f5f5;
}

.sku__info {
	flex: 1;
	margin-left: 20rpx;
	display: flex;
	flex-direction: column;
	justify-content: center;
	overflow: hidden;
}

.sku__price {
	font-size: 40rpx;
	font-weight: bold;
	color: #ff6b35;
}

.sku__symbol {
	font-size: 26rpx;
}

.sku__stock {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: #999999;
}

.sku__name {
	margin-top: 12rpx;
	font-size: 26rpx;
	line-height: 36rpx;
	color: #333333;
	/* 最多两行，超出省略 */
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

/* ---------- 规格 / 数量 ---------- */
.block {
	padding: 8rpx 24rpx 24rpx;
}

.block--row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.block__title {
	display: block;
	margin-bottom: 20rpx;
	font-size: 28rpx;
	font-weight: bold;
	color: #333333;
}

.block__title--inline {
	margin-bottom: 0;
}

.block__empty {
	font-size: 26rpx;
	color: #999999;
}

.chips {
	display: flex;
	flex-wrap: wrap;
}

.chip {
	margin: 0 16rpx 16rpx 0;
	padding: 0 28rpx;
	height: 64rpx;
	border-radius: 32rpx;
	background-color: #f5f5f5;
	display: flex;
	align-items: center;
}

.chip__text {
	font-size: 26rpx;
	color: #333333;
}

.chip--active {
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 4rpx 12rpx rgba(255, 107, 53, 0.28);
}

.chip--active .chip__text {
	color: #ffffff;
	font-weight: bold;
}

/* 售罄：置灰 + 划线，点了也只会提示，不会选中 */
.chip--disabled {
	opacity: 0.45;
}

.chip--disabled .chip__text {
	text-decoration: line-through;
	color: #999999;
}

/* ---------- 数量步进器 ---------- */
.stepper {
	display: flex;
	align-items: center;
}

.stepper__btn {
	width: 56rpx;
	height: 56rpx;
	border-radius: 12rpx;
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
	font-size: 32rpx;
	line-height: 32rpx;
	color: #333333;
}

.stepper__num {
	min-width: 72rpx;
	text-align: center;
	font-size: 30rpx;
	color: #333333;
}

/* ---------- 底部确定 ---------- */
.sheet__footer {
	padding: 16rpx 24rpx 24rpx;
}

.confirm {
	height: 84rpx;
	border-radius: 42rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 8rpx 20rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.confirm--off {
	background-image: none;
	background-color: #cccccc;
	box-shadow: none;
}

.confirm__text {
	font-size: 32rpx;
	font-weight: bold;
	color: #ffffff;
}
</style>
