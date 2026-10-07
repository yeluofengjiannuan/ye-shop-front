<template>
	<view class="page">
		<PageHeader title="订单详情" />

		<view v-if="loading" class="status">
			<text class="status__text">加载中…</text>
		</view>

		<view v-else-if="failed || !order" class="status">
			<text class="status__text">订单加载失败</text>
			<view class="status__btn" @click="loadDetail">
				<text class="status__btn-text">重新加载</text>
			</view>
		</view>

		<block v-else>
			<!-- 状态 -->
			<view class="hero">
				<text class="hero__status">{{ order.statusText }}</text>
				<text v-if="order.payTypeText" class="hero__sub">
					{{ order.payTypeText }}<text v-if="order.payTime"> · {{ order.payTime }}</text>
				</text>
			</view>

			<!-- 收货地址 -->
			<view v-if="order.address" class="card">
				<view class="addr">
					<view class="addr__top">
						<text class="addr__receiver">{{ order.address.receiver }}</text>
						<text class="addr__phone">{{ order.address.phone }}</text>
					</view>
					<text class="addr__detail">{{ addressText }}</text>
				</view>
			</view>

			<!-- 商品 -->
			<view class="card">
				<text class="card__title">商品清单</text>
				<view v-if="order.orderItems.length" class="goods">
					<view class="goods__row" v-for="(item, index) in order.orderItems" :key="index">
						<image
							class="goods__img"
							:src="imageFor(item)"
							mode="aspectFill"
							@error="onImageError(item)"
						/>
						<view class="goods__body">
							<text class="goods__name">{{ item.productName }}</text>
							<text v-if="item.specText" class="goods__spec">{{ item.specText }}</text>
						</view>
						<view class="goods__right">
							<text class="goods__price">¥{{ formatPrice(item.price) }}</text>
							<text class="goods__qty">×{{ item.quantity }}</text>
						</view>
					</view>
				</view>
				<text v-else class="card__empty">商品信息缺失</text>
			</view>

			<!-- 金额 -->
			<view class="card">
				<text class="card__title">金额明细</text>
				<view class="row">
					<text class="row__label">商品金额</text>
					<text class="row__value">¥{{ formatPrice(order.totalGoodsAmount) }}</text>
				</view>
				<view class="row">
					<text class="row__label">运费</text>
					<text class="row__value">¥{{ formatPrice(order.freight) }}</text>
				</view>
				<view class="row row--total">
					<text class="row__label">实付款</text>
					<text class="row__total">¥{{ formatPrice(order.totalAmount) }}</text>
				</view>
			</view>

			<!-- 订单信息 -->
			<view class="card">
				<text class="card__title">订单信息</text>
				<view class="row">
					<text class="row__label">订单号</text>
					<view class="row__right">
						<text class="row__value">{{ order.orderNo }}</text>
						<text class="row__copy" @click="copyOrderNo">复制</text>
					</view>
				</view>
				<view class="row">
					<text class="row__label">下单时间</text>
					<text class="row__value">{{ order.createTime || '—' }}</text>
				</view>
				<view v-if="order.payTime" class="row">
					<text class="row__label">支付时间</text>
					<text class="row__value">{{ order.payTime }}</text>
				</view>
				<view class="row">
					<text class="row__label">备注</text>
					<text class="row__value">{{ order.remark || '—' }}</text>
				</view>
			</view>
		</block>

		<!-- 底部操作栏：只有待支付才有动作 -->
		<view v-if="order && (order.canCancel || order.canPay)" class="actionbar">
			<view
				v-if="order.canCancel"
				class="actionbar__ghost"
				:class="{ 'actionbar__ghost--busy': busy }"
				@click="onCancel"
			>
				<text class="actionbar__ghost-text">取消订单</text>
			</view>
			<view
				v-if="order.canPay"
				class="actionbar__btn"
				:class="{ 'actionbar__btn--busy': busy }"
				@click="onPay"
			>
				<text class="actionbar__btn-text">{{ busy ? '处理中…' : '模拟支付' }}</text>
			</view>
		</view>
		<view v-if="order && (order.canCancel || order.canPay)" class="actionbar-spacer"></view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { orderApi } from '@/utils/api'
import { resolveImage, formatPrice } from '@/utils/productImage'
import { normalizeOrder } from '@/utils/order'

export default {
	components: { PageHeader },
	data() {
		return {
			orderNo: '',
			order: null,
			loading: true,
			failed: false,
			busy: false,
			failedImageIds: [],
		}
	},
	computed: {
		addressText() {
			const a = this.order && this.order.address
			if (!a) return ''
			return [a.province, a.city, a.district, a.detailAddress].filter(Boolean).join('')
		},
	},
	onLoad(options) {
		this.orderNo = (options && options.orderNo) || ''
		this.loadDetail()
	},
	methods: {
		formatPrice,
		async loadDetail() {
			if (!this.orderNo) {
				this.loading = false
				this.failed = true
				return
			}
			this.loading = true
			this.failed = false
			try {
				this.order = normalizeOrder(await orderApi.getDetail({ orderNo: this.orderNo }))
			} catch (err) {
				this.order = null
				this.failed = true
				uni.showToast({ title: (err && err.message) || '订单加载失败', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		copyOrderNo() {
			uni.setClipboardData({
				data: this.orderNo,
				success: () => uni.showToast({ title: '订单号已复制', icon: 'none' }),
			})
		},
		onCancel() {
			if (this.busy) return
			uni.showModal({
				title: '取消订单',
				content: '确定取消这笔订单吗？商品库存会退回。',
				success: async (res) => {
					if (!res.confirm) return
					this.busy = true
					try {
						await orderApi.cancel({ orderNo: this.orderNo, cancelReason: '用户主动取消' })
						uni.showToast({ title: '订单已取消', icon: 'none' })
						await this.loadDetail()
					} catch (err) {
						uni.showToast({ title: (err && err.message) || '取消失败', icon: 'none' })
					} finally {
						this.busy = false
					}
				},
			})
		},
		onPay() {
			if (this.busy) return
			uni.showModal({
				title: '模拟支付',
				// 明确说清楚这不是真支付，别让按钮看起来像接了微信支付
				content: '这是演示用的模拟支付，不会产生真实扣款。确定继续吗？',
				success: async (res) => {
					if (!res.confirm) return
					this.busy = true
					try {
						await orderApi.paySuccess({ orderNo: this.orderNo })
						uni.showToast({ title: '支付成功', icon: 'none' })
						await this.loadDetail()
					} catch (err) {
						uni.showToast({ title: (err && err.message) || '支付失败', icon: 'none' })
					} finally {
						this.busy = false
					}
				},
			})
		},
		imageFor(item) {
			// key 用 productId 而不是订单项下标，理由和购物车一致：
			// 同一个商品在列表和详情要落到同一张占位图
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

/* ---------- 状态 ---------- */
.hero {
	padding: 48rpx 24rpx 40rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
}

.hero__status {
	display: block;
	font-size: 40rpx;
	font-weight: bold;
	color: #ffffff;
}

.hero__sub {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.85);
}

/* ---------- 通用卡片 ---------- */
.card {
	margin: 20rpx 24rpx 0;
	padding: 28rpx 24rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.card__title {
	display: block;
	margin-bottom: 20rpx;
	font-size: 28rpx;
	font-weight: bold;
	color: #333333;
}

.card__empty {
	font-size: 26rpx;
	color: #999999;
}

/* ---------- 地址 ---------- */
.addr__top {
	display: flex;
	align-items: center;
}

.addr__receiver {
	font-size: 30rpx;
	font-weight: bold;
	color: #333333;
}

.addr__phone {
	margin-left: 16rpx;
	font-size: 26rpx;
	color: #666666;
}

.addr__detail {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	line-height: 38rpx;
	color: #666666;
}

/* ---------- 商品 ---------- */
.goods__row {
	display: flex;
	align-items: center;
	padding: 16rpx 0;
	border-bottom: 2rpx solid #f0f0f0;
}

.goods__row:last-child {
	border-bottom: none;
	padding-bottom: 0;
}

.goods__img {
	width: 120rpx;
	height: 120rpx;
	flex-shrink: 0;
	border-radius: 12rpx;
	background-color: #f5f5f5;
}

.goods__body {
	flex: 1;
	margin-left: 20rpx;
	overflow: hidden;
}

.goods__name {
	font-size: 28rpx;
	line-height: 38rpx;
	color: #333333;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.goods__spec {
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

.goods__right {
	flex-shrink: 0;
	margin-left: 16rpx;
	text-align: right;
}

.goods__price {
	display: block;
	font-size: 28rpx;
	color: #333333;
}

.goods__qty {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #999999;
}

/* ---------- 信息行 ---------- */
.row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14rpx 0;
}

.row__label {
	flex-shrink: 0;
	font-size: 26rpx;
	color: #999999;
}

.row__right {
	display: flex;
	align-items: center;
	overflow: hidden;
}

.row__value {
	font-size: 26rpx;
	color: #333333;
	text-align: right;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.row__copy {
	flex-shrink: 0;
	margin-left: 16rpx;
	padding: 2rpx 16rpx;
	border: 2rpx solid #dddddd;
	border-radius: 20rpx;
	font-size: 22rpx;
	color: #666666;
}

.row--total {
	margin-top: 8rpx;
	padding-top: 20rpx;
	border-top: 2rpx solid #f0f0f0;
}

.row__total {
	font-size: 34rpx;
	font-weight: bold;
	color: #ff6b35;
}

/* ---------- 底部操作栏 ---------- */
.actionbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding: 16rpx 24rpx;
	background-color: #ffffff;
	box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
	padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
	padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.actionbar__ghost {
	margin-right: 20rpx;
	padding: 0 40rpx;
	height: 84rpx;
	border-radius: 42rpx;
	border: 2rpx solid #dddddd;
	display: flex;
	align-items: center;
	justify-content: center;
}

.actionbar__ghost--busy {
	opacity: 0.6;
}

.actionbar__ghost-text {
	font-size: 28rpx;
	color: #666666;
}

.actionbar__btn {
	padding: 0 48rpx;
	height: 84rpx;
	border-radius: 42rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 8rpx 20rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.actionbar__btn--busy {
	opacity: 0.6;
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
