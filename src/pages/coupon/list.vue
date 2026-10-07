<template>
	<view class="page">
		<PageHeader title="优惠券" />

		<!-- tab -->
		<view class="tabs">
			<view
				class="tab"
				:class="{ 'tab--active': tab === 'available' }"
				@click="switchTab('available')"
			>
				<text class="tab__text">可领取</text>
			</view>
			<view
				class="tab"
				:class="{ 'tab--active': tab === 'mine' }"
				@click="switchTab('mine')"
			>
				<text class="tab__text">我的券</text>
			</view>
		</view>

		<!-- ---------- 可领取 ---------- -->
		<template v-if="tab === 'available'">
			<view v-if="activityLoading" class="status">
				<text class="status__text">加载中…</text>
			</view>

			<view v-else-if="activityFailed" class="status">
				<text class="status__text">优惠券活动加载失败</text>
				<view class="status__btn" @click="loadActivity">
					<text class="status__btn-text">重新加载</text>
				</view>
			</view>

			<view v-else-if="!availableCoupons.length" class="status">
				<text class="status__text">暂无可领取的优惠券</text>
			</view>

			<view v-else class="list">
				<CouponCard
					v-for="item in availableCoupons"
					:key="item.id"
					:coupon="item"
					:action="actionFor(item)"
					:busy="receivingIds.indexOf(item.id) !== -1"
					@receive="receive"
				/>
				<text class="list__tip">每人每券限领一次，领取后可在「我的券」查看</text>
			</view>
		</template>

		<!-- ---------- 我的券 ---------- -->
		<template v-else>
			<view v-if="mineLoading" class="status">
				<text class="status__text">加载中…</text>
			</view>

			<view v-else-if="mineFailed" class="status">
				<text class="status__text">优惠券加载失败</text>
				<view class="status__btn" @click="loadMine">
					<text class="status__btn-text">重新加载</text>
				</view>
			</view>

			<view v-else-if="!myCoupons.length" class="status">
				<text class="status__text">还没有领过优惠券</text>
				<view class="status__btn" @click="switchTab('available')">
					<text class="status__btn-text">去领券</text>
				</view>
			</view>

			<view v-else class="list">
				<CouponCard v-for="item in myCoupons" :key="item.couponUserId" :coupon="item" />
			</view>
		</template>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import CouponCard from '@/components/CouponCard.vue'
import { couponApi } from '@/utils/api'
import { normalizeActivity, normalizeMine } from '@/utils/coupon'

export default {
	components: { PageHeader, CouponCard },
	data() {
		return {
			tab: 'available',

			activity: [],
			activityLoading: true,
			activityFailed: false,

			myList: [],
			mineLoading: true,
			mineFailed: false,

			/*
			 * 本次会话领过的券 id。为什么要它：
			 * showCouponUserList 只返回 unusedCount>0 || lockedCount>0 的记录，
			 * 一张券用完之后会从 myList 里消失，可领取 tab 的按钮就会翻回「领取」，
			 * 点下去只能拿到后端的「优惠券已领取」。
			 *
			 * 只放页面本地，不落 storage 也不进 store：myList 才是权威来源，
			 * 把本地猜测持久化反而会和服务端打架；页面本地也天生不会串账号。
			 */
			claimedIds: [],
			// 领取请求在途的券 id，防连点
			receivingIds: [],
		}
	},
	computed: {
		/** 我的券：正常展示，后端只给"还能用"的那些 */
		myCoupons() {
			return this.myList.map(normalizeMine)
		},
		/** 已领取的券 id = 服务端的 myList ∪ 本次会话领过的 */
		claimedIdSet() {
			const ids = this.myList.map((item) => item.couponId).concat(this.claimedIds)
			return ids.filter((id, index) => ids.indexOf(id) === index)
		},
		/**
		 * 可领取列表。
		 *
		 * 两道过滤都是必需的：
		 * - 过期：/api/coupon/activity 只按 status + releaseTime 筛，不筛 validEnd，
		 *   实测线上 5 张里有 2 张 validEnd 早就过了还挂在 ON_SHELF 上，
		 *   照原样渲染用户能点，一点就是「活动已结束」。
		 * - 已领取：后端没有任何"是否已领"的标记，只能拿 myList 交叉比对。
		 */
		availableCoupons() {
			return this.activity
				.map(normalizeActivity)
				.filter((item) => !item.expired)
				.filter((item) => this.claimedIdSet.indexOf(item.id) === -1)
		},
	},
	onLoad(options) {
		// 个人中心的「我的优惠券」直接落在第二个 tab
		if (options && options.tab === 'mine') this.tab = 'mine'
		this.loadActivity()
		this.loadMine()
	},
	methods: {
		async loadActivity() {
			this.activityLoading = true
			this.activityFailed = false
			try {
				const data = await couponApi.getActivity()
				this.activity = Array.isArray(data) ? data : []
			} catch (err) {
				this.activity = []
				this.activityFailed = true
				uni.showToast({ title: (err && err.message) || '优惠券活动加载失败', icon: 'none' })
			} finally {
				this.activityLoading = false
			}
		},
		async loadMine() {
			this.mineLoading = true
			this.mineFailed = false
			try {
				// getMyList 已经在 api 层把「空列表不返回 data 字段」兜成 []
				this.myList = await couponApi.getMyList()
			} catch (err) {
				this.myList = []
				this.mineFailed = true
				uni.showToast({ title: (err && err.message) || '优惠券加载失败', icon: 'none' })
			} finally {
				this.mineLoading = false
			}
		},
		switchTab(tab) {
			this.tab = tab
			// 切回来时刷一次，保证在别处领的券能看到
			if (tab === 'mine') this.loadMine()
		},
		/** 余量为 0 的券保留在列表里但按钮置灰 —— 券凭空消失比「已领完」更难理解 */
		actionFor(coupon) {
			return coupon.remaining !== null && coupon.remaining <= 0 ? 'soldout' : 'receive'
		},
		async receive(coupon) {
			if (this.receivingIds.indexOf(coupon.id) !== -1) return

			// perUserQty 是后端逐字比对的必填量，缺失或非法时发了也必然被拒
			if (!coupon.perUserQty || coupon.perUserQty <= 0) {
				uni.showToast({ title: '该券配置异常，暂时无法领取', icon: 'none' })
				return
			}

			this.receivingIds.push(coupon.id)
			try {
				// quantity 必须精确等于这张券的 perUserQty，后端 CouponServiceImpl 里是
				// !quantity.equals(coupon.getPerUserQty()) 直接拒绝，传错只报「数量异常」
				await couponApi.receive({ couponId: coupon.id, quantity: coupon.perUserQty })
				this.claimedIds.push(coupon.id)
				uni.showToast({ title: '领取成功', icon: 'none' })

				/*
				 * 不乐观地把券塞进 myCoupons：领取是 MQ 异步落库，
				 * receive 接口发完消息就返回成功，本地先塞进去和服务端对不上，刷新就穿帮。
				 * 按钮状态靠 claimedIds 翻转就够了。
				 *
				 * 延迟一下再拉，是因为消费者写库要一点时间，立刻拉多半还是空列表。
				 */
				setTimeout(() => this.loadMine(), 1200)
			} catch (err) {
				// 后端文案本身就很准：「优惠券已领取」「库存不足」「活动已结束」
				uni.showToast({ title: (err && err.message) || '领取失败', icon: 'none' })
			} finally {
				this.receivingIds = this.receivingIds.filter((id) => id !== coupon.id)
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
	display: flex;
	height: 88rpx;
	background-color: #ffffff;
	border-bottom: 2rpx solid #f0f0f0;
}

.tab {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
}

.tab__text {
	font-size: 28rpx;
	color: #666666;
}

.tab--active .tab__text {
	color: #ff6b35;
	font-weight: bold;
}

/* 选中下划线 */
.tab--active::after {
	content: '';
	position: absolute;
	left: 50%;
	bottom: 0;
	width: 56rpx;
	height: 6rpx;
	margin-left: -28rpx;
	border-radius: 3rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
}

.list {
	padding: 20rpx 24rpx 0;
}

.list__tip {
	display: block;
	padding: 12rpx 0 24rpx;
	text-align: center;
	font-size: 22rpx;
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
</style>
