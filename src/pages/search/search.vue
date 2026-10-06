<template>
	<view class="page">
		<PageHeader>
			<view class="search-box">
				<view class="icon-search">
					<view class="icon-search__ring"></view>
					<view class="icon-search__handle"></view>
				</view>
				<input
					class="search-box__input"
					v-model="keyword"
					type="text"
					:focus="autoFocus"
					confirm-type="search"
					placeholder="搜索商品"
					placeholder-class="search-box__placeholder"
					@confirm="doSearch"
				/>
			</view>
			<template #right>
				<text class="search-action" @click="doSearch">搜索</text>
			</template>
		</PageHeader>

		<!-- 还没搜过：展示热词 -->
		<block v-if="!searched">
			<view v-if="hotKeywords.length" class="hot">
				<text class="hot__title">热门搜索</text>
				<view class="hot__list">
					<view
						v-for="(item, index) in hotKeywords"
						:key="index"
						class="hot__item"
						@click="searchKeyword(item)"
					>
						<text class="hot__item-text">{{ item }}</text>
					</view>
				</view>
			</view>
		</block>

		<!-- 搜过了：排序 + 结果 -->
		<block v-else>
			<view class="sort-wrap">
				<SortBar v-model="sortType" />
			</view>

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
						<text class="goods__empty-text">没有找到相关商品</text>
					</view>
				</template>

				<view v-if="!productsLoading && products.length" class="goods__more">
					<text class="goods__more-text">{{ moreText }}</text>
				</view>
			</view>
		</block>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import SortBar from '@/components/SortBar.vue'
import { productApi } from '@/utils/api'
import { resolveProductImage, formatPrice } from '@/utils/productImage'

const PAGE_SIZE = 20

export default {
	components: { PageHeader, SortBar },
	data() {
		return {
			keyword: '',
			/** 已提交搜索的关键词，结果与它对应 */
			submittedKeyword: '',
			searched: false,
			autoFocus: true,
			hotKeywords: [],

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
			if (this.searched) this.reloadProducts()
		},
	},
	computed: {
		moreText() {
			if (this.loadingMore) return '加载中…'
			return this.hasMore ? '上拉加载更多' : '没有更多了'
		},
	},
	onLoad() {
		this.loadKeywords()
	},
	onReachBottom() {
		this.loadProducts()
	},
	methods: {
		async loadKeywords() {
			try {
				const list = await productApi.getKeywords()
				this.hotKeywords = (Array.isArray(list) ? list : []).filter(
					(item) => typeof item === 'string' && item.trim()
				)
			} catch (err) {
				// 热词拿不到不影响搜索，静默降级成不展示
				console.warn('[search] 热词加载失败：', err && err.message)
			}
		},
		searchKeyword(word) {
			this.keyword = word
			this.doSearch()
		},
		doSearch() {
			const word = (this.keyword || '').trim()
			if (!word) {
				uni.showToast({ title: '请输入搜索关键词', icon: 'none' })
				return
			}
			if (word === this.submittedKeyword && this.searched) return
			this.submittedKeyword = word
			this.searched = true
			if (this.sortType === 'default') {
				this.reloadProducts()
			} else {
				// 改排序会触发上面的 watch，由它去 reload，避免重复请求
				this.sortType = 'default'
			}
		},
		/** 换排序/换关键词都要重置游标，因为游标里的 sortValue 是跟着 sortType 变的 */
		reloadProducts() {
			this.products = []
			this.cursor = 0
			this.hasMore = true
			this.loadProducts()
		},
		async loadProducts() {
			if (!this.submittedKeyword) return
			if (!this.hasMore || this.productsLoading || this.loadingMore) return

			const isFirstPage = this.products.length === 0
			if (isFirstPage) this.productsLoading = true
			else this.loadingMore = true

			try {
				const params = {
					keyword: this.submittedKeyword,
					sortType: this.sortType,
					querySize: PAGE_SIZE,
				}
				if (this.cursor) params.sortId = this.cursor

				const res = await productApi.search(params)
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
				// isEnd 只在返回条数 < querySize 时才为 true，满页仍是 false，
				// 所以还要用空列表兜底终止
				this.hasMore = !(res && res.isEnd) && list.length > 0
			} catch (err) {
				this.hasMore = false
				console.warn('[search] 搜索失败：', err && err.message)
				uni.showToast({ title: (err && err.message) || '搜索失败', icon: 'none' })
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
/* 主题色板与全局一致：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 */

/* ---------- 头部搜索框 ---------- */
.search-box {
	flex: 1;
	display: flex;
	align-items: center;
	margin-right: 16rpx;
	padding: 0 20rpx;
	height: 60rpx;
	background-color: #f5f5f5;
	border-radius: 30rpx;
	overflow: hidden;
}

.icon-search {
	position: relative;
	width: 30rpx;
	height: 30rpx;
	flex-shrink: 0;
}

.icon-search__ring {
	position: absolute;
	top: 1rpx;
	left: 1rpx;
	width: 20rpx;
	height: 20rpx;
	border: 3rpx solid #999999;
	border-radius: 50%;
}

.icon-search__handle {
	position: absolute;
	left: 18rpx;
	top: 22rpx;
	width: 10rpx;
	height: 3rpx;
	background-color: #999999;
	border-radius: 2rpx;
	transform: rotate(45deg);
	transform-origin: 0 50%;
}

.search-box__input {
	flex: 1;
	margin-left: 12rpx;
	height: 60rpx;
	font-size: 26rpx;
	color: #333333;
}

.search-box__placeholder {
	color: #999999;
}

.search-action {
	font-size: 28rpx;
	color: #ff6b35;
	font-weight: bold;
	white-space: nowrap;
}

/* ---------- 热门搜索 ---------- */
.hot {
	margin: 20rpx 24rpx;
	padding: 28rpx 24rpx 8rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.hot__title {
	font-size: 28rpx;
	font-weight: bold;
	color: #333333;
}

.hot__list {
	display: flex;
	flex-wrap: wrap;
	margin-top: 20rpx;
}

.hot__item {
	margin: 0 16rpx 20rpx 0;
	padding: 0 24rpx;
	height: 60rpx;
	border-radius: 30rpx;
	background-color: #f5f5f5;
	display: flex;
	align-items: center;
}

.hot__item-text {
	font-size: 26rpx;
	color: #333333;
}

/* ---------- 排序 ---------- */
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
