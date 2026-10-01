// 主应用逻辑
const app = {
  // 登录
  init() {
    // 检查登录状态
    if (sessionStorage.getItem('admin_logged_in') === '1') {
      this.showAdmin();
    }

    // 登录按钮
    document.getElementById('loginBtn').addEventListener('click', () => this.login());
    document.getElementById('devCode').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.login();
    });

    // 退出
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.refreshData();
      document.getElementById('refreshBtn').querySelector('span:last-child').textContent = '刷新中...';
      setTimeout(() => {
        document.getElementById('refreshBtn').querySelector('span:last-child').textContent = '刷新数据';
      }, 1000);
    });

    // 移动端菜单
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('show');
    });

    // 点击遮罩关闭侧边栏
    document.getElementById('sidebarOverlay').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('show');
    });

    // 导航切换
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        this.switchPage(page);
        document.querySelector('.sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('show');
      });
    });

    // 排行榜 tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadLeaderboard(btn.dataset.type);
      });
    });

    // 生成激活码
    document.getElementById('generateBtn').addEventListener('click', () => this.generateCodes());

    // 发布通知
    document.getElementById('publishNotifBtn').addEventListener('click', () => this.publishNotification());

    // 搜索
    document.getElementById('userSearch').addEventListener('input', (e) => this.filterUsers(e.target.value));
    document.getElementById('codeSearch').addEventListener('input', (e) => this.filterCodes(e.target.value));
  },

  login() {
    const code = document.getElementById('devCode').value.trim();
    const errorEl = document.getElementById('loginError');
    
    if (code === CONFIG.DEV_CODE) {
      sessionStorage.setItem('admin_logged_in', '1');
      this.showAdmin();
    } else {
      errorEl.textContent = '激活码错误，请重新输入';
    }
  },

  logout() {
    sessionStorage.removeItem('admin_logged_in');
    location.reload();
  },

  // 前端缓存（60秒），避免频繁切换 tab 重复请求
  cache: {},
  CACHE_TTL: 60 * 1000,

  getCached(key, fetchFn) {
    const now = Date.now();
    if (this.cache[key] && now - this.cache[key].time < this.CACHE_TTL) {
      return this.cache[key].data;
    }
    const promise = fetchFn().then(data => {
      this.cache[key] = { time: now, data };
      return data;
    });
    this.cache[key] = { time: now, data: promise };
    return promise;
  },

  showAdmin() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('adminPage').classList.remove('hidden');
    this.loadDashboard();
  },

  switchPage(page) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    if (page === 'dashboard') this.loadDashboard();
    if (page === 'users') this.loadUsers();
    if (page === 'codes') this.loadCodes();
    if (page === 'leaderboard') this.loadLeaderboard('total');
    if (page === 'notifications') this.loadNotifications();
  },

  async refreshData() {
    // 手动刷新时清空缓存
    this.cache = {};
    const activePage = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
    this.switchPage(activePage);
  },

  // ========== 数据看板 ==========
  async loadDashboard() {
    const result = await this.getCached('dashboard', () => api.getDashboard());
    if (result.success) {
      document.getElementById('statTotalUsers').textContent = result.totalUsers || 0;
      document.getElementById('statTodayActive').textContent = result.todayActive || 0;
      document.getElementById('statTotalAnswers').textContent = (result.totalAnswers || 0).toLocaleString();
      document.getElementById('statAvgAccuracy').textContent = (result.avgAccuracy || 0) + '%';
    } else {
      document.getElementById('statTotalUsers').textContent = '-';
      document.getElementById('statTodayActive').textContent = '-';
      document.getElementById('statTotalAnswers').textContent = '-';
      document.getElementById('statAvgAccuracy').textContent = '-';
    }

    // 数据看板只显示前10个用户，用缓存的用户数据，不单独请求
    const usersResult = await this.getCached('users', () => api.getUsers());
    if (usersResult.success) {
      const users = usersResult.users || [];
      this.renderUserTable('dashboardUserTable', users.slice(0, 10));
    } else {
      document.getElementById('dashboardUserTable').innerHTML = 
        '<tr class="empty-row"><td colspan="7" class="text-center text-gray-400">暂无数据</td></tr>';
    }
  },

  // ========== 用户管理 ==========
  async loadUsers() {
    const result = await this.getCached('users', () => api.getUsers());
    if (result.success) {
      this.allUsers = result.users || [];
      this.renderUserTable('userTableBody', this.allUsers, true);
    } else {
      document.getElementById('userTableBody').innerHTML = 
        '<tr class="empty-row"><td colspan="8" class="text-center text-gray-400">请先部署后端接口</td></tr>';
    }
  },

  filterUsers(keyword) {
    const filtered = (this.allUsers || []).filter(u => u.code.toLowerCase().includes(keyword.toLowerCase()));
    this.renderUserTable('userTableBody', filtered, true);
  },

  renderUserTable(tbodyId, users, showToday = false) {
    const tbody = document.getElementById(tbodyId);
    if (!users.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8" class="text-center text-gray-400">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(u => {
      const total = u.totalAnswered || u.total || 0;
      const accuracy = u.accuracy || 0;
      const streak = u.streak || 0;
      const lastActive = u.lastActive || '-';
      const today = u.todayAnswered !== undefined ? u.todayAnswered : (u.today || 0);
      const statusMap = {
        normal: '<span class="status-badge status-normal">正常</span>',
        banned: '<span class="status-badge status-banned">封禁</span>',
        inactive: '<span class="status-badge status-inactive">未活跃</span>',
      };
      const statusCol = u.status ? `<td data-label="状态">${statusMap[u.status] || ''}</td>` : 
        (u.hasStudyData === false ? '<td data-label="状态"><span class="status-badge status-inactive">暂无数据</span></td>' : '<td data-label="状态">-</td>');
      const todayCell = showToday ? `<td data-label="今日答题">${today}</td>` : '';
      return `<tr>
        <td data-label="激活码"><code>${u.code}</code></td>
        <td data-label="累计答题">${total.toLocaleString()}</td>
        <td data-label="正确率">${accuracy}%</td>
        <td data-label="连续打卡">${streak}天</td>
        ${todayCell}
        <td data-label="最后活跃">${lastActive}</td>
        ${statusCol}
        <td data-label="操作"><button class="btn-action btn-primary" onclick="app.showUserNotes('${u.code}')">笔记</button></td>
      </tr>`;
    }).join('');
  },

  // ========== 激活码管理 ==========
  async generateCodes() {
    const count = parseInt(document.getElementById('genCount').value) || 1;
    const note = document.getElementById('genNote').value || '';
    
    const result = await api.generateCodes(count, note);
    const container = document.getElementById('generatedCodes');
    
    if (result.success && result.codes) {
      container.innerHTML = '<p style="margin-bottom:10px;font-weight:600;">生成成功：</p>' +
        result.codes.map(c => `<div class="code-item"><span>${c}</span><button class="btn-action btn-warning" onclick="navigator.clipboard.writeText('${c}')">复制</button></div>`).join('');
      this.loadCodes();
    } else {
      container.innerHTML = `<p style="color:#ef4444;">生成失败：${result.message || '未知错误'}</p>`;
    }
  },

  async loadCodes() {
    const result = await api.queryCodes();
    if (result.success) {
      const codes = (result.codes || []).map(c => ({
        code: c.code,
        status: c.status === 'active' ? 'normal' : (c.status || (c.used ? 'normal' : 'unused')),
        activatedAt: c.activatedAt ? (typeof c.activatedAt === 'string' ? c.activatedAt.slice(0, 10) : new Date(c.activatedAt).toISOString().slice(0, 10)) : '-',
        deviceId: c.deviceId || '-',
      }));
      this.allCodes = codes;
      this.renderCodeTable(codes);
    } else {
      document.getElementById('codeTableBody').innerHTML = 
        '<tr class="empty-row"><td colspan="5" class="text-center text-gray-400">加载失败，请重试</td></tr>';
    }
  },

  filterCodes(keyword) {
    const filtered = (this.allCodes || []).filter(c => c.code.toLowerCase().includes(keyword.toLowerCase()));
    this.renderCodeTable(filtered);
  },

  renderCodeTable(codes) {
    const tbody = document.getElementById('codeTableBody');
    if (!codes.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5" class="text-center text-gray-400">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = codes.map(c => {
      const statusMap = {
        normal: '<span class="status-badge status-normal">正常</span>',
        banned: '<span class="status-badge status-banned">封禁</span>',
        unused: '<span class="status-badge status-inactive">未使用</span>',
      };
      const banBtn = c.status === 'banned' 
        ? `<button class="btn-action btn-warning" onclick="app.unbanCode('${c.code}')">解封</button>`
        : c.status === 'unused' 
          ? '' 
          : `<button class="btn-action btn-danger" onclick="app.banCode('${c.code}')">封禁</button>`;
      const resetBtn = c.deviceId !== '-' 
        ? `<button class="btn-action btn-warning" onclick="app.resetDevice('${c.code}')">重置设备</button>`
        : '';
      return `<tr>
        <td data-label="激活码"><code>${c.code}</code></td>
        <td data-label="状态">${statusMap[c.status] || ''}</td>
        <td data-label="激活时间">${c.activatedAt}</td>
        <td data-label="设备ID">${c.deviceId}</td>
        <td data-label="操作">
          ${banBtn}
          ${resetBtn}
        </td>
      </tr>`;
    }).join('');
  },

  async banCode(code) {
    if (confirm(`确定封禁激活码 ${code} 吗？`)) {
      const result = await api.banCode(code);
      if (result.success) {
        alert('已封禁');
      } else {
        alert(result.message || '封禁失败');
      }
      this.loadCodes();
    }
  },

  async unbanCode(code) {
    if (confirm(`确定解封激活码 ${code} 吗？`)) {
      const result = await api.unbanCode(code);
      if (result.success) {
        alert('已解封');
      } else {
        alert(result.message || '解封失败');
      }
      this.loadCodes();
    }
  },

  async resetDevice(code) {
    if (confirm(`确定重置激活码 ${code} 的设备绑定吗？\n用户可以在新设备上重新激活。`)) {
      const result = await api.resetDevice(code);
      if (result.success) {
        alert(result.message);
      } else {
        alert(result.message || '重置失败');
      }
    }
  },

  // ========== 排行榜 ==========
  async loadLeaderboard(type) {
    const tbody = document.getElementById('lbTableBody');
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6" style="text-align:center;padding:20px;color:#999;">加载中...</td></tr>';

    const res = await this.getCached(`leaderboard_${type}`, () => api.getLeaderboard(type));
    if (!res.success || !res.leaderboard) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6" style="text-align:center;padding:20px;color:#999;">${res.message || '暂无数据'}</td></tr>`;
      return;
    }

    const list = res.leaderboard;
    if (list.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6" style="text-align:center;padding:20px;color:#999;">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((u, i) => {
      const rank = i + 1;
      const medal = rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank;
      return `<tr>
        <td data-label="排名">${medal}</td>
        <td data-label="昵称">${u.nickname}</td>
        <td data-label="积分"><strong>${u.score.toLocaleString()}</strong></td>
        <td data-label="累计答题">${u.totalAnswered.toLocaleString()}</td>
        <td data-label="正确率">${u.accuracy}%</td>
        <td data-label="连续打卡">${u.streak}天</td>
      </tr>`;
    }).join('');
  },

  // 弹窗
  closeModal() {
    document.getElementById('userDetailModal').classList.add('hidden');
  },

  // ========== 查看用户笔记 ==========
  async showUserNotes(code) {
    const modal = document.getElementById('notesModal');
    const body = document.getElementById('notesBody');
    document.getElementById('notesUserCode').textContent = `（${code}）`;
    modal.classList.remove('hidden');
    body.innerHTML = '<p style="text-align:center;padding:30px;color:#999;">加载中...</p>';

    const res = await api.getUserNotes(code);
    if (!res.success) {
      body.innerHTML = `<p style="text-align:center;padding:30px;color:#999;">${res.message || '加载失败'}</p>`;
      return;
    }

    const qNotes = res.questionNotes || [];
    const cNotes = res.customNotes || [];

    if (qNotes.length === 0 && cNotes.length === 0) {
      body.innerHTML = '<p style="text-align:center;padding:30px;color:#999;">该用户暂无笔记</p>';
      return;
    }

    let html = '';

    // 题目笔记
    if (qNotes.length > 0) {
      html += `<h4 style="margin:10px 0;color:#4f46e5;">📝 题目笔记（${qNotes.length}）</h4>`;
      qNotes.forEach(n => {
        html += `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;background:#f9fafb;">
          <div style="font-size:12px;color:#888;margin-bottom:6px;">题目ID: ${n.questionId} · ${n.updatedAt}</div>
          <div style="white-space:pre-wrap;margin-bottom:8px;">${this.escapeHtml(n.content || '（无文字内容）')}</div>
          ${this.renderNoteImages(n.images)}
        </div>`;
      });
    }

    // 自定义笔记
    if (cNotes.length > 0) {
      html += `<h4 style="margin:20px 0 10px;color:#059669;">📒 自定义笔记（${cNotes.length}）</h4>`;
      cNotes.forEach(n => {
        html += `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;background:#f9fafb;">
          <div style="font-weight:600;margin-bottom:4px;">${this.escapeHtml(n.title || '无标题')}</div>
          <div style="font-size:12px;color:#888;margin-bottom:6px;">${n.updatedAt}</div>
          <div style="white-space:pre-wrap;margin-bottom:8px;">${this.escapeHtml(n.content || '（无文字内容）')}</div>
          ${this.renderNoteImages(n.images)}
        </div>`;
      });
    }

    body.innerHTML = html;
  },

  renderNoteImages(images) {
    if (!images || images.length === 0) return '';
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:8px;">
      ${images.map(src => `<img src="${src}" style="width:100%;border-radius:6px;cursor:pointer;" onclick="window.open('${src}','_blank')">`).join('')}
    </div>`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  // ========== 消息通知 ==========
  async loadNotifications() {
    const listEl = document.getElementById('notifList');
    const countEl = document.getElementById('notifCount');
    listEl.innerHTML = '<p style="text-align:center;padding:30px;color:#999;">加载中...</p>';

    const res = await api.getNotifications();
    if (!res.success) {
      listEl.innerHTML = `<p style="text-align:center;padding:30px;color:#999;">${res.message || '加载失败，请先部署后端接口'}</p>`;
      countEl.textContent = '共 0 条';
      return;
    }

    const list = res.notifications || [];
    countEl.textContent = `共 ${list.length} 条`;

    if (list.length === 0) {
      listEl.innerHTML = '<p style="text-align:center;padding:30px;color:#999;">暂无通知</p>';
      return;
    }

    const typeMap = {
      info: { icon: '🔵', label: '更新', cls: 'notif-tag-info' },
      success: { icon: '🟢', label: '成就', cls: 'notif-tag-success' },
      warning: { icon: '🟡', label: '维护', cls: 'notif-tag-warning' },
      important: { icon: '🔴', label: '重要', cls: 'notif-tag-important' },
    };

    listEl.innerHTML = list.map(n => {
      const t = typeMap[n.type] || typeMap.info;
      const time = n.createdAt ? new Date(n.createdAt).toLocaleString('zh-CN') : '-';
      const expires = n.expiresAt ? ` · 过期：${new Date(n.expiresAt).toLocaleDateString('zh-CN')}` : '';
      const link = n.link ? `<div style="font-size:12px;color:#059669;margin-bottom:6px;">🔗 跳转：${this.escapeHtml(n.link)}</div>` : '';
      return `<div class="notif-item">
        <div class="notif-item-head">
          <span>${t.icon}</span>
          <span class="notif-item-title">${this.escapeHtml(n.title)}</span>
          <span class="notif-tag ${t.cls}">${t.label}</span>
        </div>
        <div class="notif-item-content">${this.escapeHtml(n.content)}</div>
        ${link}
        <div class="notif-item-meta">
          <span class="notif-item-time">发布于 ${time}${expires}</span>
          <button class="btn-action btn-danger" onclick="app.deleteNotification('${n.id}')">删除</button>
        </div>
      </div>`;
    }).join('');
  },

  async publishNotification() {
    const title = document.getElementById('notifTitle').value.trim();
    const content = document.getElementById('notifContent').value.trim();
    const type = document.getElementById('notifType').value;
    const link = document.getElementById('notifLink').value.trim();
    const expiresAt = document.getElementById('notifExpiresAt').value;

    if (!title || !content) {
      alert('标题和内容不能为空');
      return;
    }

    const btn = document.getElementById('publishNotifBtn');
    btn.textContent = '发布中...';
    btn.disabled = true;

    const notification = { title, content, type };
    if (link) notification.link = link;
    if (expiresAt) notification.expiresAt = expiresAt;

    const res = await api.createNotification(notification);

    btn.textContent = '发布通知';
    btn.disabled = false;

    if (res.success) {
      alert('发布成功！');
      // 清空表单
      document.getElementById('notifTitle').value = '';
      document.getElementById('notifContent').value = '';
      document.getElementById('notifLink').value = '';
      document.getElementById('notifExpiresAt').value = '';
      this.loadNotifications();
    } else {
      alert('发布失败：' + (res.message || '未知错误'));
    }
  },

  async deleteNotification(id) {
    if (!confirm('确定删除这条通知吗？删除后用户端将不再显示。')) return;
    const res = await api.deleteNotification(id);
    if (res.success) {
      this.loadNotifications();
    } else {
      alert('删除失败：' + (res.message || '未知错误'));
    }
  },
};

function closeNotesModal() {
  document.getElementById('notesModal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => app.init());
