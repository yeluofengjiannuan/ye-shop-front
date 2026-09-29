/**
 * 接口层
 *
 * 后端尚未就绪，先用 USE_MOCK 把前端流程跑通。
 * 后端好了之后把 USE_MOCK 改成 false 即可，业务代码一行都不用动。
 */
export const USE_MOCK = true

// 接口基础域名。不同环境区分时在这里改
const BASE_URL = ''

/**
 * 统一请求封装
 * 约定后端返回 { code, message, data }，code === 0 或 200 视为成功。
 * 若后端直接返回裸数据（不带 code 包装），也兼容。
 */
function request({ url, method = 'GET', data, header = {} }) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method,
      data,
      header: { 'Content-Type': 'application/json', ...header },
      success: (res) => {
        const { statusCode, data: body } = res
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`请求失败（HTTP ${statusCode}）`))
          return
        }
        if (body && typeof body === 'object' && 'code' in body) {
          if (body.code === 0 || body.code === 200) {
            resolve(body.data)
          } else {
            reject(new Error(body.message || body.msg || '请求失败'))
          }
          return
        }
        resolve(body)
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || '网络异常，请稍后重试'))
      },
    })
  })
}

/** mock 用：模拟网络延迟，让 loading 态可见 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function mockLoginByAccount({ username, password }) {
  await delay(600)
  if (!username || !password) {
    throw new Error('请输入账号和密码')
  }
  // 约定：账号填 error 时模拟登录失败，方便验证失败分支
  if (username === 'error') {
    throw new Error('账号或密码错误')
  }
  return {
    accessToken: `mock-token-${Date.now()}`,
    refreshToken: `mock-refresh-${Date.now()}`,
    userInfo: {
      id: 1001,
      nickname: username,
      username,
      avatar: '',
      role: 'USER',
      isEnterprise: false,
    },
  }
}

export const userApi = {
  /** 账号密码登录：POST /api/user/login/account */
  loginByAccount(params) {
    if (USE_MOCK) return mockLoginByAccount(params)
    return request({ url: '/api/user/login/account', method: 'POST', data: params })
  },
}
