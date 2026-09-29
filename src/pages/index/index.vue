<template>
	<view class="page">
		<!-- 固定导航栏：padding-top 让出状态栏高度 -->
		<view class="navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
			<view class="navbar__inner">
				<view class="logo">
					<view class="logo__mark">YE</view>
					<text class="logo__text">叶选商城</text>
				</view>

				<view class="navbar__actions">
					<!-- 搜索 -->
					<view class="nav-btn" @click="onSearch">
						<view class="icon-search">
							<view class="icon-search__ring"></view>
							<view class="icon-search__handle"></view>
						</view>
					</view>

					<!-- 个人中心 -->
					<view class="nav-btn" @click="onProfile">
						<view class="icon-user">
							<view class="icon-user__head"></view>
							<view class="icon-user__body"></view>
						</view>
					</view>

					<!-- 购物车（带角标） -->
					<view class="nav-btn" @click="onCart">
						<view class="icon-cart">
							<view class="icon-cart__handle"></view>
							<view class="icon-cart__body"></view>
							<view class="icon-cart__wheel icon-cart__wheel--l"></view>
							<view class="icon-cart__wheel icon-cart__wheel--r"></view>
						</view>
						<text v-if="cartCount > 0" class="nav-btn__badge">{{ cartCount }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 占位块：与固定导航栏同高，避免内容被遮住。单位与导航栏一一对应，无需换算 -->
		<view :style="{ height: statusBarHeight + 'px' }"></view>
		<view class="navbar-spacer"></view>

		<!-- 轮播图 -->
		<swiper
			class="banner"
			:autoplay="true"
			:interval="3000"
			:duration="500"
			:circular="true"
			:indicator-dots="true"
			indicator-color="rgba(255, 255, 255, 0.45)"
			indicator-active-color="#ffffff"
		>
			<swiper-item v-for="(item, index) in banners" :key="index">
				<image class="banner__img" :src="item" mode="aspectFill" />
			</swiper-item>
		</swiper>

		<!-- 分类导航 -->
		<view class="categories">
			<view
				class="category"
				v-for="item in categories"
				:key="item.id"
				@click="onCategory(item)"
			>
				<view class="category__icon" :class="'category__icon--' + item.id">
					<text class="category__emoji">{{ item.icon }}</text>
				</view>
				<text class="category__label">{{ item.label }}</text>
			</view>
		</view>

		<!-- 商品列表 -->
		<view class="goods">
			<view class="goods__heading">
				<view class="goods__accent"></view>
				<text class="goods__title">为你推荐</text>
			</view>

			<view class="goods__grid">
				<view class="goods-card" v-for="item in goodsList" :key="item.id">
					<image class="goods-card__img" :src="item.image" mode="aspectFill" />

					<view class="goods-card__body">
						<text class="goods-card__name">{{ item.name }}</text>

						<view class="goods-card__bottom">
							<text class="goods-card__price">
								<text class="goods-card__symbol">¥</text>{{ item.price }}
							</text>
							<view class="goods-card__btn" @click.stop="addToCart(item)">
								<text class="goods-card__btn-text">加入购物车</text>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { useUserStore } from '@/store/modules/user'

export default {
	data() {
		return {
			statusBarHeight: 0,
			cartCount: 0,
			banners: [
				'/static/banner/banner-1.png',
				'/static/banner/banner-2.png',
				'/static/banner/banner-3.png',
			],
			// 分类图标配色统一放在样式里（.category__icon--<id>），此处只留内容
			categories: [
				{ id: 'new', label: '新品推荐', icon: '✨' },
				{ id: 'hot', label: '热销单品', icon: '🔥' },
				{ id: 'coupon', label: '领券中心', icon: '🎫' },
			],
			goodsList: [
				{
					id: 1,
					name: '简约纯棉基础款圆领短袖T恤',
					price: '89.00',
					image: '/static/goods/goods-1.png',
				},
				{
					id: 2,
					name: '轻奢质感真皮通勤单肩包',
					price: '299.00',
					image: '/static/goods/goods-2.png',
				},
				{
					id: 3,
					name: '复古百搭针织开衫外套',
					price: '199.00',
					image: '/static/goods/goods-3.png',
				},
				{
					id: 4,
					name: '高颜值便携保温杯 500ml',
					price: '69.90',
					image: '/static/goods/goods-4.png',
				},
				{
					id: 5,
					name: '日系简约陶瓷马克杯套装',
					price: '49.90',
					image: '/static/goods/goods-5.png',
				},
				{
					id: 6,
					name: '舒适透气运动休闲跑步鞋',
					price: '259.00',
					image: '/static/goods/goods-6.png',
				},
			],
		}
	},
	onLoad() {
		// 状态栏高度用于给自定义导航栏留出刘海/状态栏空间，H5 端为 0
		const info = uni.getSystemInfoSync()
		this.statusBarHeight = info.statusBarHeight || 0
	},
	methods: {
		onSearch() {
			uni.showToast({ title: '搜索功能开发中', icon: 'none' })
		},
		onCart() {
			// TODO: 购物车页建好后改成 uni.navigateTo({ url: '/pages/cart/cart' })
			uni.showToast({ title: `购物车共 ${this.cartCount} 件商品`, icon: 'none' })
		},
		onProfile() {
			const userStore = useUserStore()
			// 正常情况下没登录根本进不来（App.vue 里有路由拦截），这里只是兜底
			if (userStore.isLogin) {
				uni.navigateTo({ url: '/pages/profile/profile' })
			} else {
				uni.navigateTo({ url: '/pages/login/login' })
			}
		},
		onCategory(item) {
			uni.showToast({ title: item.label, icon: 'none' })
		},
		addToCart(item) {
			this.cartCount++
			uni.showToast({ title: '已加入购物车', icon: 'none' })
			console.log('加入购物车:', item.name)
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
/* ============================================================
   主题色板
   主色    #FF6B35   活力橙（按钮 / 价格 / 强调）
   主色浅  #FF8A5B   渐变起始色
   背景    #F5F5F5   浅灰
   卡片    #FFFFFF
   文字    #333333   深灰
   次要文字 #999999
   ============================================================ */

/* ---------- 导航栏 ---------- */
.navbar {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
	background-color: #ffffff;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.navbar__inner {
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 24rpx;
}

.navbar-spacer {
	height: 88rpx;
}

.logo {
	display: flex;
	align-items: center;
}

.logo__mark {
	width: 56rpx;
	height: 56rpx;
	border-radius: 18rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 4rpx 12rpx rgba(255, 107, 53, 0.3);
	color: #ffffff;
	font-size: 24rpx;
	font-weight: bold;
	text-align: center;
	line-height: 56rpx;
	letter-spacing: 1rpx;
}

.logo__text {
	margin-left: 16rpx;
	font-size: 32rpx;
	font-weight: bold;
	color: #333333;
}

.navbar__actions {
	display: flex;
	align-items: center;
}

.nav-btn {
	position: relative;
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav-btn__badge {
	position: absolute;
	top: 4rpx;
	right: 2rpx;
	min-width: 30rpx;
	height: 30rpx;
	padding: 0 6rpx;
	box-sizing: border-box;
	border-radius: 15rpx;
	background-color: #ff6b35;
	color: #ffffff;
	font-size: 20rpx;
	line-height: 30rpx;
	text-align: center;
}

/* 搜索图标（纯 CSS 绘制，无需图标字体） */
.icon-search {
	position: relative;
	width: 40rpx;
	height: 40rpx;
}

.icon-search__ring {
	position: absolute;
	top: 2rpx;
	left: 2rpx;
	width: 26rpx;
	height: 26rpx;
	border: 3rpx solid #333333;
	border-radius: 50%;
}

.icon-search__handle {
	position: absolute;
	left: 24rpx;
	top: 28rpx;
	width: 14rpx;
	height: 3rpx;
	background-color: #333333;
	border-radius: 2rpx;
	transform: rotate(45deg);
	transform-origin: 0 50%;
}

/* 购物车图标 */
.icon-cart {
	position: relative;
	width: 46rpx;
	height: 40rpx;
}

.icon-cart__handle {
	position: absolute;
	left: 0;
	top: 4rpx;
	width: 14rpx;
	height: 3rpx;
	background-color: #333333;
	border-radius: 2rpx;
}

.icon-cart__body {
	position: absolute;
	left: 11rpx;
	top: 6rpx;
	width: 33rpx;
	height: 20rpx;
	box-sizing: border-box;
	border: 3rpx solid #333333;
	border-radius: 3rpx 3rpx 8rpx 8rpx;
}

.icon-cart__wheel {
	position: absolute;
	bottom: 1rpx;
	width: 7rpx;
	height: 7rpx;
	border-radius: 50%;
	background-color: #333333;
}

.icon-cart__wheel--l {
	left: 16rpx;
}

.icon-cart__wheel--r {
	left: 36rpx;
}

/* 个人中心图标 */
.icon-user {
	position: relative;
	width: 40rpx;
	height: 40rpx;
}

.icon-user__head {
	position: absolute;
	top: 3rpx;
	left: 10rpx;
	width: 20rpx;
	height: 20rpx;
	box-sizing: border-box;
	border: 3rpx solid #333333;
	border-radius: 50%;
}

.icon-user__body {
	position: absolute;
	bottom: 2rpx;
	left: 3rpx;
	width: 34rpx;
	height: 17rpx;
	box-sizing: border-box;
	border: 3rpx solid #333333;
	border-bottom: none;
	border-radius: 18rpx 18rpx 0 0;
}

/* ---------- 轮播图 ---------- */
.banner {
	height: 300rpx;
	margin: 20rpx 24rpx;
	border-radius: 20rpx;
	overflow: hidden;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.banner__img {
	width: 100%;
	height: 300rpx;
	display: block;
}

/* ---------- 分类导航 ---------- */
.categories {
	display: flex;
	margin: 0 24rpx 20rpx;
	padding: 32rpx 20rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.category {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.category__icon {
	width: 96rpx;
	height: 96rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
}

/* 三个分类图标统一走暖色系，保证主色调一致又不至于单调 */
.category__icon--new {
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 6rpx 16rpx rgba(255, 107, 53, 0.28);
}

.category__icon--hot {
	background-image: linear-gradient(135deg, #ffb347 0%, #ff8c42 100%);
	box-shadow: 0 6rpx 16rpx rgba(255, 140, 66, 0.28);
}

.category__icon--coupon {
	background-image: linear-gradient(135deg, #ff7a85 0%, #ff4d6d 100%);
	box-shadow: 0 6rpx 16rpx rgba(255, 77, 109, 0.28);
}

.category__emoji {
	font-size: 44rpx;
	line-height: 1;
}

.category__label {
	margin-top: 16rpx;
	font-size: 26rpx;
	color: #333333;
}

/* ---------- 商品列表 ---------- */
.goods {
	margin: 0 24rpx;
	padding: 20rpx 0 40rpx;
}

.goods__heading {
	display: flex;
	align-items: center;
	padding-bottom: 20rpx;
}

.goods__accent {
	width: 8rpx;
	height: 32rpx;
	margin-right: 12rpx;
	border-radius: 4rpx;
	background-color: #ff6b35;
}

.goods__title {
	font-size: 32rpx;
	font-weight: bold;
	color: #333333;
}

.goods__grid {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
}

.goods-card {
	width: calc((100% - 20rpx) / 2);
	margin-bottom: 20rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	overflow: hidden;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.goods-card__img {
	width: 100%;
	height: 341rpx;
	display: block;
	background-color: #f5f5f5;
}

.goods-card__body {
	padding: 20rpx;
}

.goods-card__name {
	display: -webkit-box;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	height: 80rpx;
	font-size: 28rpx;
	line-height: 40rpx;
	color: #333333;
}

.goods-card__bottom {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 20rpx;
}

.goods-card__price {
	font-size: 32rpx;
	font-weight: bold;
	color: #ff6b35;
	white-space: nowrap;
}

.goods-card__symbol {
	font-size: 24rpx;
}

.goods-card__btn {
	flex-shrink: 0;
	padding: 12rpx 18rpx;
	border-radius: 28rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 4rpx 12rpx rgba(255, 107, 53, 0.28);
}

.goods-card__btn-text {
	font-size: 22rpx;
	color: #ffffff;
	white-space: nowrap;
}
</style>
