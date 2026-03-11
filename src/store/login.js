// stores/login.js
import { defineStore } from 'pinia'
import axios from 'axios';

function extractError(e, fallback) {
  const data = e?.response?.data
  if (!data) return e?.message || fallback
  if (typeof data === 'string') return data
  // { message: "..." } or any field-keyed validation response like { password: "..." }
  return data.message || Object.values(data).find(v => typeof v === 'string') || e?.message || fallback
}

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return {} }
}

function buildUser(payload, extra = {}) {
  return {
    id: payload.sub,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    ...extra,
  }
}

export const useAuthStore = defineStore('login', {
  state: () => {
    const token = localStorage.getItem('auth_token') || null
    const user  = JSON.parse(localStorage.getItem('auth_user') || 'null')
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    return {
      user,
      token,
      loading: false,
      error: null,
    }},
  getters: {
    isAuthenticated: (state) => !!state.token,
    username: (state) => (state.user && state.user.username) || '',
    userId: (state) => (state.user && state.user.id) || null,
    permissions: (state) => (state.user && state.user.permissions) || [],
    can: (state) => (permission) => ((state.user && state.user.permissions) || []).includes(permission),
  },
  actions: {

    async login({ username, password }) {
      this.loading = true;
      this.error = null;
      try {
        const body = { username, password };
        const { data } = await axios.post('/api/auth/login', body);

        const token = data && (data.token || data.accessToken || data.jwt);

        if (token) {
          this.token = token;
          const payload = decodeJwt(token);
          this.user = buildUser(payload, { username });
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(this.user));
        }

        return true;
      } catch (e) {
        this._reset(e);
        this.error = extractError(e, 'Login failed');
        return false;
      } finally {
        this.loading = false;
      }
    },

    async register({ username, email, password, roleId }) {
      this.loading = true;
      this.error = null;
      try {
        const body = { username, email, password, roleId };
        const { data } = await axios.post('/api/auth/register', body);

        const token = data && (data.token || data.accessToken || data.jwt);

        if (token) {
          this.token = token;
          const payload = decodeJwt(token);
          this.user = buildUser(payload, { username, email });
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(this.user));
        }

        return true;
      } catch (e) {
        this._reset(e);
        this.error = extractError(e, 'Registration failed');
        return false;
      } finally {
        this.loading = false;
      }
    },

    async getRoleByName({ name }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await axios.get(`/api/roles/${name}`);
        return data;
      } catch (e) {
        this._reset(e);
        this.error = extractError(e, 'Failed to fetch role');
        return null;
      } finally {
        this.loading = false;
      }
    },

    async validateAccount({ tokenvalidate }) {
      this.loading = true;
      this.error = null;
      try {
        await axios.get(`/api/auth/verify?token=${tokenvalidate}`);
        return true;
      } catch (e) {
        this._reset(e);
        this.error = (e && e.response && e.response.data && e.response.data.message) || e.message || 'Validation failed';
        return false;
      } finally {
        this.loading = false;
      }
    },

    async fetchProfile() {
      try {
        const { data } = await axios.get('/api/users');
        const me = data.find(u => u.id === this.user?.id);
        if (me) this.user = { ...this.user, ...me };
      } catch (e) {
        // silently fail
      }
    },

    async updateProfile({ username, email, oldPassword, newPassword }) {
      this.loading = true;
      this.error = null;
      try {
        const body = { username, email };
        if (oldPassword && newPassword) {
          body.oldPassword = oldPassword;
          body.newPassword = newPassword;
        }
        const { data } = await axios.put(`/api/users/update/${this.user.id}`, body);
        const token = data && data.token;
        if (token) {
          this.token = token;
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const payload = decodeJwt(token);
          this.user = { ...this.user, ...buildUser(payload, { username, email }) };
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(this.user));
        }
        return true;
      } catch (e) {
        this.error = extractError(e, 'Update failed');
        return false;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this._reset();
    },

    _reset() {
      this.user = null;
      this.token = null;
      this.loading = false;
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
  },
})
