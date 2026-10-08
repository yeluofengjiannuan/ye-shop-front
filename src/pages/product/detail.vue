<template>
	<view class="page">
		<PageHeader title="商品详情" />

		<view v-if="loading" class="status">
			<text class="status__text">加载中…</text>
		</view>

		<view v-else-if="!detail" class="status">
			<text class="status__text">商品不存在或已下架</text>
		</view>

		<block v-else>
			<!-- 图片轮播 -->
			<swiper
				class="gallery"
				:autoplay="hasMultipleImages"
				:interval="3000"
				:duration="500"
				:circular="hasMultipleImages"
				:indicator-dots="hasMultipleImages"
				indicator-color="rgba(255, 255, 255, 0.45)"
				indicator-active-color="#ffffff"
			>
				<swiper-item v-for="(item, index) in gallery" :key="index">
					<image
						class="gallery__img"
						:src="item.src"
						mode="aspectFill"
						@error="onImageError(item.key)"
					/>
				</swiper-item>
			</swiper>

			<!-- 价格与名称 -->
			<view class="card info">
				<view class="info__price-row">
					<text class="info__price">
						<text class="info__symbol">¥</text>{{ formatPrice(currentPrice) }}
					</text>
					<text v-if="showEnterprisePrice" class="info__enterprise">
						企业价 ¥{{ formatPrice(detail.enterprisePrice) }}
					</text>
				</view>

				<text class="info__name">{{ detail.name }}</text>
				<text v-if="detail.sellPoint" class="info__sell">{{ detail.sellPoint }}</text>

				<view class="info__meta">
					<text class="info__meta-item">销量 {{ detail.salesCount || 0 }}</text>
					<text class="info__meta-item">库存 {{ currentStock }}</text>
					<text class="info__meta-item">浏览 {{ detail.viewCount || 0 }}</text>
				</view>
			</view>

			<!-- 规格 -->
			<view v-if="specs.length" class="card spec">
				<text class="card__title">选择规格</text>
				<view class="spec__list">
					<view
						v-for="item in specs"
						:key="item.id"
						class="spec__item"
						:class="{ 'spec__item--active': activeSpec && activeSpec.id === item.id }"
						@click="selectSpec(item)"
					>
						<text class="spec__item-text">{{ item.specText }}</text>
					</view>
				</view>
			</view>

			<!-- 图文详情 -->
			<view class="card desc">
				<text class="card__title">图文详情</text>
				<!-- 后端返回的是 HTML 片段，用 rich-text 渲染；为空时给个占位 -->
				<rich-text v-if="detail.description" class="desc__body" :nodes="detail.description" />
				<text v-else class="desc__empty">暂无详情</text>
			</view>
		</block>

		<!-- 底部操作栏 -->
		<view v-if="detail" class="actionbar">
			<view class="actionbar__collect" @click="toggleCollect">
				<text
					class="actionbar__collect-icon"
					:class="{ 'actionbar__collect-icon--on': collected }"
					>{{ collected ? '★' : '☆' }}</text
				>
				<text
					class="actionbar__collect-label"
					:class="{ 'actionbar__collect-label--on': collected }"
					>{{ collected ? '已收藏' : '收藏' }}</text
				>
			</view>
			<!-- 管理员自己就是客服，给他看这个入口只会点出一条"自己和自己"的会话 -->
			<view v-if="!isAdmin" class="actionbar__service" @click="onService">
				<view class="icon-service"></view>
				<text class="actionbar__service-label">客服</text>
			</view>
			<view class="actionbar__btn" @click="addToCart">
				<text class="actionbar__btn-text">加入购物车</text>
			</view>
		</view>
		<!-- 与固定底栏等高，避免内容被盖住 -->
		<view v-if="detail" class="actionbar-spacer"></view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { productApi, userApi } from '@/utils/api'
import { useUserStore } from '@/store/modules/user'
import { useCartStore } from '@/store/modules/cart'
import { resolveImage, formatPrice } from '@/utils/productImage'
import { SERVICE_ADMIN_ID } from '@/utils/chat'

export default {
	components: { PageHeader },
	data() {
		return {
			productId: '',
			detail: null,
			loading: true,
			activeSpec: null,
			failedImageKeys: [],
			// 是否已收藏，初值取自详情的 isCollection
			collected: false,
			// 防重复提交：后端对重复收藏同一商品会返回 500
			collecting: false,
			// 加购在途标记，避免连点发出多次请求
			adding: false,
		}
	},
	computed: {
		isAdmin() {
			return useUserStore().isAdmin
		},
		/** 轮播图：优先用 imageUrls，没有就退回单张 image */
		gallery() {
			if (!this.detail) return []
			const list = (this.detail.imageUrls || []).filter((item) => item && item.imageUrl)
			const raw = list.length ? list.map((item) => item.imageUrl) : [this.detail.image]
			return raw.map((url, index) => {
				// 用「商品 id + 下标」做失败记录的键，避免同商品多图互相干扰
				const key = `${this.detail.id}-${index}`
				return { key, src: resolveImage(url, key, this.failedImageKeys) }
			})
		},
		hasMultipleImages() {
			return this.gallery.length > 1
		},
		specs() {
			return (this.detail && this.detail.specList) || []
		},
		/** 选了规格就用规格价，否则用商品价 */
		currentPrice() {
			if (this.activeSpec) return this.activeSpec.price
			return this.detail ? this.detail.price : 0
		},
		currentStock() {
			if (this.activeSpec) return this.activeSpec.stock
			return this.detail ? this.detail.stock : 0
		},
		showEnterprisePrice() {
			if (!this.detail) return false
			const ent = Number(this.detail.enterprisePrice)
			return Number.isFinite(ent) && ent > 0 && ent !== Number(this.detail.price)
		},
	},
	onLoad(options) {
		this.productId = (options && options.productId) || ''
		this.loadDetail()
	},
	methods: {
		async loadDetail() {
			if (!this.productId) {
				this.loading = false
				return
			}
			this.loading = true
			try {
				const data = await productApi.getDetail({
					productId: this.productId,
					// isLogin 是必填参数，按真实登录态传
					isLogin: useUserStore().isLogin,
				})
				this.detail = data || null
				// isCollection 是后端给的已收藏标志：1 已收藏 / 0 未收藏
				this.collected = Number(this.detail && this.detail.isCollection) === 1
			} catch (err) {
				this.detail = null
				uni.showToast({ title: (err && err.message) || '商品详情加载失败', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		async toggleCollect() {
			if (!this.detail || this.collecting) return

			// 收藏接口要 token，未登录先去登录
			if (!useUserStore().isLogin) {
				uni.navigateTo({ url: '/pages/login/login' })
				return
			}

			this.collecting = true
			const next = !this.collected
			try {
				if (next) {
					await userApi.addCollect({ productId: this.detail.id })
				} else {
					await userApi.removeCollect({ productId: this.detail.id })
				}
				// 成功了才改状态。后端对重复收藏会 500，所以不做乐观更新
				this.collected = next
				uni.showToast({ title: next ? '已收藏' : '已取消收藏', icon: 'none' })
			} catch (err) {
				uni.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
			} finally {
				this.collecting = false
			}
		},
		selectSpec(item) {
			// 再点一次取消选择，回到商品默认价
			this.activeSpec = this.activeSpec && this.activeSpec.id === item.id ? null : item
		},
		formatPrice,
		onImageError(key) {
			if (this.failedImageKeys.indexOf(key) === -1) this.failedImageKeys.push(key)
		},
		onService() {
			/*
			 * 指向固定客服。
			 * 后端 product 表上没有任何 seller/owner 字段，也没有关联表，
			 * 所以"这个商品属于哪个卖家"在当前 schema 里查不到，只能都找同一个客服。
			 *
			 * 把 productId / productName 带过去：聊天页据此在输入框旁边给一个
			 * 「发送商品」按钮，点了才把商品作为卡片发给客服。
			 * 名称一起带过去，是为了发消息不依赖商品简介接口成不成功。
			 */
			const name = (this.detail && this.detail.name) || ''
			uni.navigateTo({
				url:
					`/pages/chat/room?contactId=${SERVICE_ADMIN_ID}` +
					`&name=${encodeURIComponent('客服')}` +
					`&productId=${this.productId}` +
					`&productName=${encodeURIComponent(name)}`,
			})
		},
		async addToCart() {
			if (!this.detail || this.adding) return

			/*
			 * 加购接口的 specId 是事实必填：后端 checkProductStatus 是
			 * product INNER JOIN product_spec ON ... AND s.id = #{specId}，
			 * 不传规格时 s.id = NULL 恒不成立，会返回「数据异常，请重试」。
			 * 所以没选规格就硬发请求是白跑，这里直接拦住。
			 */
			if (!this.activeSpec) {
				uni.showToast({
					title: this.specs.length ? '请先选择规格' : '该商品暂无可选规格',
					icon: 'none',
				})
				return
			}
			if (Number(this.activeSpec.stock) <= 0) {
				uni.showToast({ title: '该规格已售罄', icon: 'none' })
				return
			}

			this.adding = true
			try {
				await useCartStore().add({
					productId: this.detail.id,
					specId: this.activeSpec.id,
					quantity: 1,
				})
				uni.showToast({ title: '已加入购物车', icon: 'none' })
			} catch (err) {
				uni.showToast({ title: (err && err.message) || '加入购物车失败', icon: 'none' })
			} finally {
				this.adding = false
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
	font-size: 28rpx;
	color: #999999;
}

/* ---------- 图片轮播 ---------- */
.gallery {
	width: 100%;
	height: 750rpx;
	background-color: #ffffff;
}

.gallery__img {
	width: 100%;
	height: 750rpx;
	display: block;
	background-color: #f5f5f5;
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

/* ---------- 价格与名称 ---------- */
.info__price-row {
	display: flex;
	align-items: baseline;
}

.info__price {
	font-size: 48rpx;
	font-weight: bold;
	color: #ff6b35;
}

.info__symbol {
	font-size: 28rpx;
}

.info__enterprise {
	margin-left: 16rpx;
	font-size: 24rpx;
	color: #999999;
	text-decoration: line-through;
}

.info__name {
	display: block;
	margin-top: 16rpx;
	font-size: 32rpx;
	font-weight: bold;
	line-height: 44rpx;
	color: #333333;
}

.info__sell {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #999999;
}

.info__meta {
	display: flex;
	margin-top: 20rpx;
	padding-top: 20rpx;
	border-top: 2rpx solid #f0f0f0;
}

.info__meta-item {
	margin-right: 32rpx;
	font-size: 24rpx;
	color: #999999;
}

/* ---------- 规格 ---------- */
.spec__list {
	display: flex;
	flex-wrap: wrap;
}

.spec__item {
	margin: 0 16rpx 16rpx 0;
	padding: 0 28rpx;
	height: 64rpx;
	border-radius: 32rpx;
	background-color: #f5f5f5;
	display: flex;
	align-items: center;
}

.spec__item-text {
	font-size: 26rpx;
	color: #333333;
}

.spec__item--active {
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 4rpx 12rpx rgba(255, 107, 53, 0.28);
}

.spec__item--active .spec__item-text {
	color: #ffffff;
	font-weight: bold;
}

/* ---------- 图文详情 ---------- */
.desc__body {
	font-size: 28rpx;
	line-height: 44rpx;
	color: #333333;
}

.desc__empty {
	font-size: 26rpx;
	color: #999999;
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
	padding: 16rpx 24rpx;
	background-color: #ffffff;
	box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
	/* 让出 iPhone 底部安全区 */
	padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
	padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

/* 收藏：图标 + 文字竖排，未收藏空心灰、已收藏实心橙 */
.actionbar__collect {
	width: 120rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.actionbar__collect-icon {
	font-size: 40rpx;
	line-height: 44rpx;
	color: #999999;
}

.actionbar__collect-icon--on {
	color: #ff6b35;
}

.actionbar__collect-label {
	margin-top: 2rpx;
	font-size: 20rpx;
	line-height: 26rpx;
	color: #999999;
}

.actionbar__collect-label--on {
	color: #ff6b35;
}

/* 联系客服：图标 + 文字竖排，和收藏同一风格 */
.actionbar__service {
	width: 110rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

/* 用纯 CSS 画一个对话气泡（和页面其他图标一样，不用 emoji/字体图标） */
.icon-service {
	position: relative;
	width: 42rpx;
	height: 32rpx;
	box-sizing: border-box;
	border: 3rpx solid #999999;
	border-radius: 10rpx;
}

.icon-service::after {
	content: '';
	position: absolute;
	left: 9rpx;
	bottom: -12rpx;
	width: 0;
	height: 0;
	border-left: 8rpx solid transparent;
	border-right: 8rpx solid transparent;
	border-top: 12rpx solid #999999;
}

.actionbar__service-label {
	margin-top: 8rpx;
	font-size: 20rpx;
	line-height: 26rpx;
	color: #999999;
}

.actionbar__btn {
	flex: 1;
	height: 84rpx;
	border-radius: 42rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 8rpx 20rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.actionbar__btn-text {
	font-size: 32rpx;
	font-weight: bold;
	color: #ffffff;
}

.actionbar-spacer {
	height: 140rpx;
}
</style>
