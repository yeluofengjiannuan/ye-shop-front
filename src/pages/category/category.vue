<template>
	<view class="page">
		<AppNavbar active="category" :cart-count="cartCount" />

		<!-- 一级分类 -->
		<scroll-view v-if="treeLoading" class="l1" scroll-x>
			<view class="l1__skeleton">
				<view class="l1__skeleton-item" v-for="n in 4" :key="n"></view>
			</view>
		</scroll-view>

		<scroll-view
			v-else
			class="l1"
			scroll-x
			:scroll-into-view="activeL1DomId"
			scroll-with-animation
		>
			<view
				v-for="item in categories"
				:key="item.id"
				:id="'l1-' + item.id"
				class="l1-item"
				:class="{ 'l1-item--active': activeL1 && item.id === activeL1.id }"
				@click="selectL1(item)"
			>
				<text class="l1-item__text">{{ item.name }}</text>
			</view>
		</scroll-view>

		<view v-if="treeFailed" class="tree-hint" @click="loadTree">
			<text class="tree-hint__text">分类加载失败，当前为默认分类 · 点击重试</text>
		</view>

		<!-- 二级分类：一级分类下没有子分类时整块不显示，商品直接用一级分类查 -->
		<view v-if="subCategories.length" class="l2">
			<!-- 「全部」= 该一级分类下的所有商品（含子分类），作为默认选中项，
			     否则默认落到某个可能没商品的二级分类上，首屏会直接是空态 -->
			<view class="l2-item" :class="{ 'l2-item--active': !activeL2 }" @click="selectAll">
				<text class="l2-item__text">全部</text>
			</view>
			<view
				v-for="item in subCategories"
				:key="item.id"
				class="l2-item"
				:class="{ 'l2-item--active': activeL2 && item.id === activeL2.id }"
				@click="selectL2(item)"
			>
				<text class="l2-item__text">{{ item.name }}</text>
			</view>
		</view>

		<!-- 排序栏 -->
		<view class="sort-wrap">
			<SortBar v-model="sortType" />
		</view>

		<!-- 商品列表 -->
		<view class="goods">
			<view v-if="productsLoading" class="goods__status">
				<text class="goods__status-text">加载中…</text>
			</view>

			<template v-else>
				<view v-if="products.length" class="goods__grid">
					<view class="goods-card" @click="onProductTap(item)" v-for="item in products" :key="item.id">
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

				<view v-else class="goods__empty">
					<text class="goods__empty-text">暂无商品</text>
				</view>
			</template>

			<view v-if="!productsLoading && products.length" class="goods__more">
				<text class="goods__more-text">{{ moreText }}</text>
			</view>
		</view>

		<!-- 规格半屏（列表页加购入口） -->
		<SpecSheet
			:product-id="sheetProductId"
			:visible="sheetVisible"
			@close="sheetVisible = false"
		/>
	</view>
</template>

<script>
import AppNavbar from '@/components/AppNavbar.vue'
import SortBar from '@/components/SortBar.vue'
import SpecSheet from '@/components/SpecSheet.vue'
import { categoryApi, productApi } from '@/utils/api'
import { FALLBACK_CATEGORIES } from '@/mock/categories'
import { resolveProductImage, formatPrice } from '@/utils/productImage'
import { useCartStore } from '@/store/modules/cart'

const PAGE_SIZE = 20

export default {
	components: { AppNavbar, SortBar, SpecSheet },
	data() {
		return {
			// 规格半屏：列表接口不给规格，加购必须先弹这个选 specId
			sheetProductId: '',
			sheetVisible: false,
			treeLoading: true,
			treeFailed: false,
			categories: [],
			activeL1: null,
			activeL2: null,

			// 四种排序：default / priceAsc / priceDesc / newest
			sortType: 'default',

			products: [],
			productsLoading: false,
			cursor: 0,
			hasMore: true,
			loadingMore: false,

			failedImageIds: [],
		}
	},
	watch: {
		// SortBar 通过 v-model 改排序，必须在这里统一重新拉数据，
		// 否则点了排序只是高亮变了、列表不动
		sortType() {
			this.reloadProducts()
		},
	},
	computed: {
		/** 角标直连 cart store，不再是页面本地的假计数 */
		cartCount() {
			return useCartStore().count
		},
		subCategories() {
			return (this.activeL1 && this.activeL1.children) || []
		},

		/** 选中二级就查二级，一级没有子分类时退回查一级（isFirstCategoryId 决定是否下钻） */
		queryCategory() {
			return this.activeL2 || this.activeL1
		},
		queryIsFirstCategory() {
			return !this.activeL2
		},
		activeL1DomId() {
			return this.activeL1 ? `l1-${this.activeL1.id}` : ''
		},
		moreText() {
			if (this.loadingMore) return '加载中…'
			return this.hasMore ? '上拉加载更多' : '没有更多了'
		},
	},
	onLoad() {
		this.loadTree()
	},
	onReachBottom() {
		this.loadProducts()
	},
	methods: {
		/* ---------------- 分类树 ---------------- */
		async loadTree() {
			this.treeLoading = true
			this.treeFailed = false
			try {
				const list = await categoryApi.getTree()
				const normalized = this.normalizeCategories(list)
				if (normalized.length) {
					this.categories = normalized
				} else {
					this.categories = FALLBACK_CATEGORIES
					this.treeFailed = true
				}
			} catch (err) {
				// 分类树挂了不能影响整页，更不能因此把用户登出
				this.categories = FALLBACK_CATEGORIES
				this.treeFailed = true
				console.warn('[category] 分类树加载失败，已降级为默认分类：', err && err.message)
			} finally {
				this.treeLoading = false
			}
			// 默认选中第一个一级分类，并自动落到它的第一个二级分类
			if (this.categories.length) this.selectL1(this.categories[0])
		},
		normalizeCategories(list) {
			if (!Array.isArray(list)) return []
			return list
				.filter(
					(item) =>
						item &&
						Number(item.parentId) === 0 &&
						// status 为 0 表示停用；字段缺失时不误杀
						Number(item.status) !== 0
				)
				.sort((a, b) => {
					// sort 有重复值，必须带 tie-break，否则顺序在不同端可能不一致
					const diff = Number(a.sort) - Number(b.sort)
					return diff !== 0 ? diff : Number(a.id) - Number(b.id)
				})
				.map((item) => ({
					id: item.id,
					name: item.name,
					parentId: item.parentId,
					children: (Array.isArray(item.children) ? item.children : [])
						.filter((child) => child && Number(child.status) !== 0)
						.sort((a, b) => {
							const diff = Number(a.sort) - Number(b.sort)
							return diff !== 0 ? diff : Number(a.id) - Number(b.id)
						})
						.map((child) => ({ id: child.id, name: child.name, parentId: child.parentId })),
				}))
		},
		selectL1(item) {
			if (this.activeL1 && this.activeL1.id === item.id) return
			this.activeL1 = item
			// 默认落到「全部」，商品按一级分类查（后端会带上子分类的商品）
			this.activeL2 = null
			this.reloadProducts()
		},
		/** activeL2 为 null 表示「全部」 */
		selectAll() {
			if (!this.activeL2) return
			this.activeL2 = null
			this.reloadProducts()
		},
		selectL2(item) {
			if (this.activeL2 && this.activeL2.id === item.id) return
			this.activeL2 = item
			this.reloadProducts()
		},

		/* ---------------- 商品 ---------------- */
		reloadProducts() {
			// 换分类或换排序都要重置游标：curCommonEntity 的 sortValue 是跟着
			// sortType 变的，沿用旧游标会取到错位的数据
			this.products = []
			this.cursor = 0
			this.hasMore = true
			this.loadProducts()
		},
		async loadProducts() {
			if (!this.queryCategory) return
			if (!this.hasMore || this.productsLoading || this.loadingMore) return

			const isFirstPage = this.products.length === 0
			if (isFirstPage) this.productsLoading = true
			else this.loadingMore = true

			try {
				const params = {
					categoryId: this.queryCategory.id,
					isFirstCategoryId: this.queryIsFirstCategory,
					sortType: this.sortType,
					querySize: PAGE_SIZE,
				}
				// 首页不传 sortId；翻页传上一页返回的游标
				if (this.cursor) params.sortId = this.cursor

				const res = await productApi.getByCategory(params)
				// 后端可能返回 null，null 就跳过不处理
				const list = (res && res.list) || []

				const seen = new Set(this.products.map((item) => item && item.id))
				list.forEach((item) => {
					if (!item || item.id == null || seen.has(item.id)) return
					seen.add(item.id)
					this.products.push(item)
				})

				const cursor = res && res.cursorCommonEntity
				if (cursor && cursor.sortId != null) this.cursor = cursor.sortId
				// isEnd 只有在返回条数 < querySize 时才为 true，
				// 拿到满页仍是 false，所以还要用空列表兜底终止
				this.hasMore = !(res && res.isEnd) && list.length > 0
			} catch (err) {
				this.hasMore = false
				console.warn('[category] 商品加载失败：', err && err.message)
			} finally {
				this.productsLoading = false
				this.loadingMore = false
			}
		},
		imageFor(item) {
			return resolveProductImage(item, this.failedImageIds)
		},
		formatPrice,
		onImageError(item) {
			if (!item || item.id == null) return
			if (this.failedImageIds.indexOf(item.id) === -1) this.failedImageIds.push(item.id)
		},
		onProductTap(item) {
			if (!item || item.id == null) return
			uni.navigateTo({
				url: `/pages/product/detail?productId=${item.id}`,
			})
		},
		addToCart(item) {
			if (!item || item.id == null) return
			// 列表接口只给商品不给规格，而加购接口事实必填 specId，
			// 所以这里开规格半屏，选完规格才真正发请求
			this.sheetProductId = String(item.id)
			this.sheetVisible = true
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
   主题色板（与首页一致）
   主色 #FF6B35 / 背景 #F5F5F5 / 卡片 #FFFFFF / 文字 #333333 / 次要 #999999
   ============================================================ */

/* ---------- 一级分类 ---------- */
.l1 {
	width: 100%;
	height: 88rpx;
	background-color: #ffffff;
	white-space: nowrap;
}

.l1-item {
	position: relative;
	display: inline-block;
	height: 88rpx;
	padding: 0 28rpx;
	box-sizing: border-box;
	text-align: center;
}

.l1-item__text {
	display: inline-block;
	line-height: 88rpx;
	font-size: 28rpx;
	color: #333333;
}

.l1-item--active .l1-item__text {
	font-size: 30rpx;
	font-weight: bold;
	color: #ff6b35;
}

.l1-item--active::after {
	content: '';
	position: absolute;
	left: 50%;
	bottom: 8rpx;
	width: 40rpx;
	height: 6rpx;
	margin-left: -20rpx;
	border-radius: 3rpx;
	background-color: #ff6b35;
}

/* 骨架：与 tab 行等高，避免数据到达时布局跳动 */
.l1__skeleton {
	display: flex;
	align-items: center;
	height: 88rpx;
	padding: 0 28rpx;
	box-sizing: border-box;
}

.l1__skeleton-item {
	width: 96rpx;
	height: 32rpx;
	margin-right: 48rpx;
	border-radius: 8rpx;
	background-color: #eeeeee;
}

.tree-hint {
	padding: 12rpx 24rpx;
	background-color: #fff7f2;
}

.tree-hint__text {
	font-size: 22rpx;
	color: #ff6b35;
}

/* ---------- 二级分类 ---------- */
.l2 {
	display: flex;
	flex-wrap: wrap;
	margin: 20rpx 24rpx 0;
	padding: 24rpx 12rpx 4rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.l2-item {
	margin: 0 12rpx 20rpx;
	padding: 0 24rpx;
	height: 60rpx;
	border-radius: 30rpx;
	background-color: #f5f5f5;
	display: flex;
	align-items: center;
}

.l2-item__text {
	font-size: 26rpx;
	color: #333333;
}

.l2-item--active {
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 4rpx 12rpx rgba(255, 107, 53, 0.28);
}

.l2-item--active .l2-item__text {
	color: #ffffff;
	font-weight: bold;
}

/* ---------- 排序栏 ---------- */
.sort-wrap {
	margin: 20rpx 24rpx 0;
}

/* ---------- 商品列表 ---------- */
.goods {
	margin: 20rpx 24rpx;
	padding-bottom: 40rpx;
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
