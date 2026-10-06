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

export const categoryApi = {
  /**
   * 分类树 GET /api/category/tree
   * 返回一级分类数组，每个节点带 children（二级分类）。
   * 注意：该接口需要登录态，无 token 会返回 401。
   */
  getTree() {
    return request({ url: '/api/category/tree', method: 'GET' })
  },
}

export const productApi = {
  /**
   * 按分类查商品 GET /api/product/category/list
   * 返回 { cursorCommonEntity: { sortType, sortValue, sortId, querySize }, list, isEnd }
   *
   * isFirstCategoryId 是**必填**参数：传 true 时后端会把该一级分类下所有
   * 子分类的商品一并返回（自己做了下钻）。
   * 漏传不会报错，而是**静默返回空列表**（HTTP 200 + list: []），
   * 所以这个参数务必带上，否则看起来就像"这个分类没有商品"。
   */
  getByCategory({
    categoryId,
    isFirstCategoryId = true,
    sortType = 'default',
    querySize = 20,
    sortId,
  } = {}) {
    const data = { sortType, categoryId, isFirstCategoryId, querySize }
    if (sortId != null) data.sortId = sortId
    return request({ url: '/api/product/category/list', method: 'GET', data })
  },

  /**
   * 无限滚动商品流 GET /api/product/scroll/query/list
   * 返回 { simpleCursorCommonEntity: { sortValue, sortId, querySize }, list, isEnd }
   * 翻页：把上一页返回的 sortId 作为下一次的 beginId。
   * 注意 isEnd 只有在「返回条数 < querySize」时才为 true，
   * 拿到满页时仍是 false，所以还要用 list 为空作为终止条件。
   */
  getScrollList({ beginId = 0, querySize = 10 } = {}) {
    return request({ url: '/api/product/scroll/query/list', method: 'GET', data: { beginId, querySize } })
  },
}

export const bannerApi = {
  /** 首页轮播图 GET /api/banner/list，返回 [{ id, title, imageUrl, linkUrl, sort, status }] */
  getList() {
    return request({ url: '/api/banner/list', method: 'GET' })
  },
}
