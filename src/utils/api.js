import { request } from './request'

export { BASE_URL } from './request'

/**
 * 后端接口
 *
 * 说明：刷新令牌（POST /api/user/refresh/token）由 request.js 的 401 拦截逻辑
 * 内部调用，不在这里暴露 —— 否则 api.js 与 request.js 会互相 import 形成循环依赖。
 */
export const userApi = {
  /** 账号登录 POST /api/user/login/account，返回 { accessToken, refreshToken, userInfo } */
  loginByAccount({ username, password }) {
    return request({
      url: '/api/user/login/account',
      method: 'POST',
      data: { username, password },
    })
  },

  /** 用户详情 GET /api/user/detail/get */
  getUserDetail() {
    return request({ url: '/api/user/detail/get', method: 'GET' })
  },
}
