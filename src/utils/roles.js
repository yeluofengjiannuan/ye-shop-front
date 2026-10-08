/**
 * 角色与权限判断。
 *
 * 单独放一个文件、**不引任何东西**，是为了避开循环依赖：
 * store/modules/user.js 需要这里的判断，而 user.js 又被 utils/request.js 引用，
 * 如果把这些函数放进 utils/chat.js（它引了 request.js），
 * 就会绕成 user.js → chat.js → request.js → user.js。
 */

/**
 * 是不是超级管理员。
 *
 * 只看 sysRoleList，**不看 sysUser.userType** ——
 * admin 账号的 userType 一度是 3（普通买家）而角色却是 ROLE_ADMIN，两者不一致。
 *
 * roleCode 里还出现过前导空格（`" ROLE_ADMIN"`），所以统一 trim 再比。
 */
export function isAdminByRoles(sysRoleList) {
	return (sysRoleList || []).some((role) => roleCodeOf(role) === 'ROLE_ADMIN')
}

export function roleCodeOf(role) {
	return String((role && role.roleCode) || '').trim()
}

/** 有没有某个权限码（后端 sysPermissionList[].permCode） */
export function hasPermission(sysPermissionList, permCode) {
	return (sysPermissionList || []).some(
		(perm) => String((perm && perm.permCode) || '').trim() === permCode
	)
}
