<template>
	<view class="page">
		<PageHeader title="确认订单" />

		<view v-if="loading" class="status">
			<text class="status__text">加载中…</text>
		</view>

		<view v-else-if="!items.length" class="status">
			<text class="status__text">商品已失效，请回购物车重新选择</text>
			<view class="status__btn" @click="goBack">
				<text class="status__btn-text">返回</text>
			</view>
		</view>

		<block v-else>
			<!-- 收货地址 -->
			<view class="card card--tap" @click="openAddressSheet">
				<view v-if="address" class="addr">
					<view class="addr__top">
						<text class="addr__receiver">{{ address.receiver }}</text>
						<text class="addr__phone">{{ address.phone }}</text>
						<text v-if="isDefaultAddress" class="addr__badge">默认</text>
					</view>
					<text class="addr__detail">{{ addressText }}</text>
				</view>
				<view v-else class="addr addr--empty">
					<text class="addr__empty-text">请选择收货地址</text>
				</view>
				<view class="arrow"></view>
			</view>

			<!-- 商品 -->
			<view class="card">
				<text class="card__title">商品清单</text>
				<view class="goods__row" v-for="item in items" :key="item.id">
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

			<!-- 优惠券 -->
			<view class="card card--tap" @click="openCouponSheet">
				<view class="line">
					<text class="line__label">优惠券</text>
					<view class="line__right">
						<text
							class="line__value"
							:class="{ 'line__value--accent': !!selectedCoupon }"
						>
							{{ couponSummary }}
						</text>
						<view class="arrow"></view>
					</view>
				</view>
			</view>

			<!-- 备注 -->
			<view class="card">
				<view class="line">
					<text class="line__label">备注</text>
					<input
						class="line__input"
						v-model="remark"
						type="text"
						maxlength="100"
						placeholder="选填，可填写您的特殊要求"
						placeholder-class="line__placeholder"
					/>
				</view>
			</view>

			<!-- 金额 -->
			<view class="card">
				<text class="card__title">金额明细</text>
				<view class="row">
					<text class="row__label">商品金额</text>
					<text class="row__value">¥{{ formatPrice(goodsAmount) }}</text>
				</view>
				<view class="row">
					<text class="row__label">运费</text>
					<text class="row__value">¥0.00</text>
				</view>
				<view v-if="selectedCoupon" class="row">
					<text class="row__label">优惠券</text>
					<text class="row__value row__value--cut">
						-¥{{ formatPrice(discount) }}<text
							v-if="!selectedCoupon.exact"
							class="row__hint"
							>（预估）</text
						>
					</text>
				</view>
				<view class="row row--total">
					<text class="row__label">合计</text>
					<text class="row__total">¥{{ formatPrice(payAmount) }}</text>
				</view>
				<text v-if="hasInexactDiscount" class="card__note">
					该券的使用范围需要提交后由服务端判定，优惠金额以订单详情为准
				</text>
			</view>
		</block>

		<!-- 底部提交栏 -->
		<view v-if="items.length" class="actionbar">
			<view class="actionbar__sum">
				<text class="actionbar__sum-label">实付</text>
				<text class="actionbar__sum-price">
					<text class="actionbar__sum-symbol">¥</text>{{ formatPrice(payAmount) }}
				</text>
			</view>
			<view
				class="actionbar__btn"
				:class="{ 'actionbar__btn--off': !canSubmit }"
				@click="submit"
			>
				<text class="actionbar__btn-text">{{ submitting ? '提交中…' : '提交订单' }}</text>
			</view>
		</view>
		<view v-if="items.length" class="actionbar-spacer"></view>

		<!-- 地址选择 -->
		<view v-if="addressSheetVisible" class="sheet-mask" @click="addressSheetVisible = false">
			<view class="sheet" @click.stop>
				<view class="sheet__header">
					<text class="sheet__title">选择收货地址</text>
					<view class="sheet__close" @click="addressSheetVisible = false">
						<view class="sheet__close-line sheet__close-line--a"></view>
						<view class="sheet__close-line sheet__close-line--b"></view>
					</view>
				</view>
				<scroll-view class="sheet__body" scroll-y>
					<view
						v-for="item in addresses"
						:key="item.id"
						class="opt"
						:class="{ 'opt--active': String(item.id) === String(addressId) }"
						@click="selectAddress(item)"
					>
						<view class="opt__main">
							<view class="addr__top">
								<text class="addr__receiver">{{ item.receiver }}</text>
								<text class="addr__phone">{{ item.phone }}</text>
								<text v-if="isDefault(item)" class="addr__badge">默认</text>
							</view>
							<text class="addr__detail">{{ fullAddress(item) }}</text>
						</view>
						<view class="opt__tick" v-if="String(item.id) === String(addressId)"></view>
					</view>
					<view v-if="!addresses.length" class="sheet__empty">
						<text class="sheet__empty-text">还没有收货地址</text>
					</view>
				</scroll-view>
				<view class="sheet__footer">
					<view class="sheet__add" @click="goAddAddress">
						<text class="sheet__add-text">+ 新增收货地址</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 优惠券选择 -->
		<view v-if="couponSheetVisible" class="sheet-mask" @click="couponSheetVisible = false">
			<view class="sheet" @click.stop>
				<view class="sheet__header">
					<text class="sheet__title">选择优惠券</text>
					<view class="sheet__close" @click="couponSheetVisible = false">
						<view class="sheet__close-line sheet__close-line--a"></view>
						<view class="sheet__close-line sheet__close-line--b"></view>
					</view>
				</view>
				<scroll-view class="sheet__body" scroll-y>
					<view
						class="opt"
						:class="{ 'opt--active': !couponUserId }"
						@click="selectCoupon(null)"
					>
						<view class="opt__main">
							<text class="opt__title">不使用优惠券</text>
						</view>
						<view class="opt__tick" v-if="!couponUserId"></view>
					</view>
					<view
						v-for="opt in couponOptions"
						:key="opt.couponUserId"
						class="opt"
						:class="{ 'opt--active': String(opt.couponUserId) === String(couponUserId) }"
						@click="selectCoupon(opt)"
					>
						<view class="opt__main">
							<view class="opt__line">
								<text class="opt__amount">{{ opt.amountText }}</text>
								<text class="opt__title">{{ opt.name }}</text>
								<text v-if="opt.wasted" class="opt__tag">未达门槛</text>
							</view>
							<text class="opt__meta">
								{{ [opt.conditionText, opt.scopeText, opt.validText].filter(Boolean).join(' · ') }}
							</text>
							<text v-if="!opt.wasted" class="opt__save">
								可减 ¥{{ formatPrice(opt.discount) }}<text v-if="!opt.exact" class="opt__hint">（预估）</text>
							</text>
						</view>
						<view
							class="opt__tick"
							v-if="String(opt.couponUserId) === String(couponUserId)"
						></view>
					</view>
					<view v-if="!couponOptions.length" class="sheet__empty">
						<text class="sheet__empty-text">暂无可用优惠券</text>
					</view>
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { cartApi, addressApi, couponApi, orderApi, productApi } from '@/utils/api'
import { resolveImage, formatPrice } from '@/utils/productImage'
import { joinAddress } from '@/utils/region'
import { buildCouponOptions } from '@/utils/order'

export default {
	components: { PageHeader },
	data() {
		return {
			// 购物车页传过来的勾选行 id
			cartIds: [],
			items: [],
			loading: true,

			addresses: [],
			addressId: '',

			myCoupons: [],
			// 活动列表只用来补 useScope / maxDiscount（CouponUserVO 里没有），拿不到也不影响下单
			activityCoupons: [],
			couponUserId: '',

			remark: '',
			submitting: false,
			failedImageIds: [],

			addressSheetVisible: false,
			couponSheetVisible: false,

			// onLoad 之后 onShow 还会跑一次，用它跳过首次，避免地址查两遍
			inited: false,
		}
	},
	computed: {
		address() {
			return this.addresses.find((a) => String(a.id) === String(this.addressId)) || null
		},
		isDefaultAddress() {
			return this.address ? this.isDefault(this.address) : false
		},
		addressText() {
			return this.address ? fullAddress(this.address) : ''
		},
		goodsAmount() {
			return this.items.reduce(
				(sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
				0
			)
		},
		couponOptions() {
			return buildCouponOptions(this.myCoupons, this.activityCoupons, this.goodsAmount)
		},
		selectedCoupon() {
			if (!this.couponUserId) return null
			return (
				this.couponOptions.find((o) => String(o.couponUserId) === String(this.couponUserId)) ||
				null
			)
		},
		couponSummary() {
			if (this.selectedCoupon) {
				return `-¥${formatPrice(this.selectedCoupon.discount)}${this.selectedCoupon.exact ? '' : '（预估）'}`
			}
			return this.couponOptions.length ? `${this.couponOptions.length} 张可用` : '暂无可用'
		},
		discount() {
			return this.selectedCoupon ? this.selectedCoupon.discount : 0
		},
		payAmount() {
			// 运费固定传 0：后端把 freight 直接算进总价且不校验，前端不参与定价
			return Math.max(0, this.goodsAmount - this.discount)
		},
		hasInexactDiscount() {
			return !!this.selectedCoupon && !this.selectedCoupon.exact
		},
		canSubmit() {
			return !this.submitting && this.items.length > 0
		},
	},
	onLoad(options) {
		const raw = (options && options.cartIds) || ''
		this.cartIds = String(raw)
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean)
		this.loadItems()
		this.loadAddresses()
		this.loadCoupons()
	},
	onShow() {
		// 从新增地址页回来时要把新地址刷出来
		if (this.inited) this.loadAddresses()
		this.inited = true
	},
	methods: {
		formatPrice,
		fullAddress: joinAddress,
		/** 后端回读是布尔，兼容字符串写法（和地址列表页一致） */
		isDefault(item) {
			return item.isDefault === true || item.isDefault === 'true'
		},
		async loadItems() {
			this.loading = true
			try {
				const list = await cartApi.getList()
				const rows = Array.isArray(list) ? list : []
				// 按传过来的行 id 挑；找不到的行直接丢掉（可能已被别处删掉）
				this.items = this.cartIds
					.map((id) => rows.find((row) => String(row.id) === String(id)))
					.filter(Boolean)
			} catch (err) {
				this.items = []
				uni.showToast({ title: (err && err.message) || '商品加载失败', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		async loadAddresses() {
			try {
				const data = await addressApi.getList()
				this.addresses = Array.isArray(data) ? data.filter((a) => a && a.id != null) : []
				// 没选过就默认选中默认地址，其次第一条
				if (!this.addressId && this.addresses.length) {
					const preferred =
						this.addresses.find((a) => this.isDefault(a)) || this.addresses[0]
					this.addressId = preferred.id
				}
			} catch (err) {
				console.warn('[confirm] 地址加载失败：', err && err.message)
			}
		},
		async loadCoupons() {
			try {
				this.myCoupons = await couponApi.getMyList()
			} catch (err) {
				this.myCoupons = []
				console.warn('[confirm] 优惠券加载失败：', err && err.message)
			}
			try {
				const data = await couponApi.getActivity()
				this.activityCoupons = Array.isArray(data) ? data : []
			} catch (err) {
				// 拿不到就只影响优惠预估的准确度和范围文案，不影响下单
				this.activityCoupons = []
			}
		},
		openAddressSheet() {
			this.loadAddresses()
			this.addressSheetVisible = true
		},
		openCouponSheet() {
			this.couponSheetVisible = true
		},
		selectAddress(item) {
			this.addressId = item.id
			this.addressSheetVisible = false
		},
		selectCoupon(opt) {
			this.couponUserId = opt ? opt.couponUserId : ''
			this.couponSheetVisible = false
		},
		goAddAddress() {
			this.addressSheetVisible = false
			uni.navigateTo({ url: '/pages/address/edit' })
		},
		goBack() {
			const pages = getCurrentPages()
			if (pages.length > 1) uni.navigateBack()
			else uni.reLaunch({ url: '/pages/index/index' })
		},
		imageFor(item) {
			return resolveImage(item.productImage, item.productId, this.failedImageIds)
		},
		onImageError(item) {
			if (this.failedImageIds.indexOf(item.productId) === -1) {
				this.failedImageIds.push(item.productId)
			}
		},
		/**
		 * 价格已变动时把现价刷回来。
		 *
		 * 平时不走这条路径 —— /api/product/spec/price 是"一个商品一次请求"，
		 * 正常下单的 N+1 请求不值得。只有后端真报了「价格已变动」，
		 * 说明购物车里的价格确实过期了，这时候才逐条去查。
		 */
		async refreshPrices() {
			const results = await Promise.all(
				this.items.map(async (item) => {
					try {
						const spec = await productApi.getSpecPrice({
							productId: item.productId,
							specId: item.specId,
						})
						return { id: item.id, price: Number(spec && spec.price) }
					} catch (err) {
						return null
					}
				})
			)
			results.forEach((r) => {
				if (!r || !Number.isFinite(r.price)) return
				const item = this.items.find((i) => i.id === r.id)
				if (item) item.price = r.price
			})
			// 价格变了，优惠预估也要跟着重算（couponOptions 依赖 goodsAmount，computed 会自动更新）
			uni.showToast({ title: '价格已更新，请确认后重新提交', icon: 'none' })
		},
		async submit() {
			if (this.submitting) return
			if (!this.addressId) {
				uni.showToast({ title: '请先选择收货地址', icon: 'none' })
				return
			}
			if (!this.items.length) return

			this.submitting = true
			try {
				const dto = {
					addressId: Number(this.addressId),
					// 运费固定 0：后端把 freight 直接算进总价且不校验，定价权不放在前端
					freight: 0,
					// totalAmount 后端会重算覆盖，传过去只是走个形式
					totalAmount: Number(this.payAmount.toFixed(2)),
					remark: this.remark.trim(),
					orderItems: this.items.map((item) => ({
						productId: item.productId,
						specId: item.specId,
						quantity: item.quantity,
						// 后端会拿它和当前规格价逐分比对，必须原样传购物车里的价格
						price: item.price,
						productName: item.productName,
						productImage: item.productImage,
						specText: item.specText,
					})),
				}
				if (this.couponUserId) dto.couponUserId = this.couponUserId

				const order = await orderApi.create(dto)
				const orderNo = (order && order.orderNo) || ''

				/*
				 * 下单成功后把购物车里的这几行删掉。
				 * 后端创建订单时**不会**清购物车，这是前端补的一步，
				 * 否则下完单东西还躺在车里，用户会以为没下单成功。
				 * 删失败也不该挡着用户看订单，所以只记日志。
				 */
				try {
					await cartApi.removeBatch({ ids: this.items.map((i) => i.id) })
				} catch (err) {
					console.warn('[confirm] 清理购物车失败：', err && err.message)
				}

				uni.showToast({ title: '下单成功', icon: 'none' })
				// 用 redirectTo：订单已经建好了，不该再退回这个页面重复提交
				setTimeout(() => {
					uni.redirectTo({ url: `/pages/order/detail?orderNo=${orderNo}` })
				}, 500)
			} catch (err) {
				const message = (err && err.message) || '下单失败'
				uni.showToast({ title: message, icon: 'none' })
				// 后端的价格校验是"差一分就拒"，这时候把现价刷回来让用户重试
				if (message.indexOf('价格已变动') !== -1) {
					await this.refreshPrices()
				}
			} finally {
				this.submitting = false
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

/* ---------- 通用卡片 ---------- */
.card {
	position: relative;
	margin: 20rpx 24rpx 0;
	padding: 28rpx 24rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.card--tap {
	display: flex;
	align-items: center;
	padding-right: 48rpx;
}

.card__title {
	display: block;
	margin-bottom: 20rpx;
	font-size: 28rpx;
	font-weight: bold;
	color: #333333;
}

.card__note {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	line-height: 32rpx;
	color: #999999;
}

/* 右向箭头 */
.arrow {
	position: absolute;
	right: 28rpx;
	top: 50%;
	width: 14rpx;
	height: 14rpx;
	margin-top: -7rpx;
	box-sizing: border-box;
	border-top: 3rpx solid #cccccc;
	border-right: 3rpx solid #cccccc;
	transform: rotate(45deg);
}

/* ---------- 地址 ---------- */
.addr {
	flex: 1;
	overflow: hidden;
}

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

.addr__badge {
	margin-left: 16rpx;
	padding: 0 12rpx;
	height: 32rpx;
	border-radius: 16rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	color: #ffffff;
	font-size: 20rpx;
	line-height: 32rpx;
}

.addr__detail {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	line-height: 38rpx;
	color: #666666;
}

.addr__empty-text {
	font-size: 28rpx;
	color: #999999;
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

/* ---------- 单行（备注 / 优惠券入口） ---------- */
.line {
	/* flex:1 不能少：.card--tap 是 flex 容器，不给 .line 撑开的话
	   它只按内容宽度收缩，里面的 space-between 就没有空间可分配，
	   标签和值会挤在一起 */
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	overflow: hidden;
}

.line__label {
	flex-shrink: 0;
	font-size: 28rpx;
	color: #333333;
}

.line__right {
	display: flex;
	align-items: center;
	overflow: hidden;
}

.line__value {
	font-size: 26rpx;
	color: #999999;
}

.line__value--accent {
	color: #ff6b35;
	font-weight: bold;
}

.line__input {
	flex: 1;
	margin-left: 24rpx;
	height: 48rpx;
	font-size: 28rpx;
	color: #333333;
	text-align: right;
}

.line__placeholder {
	font-size: 26rpx;
	color: #cccccc;
}

/* ---------- 金额 ---------- */
.row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	padding: 12rpx 0;
}

.row__label {
	font-size: 26rpx;
	color: #999999;
}

.row__value {
	font-size: 26rpx;
	color: #333333;
}

.row__value--cut {
	color: #ff6b35;
}

.row__hint {
	font-size: 22rpx;
	color: #999999;
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

/* ---------- 底部提交栏 ---------- */
.actionbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16rpx 24rpx;
	background-color: #ffffff;
	box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
	padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
	padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.actionbar__sum {
	display: flex;
	align-items: baseline;
	overflow: hidden;
}

.actionbar__sum-label {
	font-size: 26rpx;
	color: #333333;
}

.actionbar__sum-price {
	margin-left: 8rpx;
	font-size: 38rpx;
	font-weight: bold;
	color: #ff6b35;
}

.actionbar__sum-symbol {
	font-size: 26rpx;
}

.actionbar__btn {
	flex-shrink: 0;
	padding: 0 48rpx;
	height: 84rpx;
	border-radius: 42rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 8rpx 20rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.actionbar__btn--off {
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

/* ---------- 底部弹层（地址 / 优惠券） ---------- */
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

.sheet__body {
	max-height: 640rpx;
	padding: 0 24rpx;
}

.sheet__empty {
	padding: 80rpx 0;
	text-align: center;
}

.sheet__empty-text {
	font-size: 28rpx;
	color: #999999;
}

.sheet__footer {
	padding: 16rpx 24rpx 24rpx;
}

.sheet__add {
	height: 84rpx;
	border-radius: 42rpx;
	border: 2rpx solid #ff6b35;
	display: flex;
	align-items: center;
	justify-content: center;
}

.sheet__add-text {
	font-size: 28rpx;
	font-weight: bold;
	color: #ff6b35;
}

/* 弹层里的选项行 */
.opt {
	display: flex;
	align-items: center;
	padding: 24rpx 0;
	border-bottom: 2rpx solid #f0f0f0;
}

.opt:last-child {
	border-bottom: none;
}

.opt__main {
	flex: 1;
	overflow: hidden;
}

.opt__line {
	display: flex;
	align-items: center;
}

.opt__amount {
	flex-shrink: 0;
	margin-right: 12rpx;
	font-size: 28rpx;
	font-weight: bold;
	color: #ff6b35;
}

.opt__title {
	font-size: 28rpx;
	color: #333333;
}

.opt__tag {
	margin-left: 12rpx;
	padding: 0 12rpx;
	height: 32rpx;
	border-radius: 16rpx;
	background-color: #f5f5f5;
	font-size: 20rpx;
	line-height: 32rpx;
	color: #999999;
}

.opt__meta {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: #999999;
}

.opt__save {
	display: block;
	margin-top: 6rpx;
	font-size: 24rpx;
	color: #ff6b35;
}

.opt__hint {
	font-size: 22rpx;
	color: #999999;
}

/* 选中打勾 */
.opt__tick {
	width: 18rpx;
	height: 32rpx;
	flex-shrink: 0;
	margin-left: 20rpx;
	box-sizing: border-box;
	border-right: 4rpx solid #ff6b35;
	border-bottom: 4rpx solid #ff6b35;
	transform: rotate(45deg);
}

.opt--active .opt__title {
	color: #ff6b35;
	font-weight: bold;
}
</style>
