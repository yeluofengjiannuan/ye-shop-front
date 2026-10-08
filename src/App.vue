<script>
import { useUserStore } from '@/store/modules/user'
import { useCartStore } from '@/store/modules/cart'
import { useChatStore } from '@/store/modules/chat'

const LOGIN_PAGE = '/pages/login/login'
// 未登录也能访问的页面白名单
const WHITE_LIST = [LOGIN_PAGE]
// 需要拦截的跳转 API
const NAV_APIS = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab']

/** 把 '/pages/a/b?x=1' 归一化成 '/pages/a/b' */
function normalizePath(url) {
	return '/' + String(url || '').replace(/^\//, '').split('?')[0]
}

export default {
	onLaunch: function () {
		console.log('App Launch')
		const userStore = useUserStore()
		const cartStore = useCartStore()
		const chatStore = useChatStore()

		// 1) 冷启动兜底：没有 token 直接送登录页
		if (!userStore.isLogin) {
			uni.reLaunch({ url: LOGIN_PAGE })
		} else {
			// 已登录：先把购物车拉起来，导航栏角标才不会一进来就是 0
			cartStore.load()
			// 聊天连接也建起来，别等到进消息页才连（那样收不到任何推送）
			chatStore.connect()
			// 角色决定消息入口显示成「消息」还是「客服工作台」，只在没缓存时查一次
			if (!userStore.sysRoleList.length) userStore.loadRoles()
		}

		// user.js 的 setUserInfo / logout 里已经 emit 了这两个事件，
		// 购物车和聊天跟着登录态走，避免换账号后角标串号、连接串人
		uni.$on('userLogin', () => {
			cartStore.load()
			chatStore.connect()
			userStore.loadRoles()
		})
		uni.$on('userLogout', () => {
			cartStore.reset()
			chatStore.reset()
		})

		// 2) 路由拦截。只做 onLaunch 只能拦住冷启动，
		//    页面内的 navigateTo/redirectTo 等必须在拦截器里才能兜住。
		NAV_APIS.forEach((api) => {
			uni.addInterceptor(api, {
				invoke(args) {
					const store = useUserStore()
					if (store.isLogin) return true
					if (WHITE_LIST.indexOf(normalizePath(args.url)) !== -1) return true
					// 未登录：取消本次跳转，改送登录页。
					// 这里是 reLaunch 到白名单页面，不会再触发拦截，不会死循环。
					uni.reLaunch({ url: LOGIN_PAGE })
					return false
				},
			})
		})
	},
	onShow: function () {
		console.log('App Show')
	},
	onHide: function () {
		console.log('App Hide')
	},
}
</script>

<style>
/*每个页面公共css */
</style>
