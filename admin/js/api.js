// API 调用封装
const api = {
  async call(action, params = {}) {
    try {
      const res = await fetch(CONFIG.FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });
      return await res.json();
    } catch (e) {
      return { success: false, message: '网络连接失败' };
    }
  },

  // 激活码相关
  async generateCodes(count, note) {
    return this.call('generate', { count, note });
  },

  async queryCodes() {
    return this.call('query', {});
  },

  async banCode(code) {
    return this.call('ban', { code, adminToken: CONFIG.DEV_CODE });
  },

  async unbanCode(code) {
    return this.call('unban', { code, adminToken: CONFIG.DEV_CODE });
  },

  // 重置设备绑定
  async resetDevice(code) {
    return this.call('reset_device', { code });
  },

  // 数据看板
  async getDashboard() {
    return this.call('admin_dashboard', {});
  },

  // 用户列表
  async getUsers() {
    return this.call('admin_users', {});
  },

  // 用户详情
  async getUserDetail(code) {
    return this.call('admin_user_detail', { code });
  },

  // 用户笔记
  async getUserNotes(code) {
    return this.call('admin_user_notes', { code });
  },

  // 排行榜（管理员模式）
  async getLeaderboard(type = 'total') {
    return this.call('get_leaderboard', { type, adminToken: CONFIG.DEV_CODE });
  },
};
