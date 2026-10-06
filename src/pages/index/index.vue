<template>
	<view class="page">
		<AppNavbar active="home" :cart-count="cartCount" />

		<!-- 轮播图 -->
		<swiper
			class="banner"
			:autoplay="hasMultipleBanners"
			:interval="3000"
			:duration="500"
			:circular="hasMultipleBanners"
			:indicator-dots="hasMultipleBanners"
			indicator-color="rgba(255, 255, 255, 0.45)"
			indicator-active-color="#ffffff"
		>
			<swiper-item v-for="item in banners" :key="item.id">
				<image class="banner__img" :src="item.imageUrl" mode="aspectFill" @click="onBannerTap(item)" />
			</swiper-item>
		</swiper>

		<!-- 搜索框（伪搜索框：不可输入，点击先弹提示） -->
		<view class="search" @click="onSearch">
			<view class="icon-search">
				<view class="icon-search__ring"></view>
				<view class="icon-search__handle"></view>
			</view>
			<text class="search__placeholder">大家都在搜：iPhone 16 Pro Max</text>
		</view>

		<!-- 分类 tab：加载中显示等高骨架，避免数据到达时页面跳动 -->
		<scroll-view v-if="categoriesLoading" class="tabs" scroll-x>
			<view class="tabs__skeleton">
				<view class="tabs__skeleton-item" v-for="n in 4" :key="n"></view>
			</view>
		</scroll-view>

		<block v-else>
			<scroll-view
				class="tabs"
				scroll-x
				:scroll-into-view="activeTabDomId"
				scroll-with-animation
			>
				<view
					v-for="tab in tabs"
					:key="tab.key"
					:id="'tab-' + tab.key"
					class="tab"
					:class="{ 'tab--active': tab.key === activeTabKey }"
					@click="onSelectTab(tab)"
				>
					<text class="tab__text">{{ tab.name }}</text>
					<view class="tab__indicator"></view>
				</view>
			</scroll-view>

			<!-- 分类树接口失败时的降级提示。此时 tab 行仍可用（走兜底分类），不会白屏 -->
			<view v-if="categoriesFailed" class="tabs-hint" @click="loadCategories">
				<text class="tabs-hint__text">分类加载失败，当前为默认分类 · 点击重试</text>
			</view>
		</block>

		<!-- 商品列表 -->
		<view class="goods">
			<view class="goods__heading">
				<view class="goods__accent"></view>
				<text class="goods__title">{{ goodsTitle }}</text>
			</view>

			<!-- 加载中 -->
			<view v-if="productsLoading" class="goods__status">
				<text class="goods__status-text">加载中…</text>
			</view>

			<template v-else>
				<view v-if="displayProducts.length" class="goods__grid">
					<view class="goods-card" v-for="item in displayProducts" :key="item.id">
						<image
							class="goods-card__img"
							:src="imageFor(item)"
							mode="aspectFill"
							@error="onImageError(item)"
						/>

						<view class="goods-card__body">
							<text class="goods-card__name">{{ item.name }}</text>

							<view class="goods-card__bottom">
								<text class="goods-card__price">
									<text class="goods-card__symbol">¥</text>{{ formatPrice(item.price) }}
								</text>
								<view class="goods-card__btn" @click.stop="addToCart(item)">
									<text class="goods-card__btn-text">加入购物车</text>
								</view>
							</view>
						</view>
					</view>
				</view>

				<!-- 查不到就显示暂无商品 -->
				<view v-else class="goods__empty">
					<text class="goods__empty-text">暂无商品</text>
				</view>
			</template>

			<!-- 精选走无限滚动，这里给个到底提示；分类页是一次性加载，不展示 -->
			<view v-if="isFeaturedTab && !productsLoading && displayProducts.length" class="goods__more">
				<text class="goods__more-text">{{ moreText }}</text>
			</view>
		</view>
	</view>
</template>

<script>
import AppNavbar from '@/components/AppNavbar.vue'
import { categoryApi, productApi, bannerApi } from '@/utils/api'
import { FALLBACK_CATEGORIES } from '@/mock/categories'
import { resolveProductImage, formatPrice } from '@/utils/productImage'

/** 「精选」伪 tab 的 key。真实分类的 key 是 'cat-<数字 id>'，不会撞 */
const ALL_TAB_KEY = 'all'
/** 无限滚动每页条数 */
const PAGE_SIZE = 10
/** 轮播图接口不可用时的本地占位图 */
const LOCAL_BANNERS = [1, 2, 3].map((n) => ({
	id: `local-${n}`,
	imageUrl: `/static/banner/banner-${n}.png`,
	linkUrl: '',
}))

export default {
	components: { AppNavbar },
	data() {
		return {
			cartCount: 0,
			// 先放本地占位图，接口拿到后再替换，保证轮播区不会空掉
			banners: LOCAL_BANNERS,
			categoriesLoading: true,
			categoriesFailed: false,
			// 一级分类，来自 /api/category/tree，失败时降级为 FALLBACK_CATEGORIES
			categories: [],
			activeTabKey: ALL_TAB_KEY,

			// 精选（为你推荐）：游标无限滚动
			featuredList: [],
			featuredCursor: 0,
			featuredHasMore: true,
			featuredLoading: false,
			featuredLoadingMore: false,

			// 分类商品：一次拉完
			categoryProducts: [],
			categoryLoading: false,

			// 加载失败过的图片 id，避免反复重试坏地址
			failedImageIds: [],
		}
	},
	computed: {
		tabs() {
			// 精选恒定在第一位，不参与后端 sort 排序
			return [
				{ key: ALL_TAB_KEY, name: '精选' },
				...this.categories.map((item) => ({
					key: `cat-${item.id}`,
					name: item.name,
					category: item,
				})),
			]
		},
		activeTab() {
			return this.tabs.find((tab) => tab.key === this.activeTabKey) || this.tabs[0]
		},
		isFeaturedTab() {
			return this.activeTabKey === ALL_TAB_KEY
		},
		displayProducts() {
			return this.isFeaturedTab ? this.featuredList : this.categoryProducts
		},
		productsLoading() {
			return this.isFeaturedTab ? this.featuredLoading : this.categoryLoading
		},
		goodsTitle() {
			return this.isFeaturedTab ? '为你推荐' : this.activeTab.name
		},
		moreText() {
			if (this.featuredLoadingMore) return '加载中…'
			return this.featuredHasMore ? '上拉加载更多' : '没有更多了'
		},
		activeTabDomId() {
			return `tab-${this.activeTabKey}`
		},
		// 只有一张图时没必要自动播放，也不该显示指示点
		hasMultipleBanners() {
			return this.banners.length > 1
		},
	},
	onLoad() {
		this.loadBanners()
		this.loadCategories()
	},
	onReachBottom() {
		// 只有精选是无限滚动
		if (this.isFeaturedTab) this.loadFeatured()
	},
	methods: {
		/* ---------------- 轮播图 ---------------- */
		async loadBanners() {
			try {
				const list = await bannerApi.getList()
				const normalized = (Array.isArray(list) ? list : [])
					.filter((item) => item && item.imageUrl)
					.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0))
					.map((item) => ({
						id: item.id,
						imageUrl: item.imageUrl,
						linkUrl: item.linkUrl || '',
						title: item.title || '',
					}))
				// 接口没数据就保留本地占位图，别让轮播区空掉
				if (normalized.length) this.banners = normalized
			} catch (err) {
				console.warn('[index] 轮播图加载失败，使用本地占位图：', err && err.message)
			}
		},
		onBannerTap(item) {
			if (!item || !item.linkUrl) return
			// TODO: 商品详情页建好后改成 uni.navigateTo({ url: item.linkUrl })
			uni.showToast({ title: '商品详情页开发中', icon: 'none' })
		},

		/* ---------------- 分类 ---------------- */
		async loadCategories() {
			this.categoriesLoading = true
			this.categoriesFailed = false
			try {
				const list = await categoryApi.getTree()
				const normalized = this.normalizeCategories(list)
				if (normalized.length) {
					this.categories = normalized
				} else {
					// 接口通了但没数据，同样降级，避免只剩一个「精选」
					this.categories = FALLBACK_CATEGORIES
					this.categoriesFailed = true
				}
			} catch (err) {
				// 分类树挂了不能影响整页，更不能因此把用户登出
				// （request.js 在刷新失败时会 logout）
				this.categories = FALLBACK_CATEGORIES
				this.categoriesFailed = true
				console.warn('[index] 分类树加载失败，已降级为默认分类：', err && err.message)
			} finally {
				this.categoriesLoading = false
			}
			// 分类就位后再拉精选，避免首屏并发请求
			this.loadFeatured({ reset: true })
		},
		normalizeCategories(list) {
			if (!Array.isArray(list)) return []
			return list
				.filter(
					(item) =>
						item &&
						// 只取一级分类，不假设数组顺序
						Number(item.parentId) === 0 &&
						// status 为 0 表示停用；字段缺失时不误杀
						Number(item.status) !== 0
				)
				.sort((a, b) => {
					// sort 有重复值（清洁和家具都是 3），必须带 tie-break，
					// 否则顺序在不同端可能不一致
					const diff = Number(a.sort) - Number(b.sort)
					return diff !== 0 ? diff : Number(a.id) - Number(b.id)
				})
				.map((item) => ({
					id: item.id,
					name: item.name,
					parentId: item.parentId,
					children: (Array.isArray(item.children) ? item.children : []).map((child) => ({
						id: child.id,
						name: child.name,
					})),
				}))
		},
		onSelectTab(tab) {
			if (tab.key === this.activeTabKey) return
			this.activeTabKey = tab.key
			// 从长列表切到短列表/空列表时，视口会停在页面中间，这里回到商品区顶部
			uni.pageScrollTo({ selector: '.goods', duration: 200, fail: () => {} })

			if (tab.key === ALL_TAB_KEY) {
				// 精选列表可能还是空的（比如下拉刷新过），按需重拉
				if (!this.featuredList.length) this.loadFeatured({ reset: true })
			} else {
				this.loadCategoryProducts(tab.category)
			}
		},

		/* ---------------- 精选：无限滚动 ---------------- */
		async loadFeatured({ reset = false } = {}) {
			if (reset) {
				this.featuredList = []
				this.featuredCursor = 0
				this.featuredHasMore = true
			}
			if (!this.featuredHasMore || this.featuredLoadingMore || this.featuredLoading) return

			const isFirstPage = this.featuredList.length === 0
			if (isFirstPage) this.featuredLoading = true
			else this.featuredLoadingMore = true

			try {
				const res = await productApi.getScrollList({
					beginId: this.featuredCursor,
					querySize: PAGE_SIZE,
				})
				// 后端可能返回 null，null 就跳过不处理
				const list = (res && res.list) || []
				this.appendUnique(this.featuredList, list)

				const cursor = res && res.simpleCursorCommonEntity
				if (cursor && cursor.sortId != null) this.featuredCursor = cursor.sortId
				// 到底的条件：后端说 isEnd，或者这一页没返回任何数据
				this.featuredHasMore = !(res && res.isEnd) && list.length > 0
			} catch (err) {
				this.featuredHasMore = false
				console.warn('[index] 精选商品加载失败：', err && err.message)
			} finally {
				this.featuredLoading = false
				this.featuredLoadingMore = false
			}
		},

		/* ---------------- 分类商品 ---------------- */
		async loadCategoryProducts(category) {
			if (!category) return
			this.categoryLoading = true
			this.categoryProducts = []
			try {
				// isFirstCategoryId 必填：传 true 时后端会把该一级分类下所有
				// 子分类的商品一并返回，前端不用再自己上卷子分类
				const res = await productApi.getByCategory({
					categoryId: category.id,
					isFirstCategoryId: Number(category.parentId) === 0,
					querySize: 20,
				})
				// 后端可能返回 null，null 就跳过不处理
				const list = (res && res.list) || []
				this.categoryProducts = list.filter((item) => item && item.id != null)
			} catch (err) {
				console.warn('[index] 分类商品加载失败：', err && err.message)
				this.categoryProducts = []
			} finally {
				this.categoryLoading = false
			}
		},

		/** 按 id 去重后追加，跳过 null 项 */
		appendUnique(target, list) {
			if (!Array.isArray(list)) return
			const seen = new Set(target.map((item) => item && item.id))
			list.forEach((item) => {
				if (!item || item.id == null || seen.has(item.id)) return
				seen.add(item.id)
				target.push(item)
			})
		},

		/* ---------------- 展示 ---------------- */
		imageFor(item) {
			return resolveProductImage(item, this.failedImageIds)
		},
		formatPrice,
		onImageError(item) {
			if (!item || item.id == null) return
			if (this.failedImageIds.indexOf(item.id) === -1) this.failedImageIds.push(item.id)
		},

		/* ---------------- 交互 ---------------- */
		onSearch() {
			uni.showToast({ title: '搜索功能开发中', icon: 'none' })
		},
		addToCart(item) {
			this.cartCount++
			uni.showToast({ title: '已加入购物车', icon: 'none' })
			console.log('加入购物车:', item && item.name)
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

/* ---------- 搜索图标（纯 CSS 绘制，搜索框内复用） ---------- */
.icon-search {
	position: relative;
	width: 34rpx;
	height: 34rpx;
	flex-shrink: 0;
}

.icon-search__ring {
	position: absolute;
	top: 1rpx;
	left: 1rpx;
	width: 22rpx;
	height: 22rpx;
	border: 3rpx solid #999999;
	border-radius: 50%;
}

.icon-search__handle {
	position: absolute;
	left: 20rpx;
	top: 24rpx;
	width: 12rpx;
	height: 3rpx;
	background-color: #999999;
	border-radius: 2rpx;
	transform: rotate(45deg);
	transform-origin: 0 50%;
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

/* ---------- 搜索框 ---------- */
.search {
	display: flex;
	align-items: center;
	margin: 0 24rpx 20rpx;
	padding: 0 24rpx;
	height: 72rpx;
	background-color: #ffffff;
	border-radius: 36rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.search__placeholder {
	margin-left: 16rpx;
	font-size: 26rpx;
	color: #999999;
}

/* ---------- 分类 tab ---------- */
.tabs {
	width: 100%;
	height: 88rpx;
	background-color: #ffffff;
	white-space: nowrap;
}

.tab {
	position: relative;
	display: inline-block;
	height: 88rpx;
	padding: 0 28rpx;
	box-sizing: border-box;
	text-align: center;
}

.tab__text {
	display: inline-block;
	line-height: 88rpx;
	font-size: 28rpx;
	color: #333333;
}

.tab--active .tab__text {
	font-size: 30rpx;
	font-weight: bold;
	color: #ff6b35;
}

.tab__indicator {
	position: absolute;
	left: 50%;
	bottom: 8rpx;
	width: 0;
	height: 6rpx;
	margin-left: 0;
	border-radius: 3rpx;
	background-color: #ff6b35;
	transition: width 0.2s;
}

.tab--active .tab__indicator {
	width: 40rpx;
	margin-left: -20rpx;
}

/* 加载骨架：与 tab 行等高，避免数据到达时布局跳动 */
.tabs__skeleton {
	display: flex;
	align-items: center;
	height: 88rpx;
	padding: 0 28rpx;
	box-sizing: border-box;
}

.tabs__skeleton-item {
	width: 96rpx;
	height: 32rpx;
	margin-right: 48rpx;
	border-radius: 8rpx;
	background-color: #eeeeee;
}

.tabs-hint {
	padding: 12rpx 24rpx;
	background-color: #fff7f2;
}

.tabs-hint__text {
	font-size: 22rpx;
	color: #ff6b35;
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

/* 空状态 / 加载中 */
.goods__empty,
.goods__status {
	padding: 80rpx 0;
	text-align: center;
}

.goods__empty-text,
.goods__status-text {
	font-size: 26rpx;
	color: #999999;
}

.goods__more {
	padding: 20rpx 0;
	text-align: center;
}

.goods__more-text {
	font-size: 24rpx;
	color: #999999;
}
</style>
