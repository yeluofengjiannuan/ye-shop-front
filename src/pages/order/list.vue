<template>
	<view class="page">
		<PageHeader title="我的订单" />

		<!-- 5 个 tab，key 直接就是后端要的 pageName -->
		<scroll-view class="tabs" scroll-x :scroll-into-view="activeDomId">
			<view class="tabs__inner">
				<view
					v-for="tab in pages"
					:key="tab.key"
					:id="'tab-' + tab.key"
					class="tab"
					:class="{ 'tab--active': tab.key === pageName }"
					@click="switchTab(tab.key)"
				>
					<text class="tab__text">{{ tab.name }}</text>
				</view>
			</view>
		</scroll-view>

		<view v-if="loading" class="status">
			<text class="status__text">加载中…</text>
		</view>

		<view v-else-if="failed" class="status">
			<text class="status__text">订单加载失败</text>
			<view class="status__btn" @click="loadList">
				<text class="status__btn-text">重新加载</text>
			</view>
		</view>

		<view v-else-if="!orders.length" class="status">
			<text class="status__text">这里还没有订单</text>
			<view class="status__btn" @click="goShopping">
				<text class="status__btn-text">去逛逛</text>
			</view>
		</view>

		<view v-else class="list">
			<view class="order" v-for="order in orders" :key="order.orderNo" @click="goDetail(order)">
				<view class="order__head">
					<text class="order__no">{{ order.orderNo }}</text>
					<text class="order__status">{{ order.statusText }}</text>
				</view>

				<!--
					后端 /api/order/page/list 目前不返回 orderItems（buildResult 没联查 order_item），
					所以这里是有就渲染、没有就不显示这块，不做假的占位。
					详情接口是完整的，点进去能看到商品。
				-->
				<view v-if="order.orderItems.length" class="order__goods">
					<view class="goods" v-for="(item, index) in order.orderItems" :key="index">
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

				<view class="order__foot">
					<text class="order__time">{{ order.createTime }}</text>
					<view class="order__sum">
						<text class="order__sum-label">实付</text>
						<text class="order__sum-price">¥{{ formatPrice(order.totalAmount) }}</text>
					</view>
				</view>

				<view v-if="order.canCancel || order.canPay" class="order__actions">
					<view
						v-if="order.canCancel"
						class="btn btn--ghost"
						@click.stop="onCancel(order)"
					>
						<text class="btn__text btn__text--ghost">取消订单</text>
					</view>
					<view v-if="order.canPay" class="btn" @click.stop="onPay(order)">
						<text class="btn__text">模拟支付</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { orderApi } from '@/utils/api'
import { resolveImage, formatPrice } from '@/utils/productImage'
import { ORDER_PAGES, normalizeOrder } from '@/utils/order'

export default {
	components: { PageHeader },
	data() {
		return {
			pages: ORDER_PAGES,
			pageName: ORDER_PAGES[0].key,
			orders: [],
			loading: true,
			failed: false,
			busy: false,
			failedImageIds: [],
			// onLoad 已经拉过一次了，onShow 首次不要再拉
			inited: false,
		}
	},
	computed: {
		activeDomId() {
			return 'tab-' + this.pageName
		},
	},
	onLoad(options) {
		// 支持从别处指定落哪个 tab
		const wanted = options && options.pageName
		if (wanted && ORDER_PAGES.some((p) => p.key === wanted)) this.pageName = wanted
		this.loadList()
	},
	onShow() {
		// 从详情页返回时把状态刷一下（可能刚支付或取消了）
		if (this.inited) this.loadList()
		this.inited = true
	},
	methods: {
		formatPrice,
		async loadList() {
			this.loading = true
			this.failed = false
			try {
				// pageName 只能传枚举里的值，传错后端直接 500
				const data = await orderApi.getListByPage({ pageName: this.pageName })
				this.orders = data.map(normalizeOrder)
			} catch (err) {
				this.orders = []
				this.failed = true
				uni.showToast({ title: (err && err.message) || '订单加载失败', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		switchTab(key) {
			if (this.pageName === key) return
			this.pageName = key
			this.loadList()
		},
		goDetail(order) {
			uni.navigateTo({ url: `/pages/order/detail?orderNo=${order.orderNo}` })
		},
		goShopping() {
			uni.reLaunch({ url: '/pages/index/index' })
		},
		onCancel(order) {
			if (this.busy) return
			uni.showModal({
				title: '取消订单',
				content: '确定取消这笔订单吗？商品库存会退回。',
				success: async (res) => {
					if (!res.confirm) return
					this.busy = true
					try {
						await orderApi.cancel({
							orderNo: order.orderNo,
							cancelReason: '用户主动取消',
						})
						uni.showToast({ title: '订单已取消', icon: 'none' })
						await this.loadList()
					} catch (err) {
						uni.showToast({ title: (err && err.message) || '取消失败', icon: 'none' })
					} finally {
						this.busy = false
					}
				},
			})
		},
		onPay(order) {
			if (this.busy) return
			uni.showModal({
				title: '模拟支付',
				content: '这是演示用的模拟支付，不会产生真实扣款。确定继续吗？',
				success: async (res) => {
					if (!res.confirm) return
					this.busy = true
					try {
						await orderApi.paySuccess({ orderNo: order.orderNo })
						uni.showToast({ title: '支付成功', icon: 'none' })
						await this.loadList()
					} catch (err) {
						uni.showToast({ title: (err && err.message) || '支付失败', icon: 'none' })
					} finally {
						this.busy = false
					}
				},
			})
		},
		imageFor(item) {
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

.tabs {
	width: 100%;
	white-space: nowrap;
	background-color: #ffffff;
	border-bottom: 2rpx solid #f0f0f0;
}

.tabs__inner {
	display: inline-flex;
	height: 88rpx;
	padding: 0 12rpx;
}

.tab {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0 28rpx;
}

.tab__text {
	font-size: 28rpx;
	color: #666666;
}

.tab--active .tab__text {
	color: #ff6b35;
	font-weight: bold;
}

.tab--active::after {
	content: '';
	position: absolute;
	left: 50%;
	bottom: 0;
	width: 48rpx;
	height: 6rpx;
	margin-left: -24rpx;
	border-radius: 3rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
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

/* ---------- 订单卡片 ---------- */
.list {
	padding: 20rpx 24rpx 0;
}

.order {
	margin-bottom: 20rpx;
	padding: 24rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.order__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: 16rpx;
	border-bottom: 2rpx solid #f0f0f0;
}

.order__no {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 24rpx;
	color: #999999;
}

.order__status {
	flex-shrink: 0;
	margin-left: 16rpx;
	font-size: 26rpx;
	font-weight: bold;
	color: #ff6b35;
}

.order__goods {
	padding-top: 8rpx;
}

.goods {
	display: flex;
	align-items: center;
	padding: 16rpx 0;
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

.order__foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 8rpx;
	padding-top: 16rpx;
	border-top: 2rpx solid #f0f0f0;
}

.order__time {
	font-size: 22rpx;
	color: #999999;
}

.order__sum {
	display: flex;
	align-items: baseline;
}

.order__sum-label {
	font-size: 24rpx;
	color: #333333;
}

.order__sum-price {
	margin-left: 8rpx;
	font-size: 32rpx;
	font-weight: bold;
	color: #ff6b35;
}

/* ---------- 卡片内操作按钮 ---------- */
.order__actions {
	display: flex;
	justify-content: flex-end;
	margin-top: 20rpx;
}

.btn {
	margin-left: 16rpx;
	padding: 0 32rpx;
	height: 64rpx;
	border-radius: 32rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}

.btn--ghost {
	background-image: none;
	background-color: #ffffff;
	border: 2rpx solid #dddddd;
}

.btn__text {
	font-size: 26rpx;
	font-weight: bold;
	color: #ffffff;
}

.btn__text--ghost {
	color: #666666;
	font-weight: normal;
}
</style>
