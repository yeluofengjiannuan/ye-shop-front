<script>
import { useUserStore } from '@/store/modules/user'

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

		// 1) 冷启动兜底：没有 token 直接送登录页
		if (!userStore.isLogin) {
			uni.reLaunch({ url: LOGIN_PAGE })
		}

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
