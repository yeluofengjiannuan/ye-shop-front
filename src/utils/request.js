import { useUserStore } from '@/store/modules/user'

/** 全局请求地址 */
export const BASE_URL = 'http://localhost:8080'

/**
 * 不需要携带 Authorization 的接口白名单
 * 注意：刷新令牌接口必须在这里，否则刷新请求自己带个过期 token 出去，必然 401
 */
const AUTH_WHITELIST = ['/api/user/login/account', '/api/user/refresh/token']

/** 取出请求路径（去掉 BASE_URL 和 query），用于白名单匹配 */
function toPath(url) {
  return String(url || '').replace(BASE_URL, '').split('?')[0]
}

function isWhitelisted(url) {
  return AUTH_WHITELIST.indexOf(toPath(url)) !== -1
}

/* ---------------- 刷新令牌的并发控制 ---------------- */
// 多个接口同时 401 时，只允许一个刷新请求在途，其余挂起等结果
let isRefreshing = false
let waiters = []

function flushWaiters(error) {
  const pending = waiters
  waiters = []
  pending.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()))
}

/* ---------------- 底层请求 ---------------- */

/** 发原始请求，只负责发出去和收回来，不做业务判断和状态处理 */
function rawRequest({ url, method = 'GET', data, header = {} }) {
  return new Promise((resolve, reject) => {
    const finalHeader = { 'Content-Type': 'application/json', ...header }

    // 非白名单接口统一带上 token
    if (!isWhitelisted(url)) {
      const { token } = useUserStore()
      if (token) finalHeader.Authorization = `Bearer ${token}`
    }

    uni.request({
      url: BASE_URL + url,
      method,
      data,
      header: finalHeader,
      success: resolve,
      fail: (err) => reject(new Error((err && err.errMsg) || '网络异常，请稍后重试')),
    })
  })
}

/** 调用刷新接口换新 token，返回 { accessToken, refreshToken } */
async function doRefresh() {
  const { refreshToken } = useUserStore()
  if (!refreshToken) throw new Error('缺少 refreshToken，无法刷新登录状态')

  const res = await rawRequest({
    url: `/api/user/refresh/token?refreshToken=${encodeURIComponent(refreshToken)}`,
    method: 'POST',
  })

  const body = res.data
  if (res.statusCode !== 200 || !body || body.success !== true || !body.data) {
    throw new Error((body && body.message) || '刷新登录状态失败')
  }
  return body.data
}

/** 处理 401：刷新令牌 + 重放原请求 */
async function handle401(options) {
  const userStore = useUserStore()

  // 已经重试过一次还是 401，说明刷新救不回来，直接登出，避免无限递归
  if (options._retried) {
    userStore.logout()
    throw new Error('登录状态已失效，请重新登录')
  }

  // 已有刷新在途：挂起本次请求，等刷新完再重放
  if (isRefreshing) {
    await new Promise((resolve, reject) => waiters.push({ resolve, reject }))
    return request({ ...options, _retried: true })
  }

  isRefreshing = true
  try {
    const tokens = await doRefresh()
    // 先落库新 token，再唤醒等待者，保证它们重放时拿到的是新 token
    userStore.setTokens(tokens)
    flushWaiters(null)
    return request({ ...options, _retried: true })
  } catch (err) {
    flushWaiters(err)
    userStore.logout()
    throw err
  } finally {
    isRefreshing = false
  }
}

/**
 * 业务请求入口
 * 成功时直接返回后端的 data 字段，失败时抛出 Error(message)
 */
export async function request(options) {
  const res = await rawRequest(options)
  const { statusCode, data: body } = res

  // Token 过期，走刷新流程
  if (statusCode === 401) {
    return handle401(options)
  }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error((body && body.message) || `请求失败（HTTP ${statusCode}）`)
  }

  // 成功与否以后端的 success 字段为准，不看 code
  if (body && body.success === true) {
    return body.data
  }

  throw new Error((body && body.message) || '请求失败')
}
