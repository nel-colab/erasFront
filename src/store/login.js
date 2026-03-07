// stores/login.js
import { defineStore } from 'pinia'
import axios from 'axios';

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return {} }
}

export const useAuthStore = defineStore('login', {
  state: () => {
    return {
      user: null,
      token: null,
      loading: false,
      error: null,
    }},
  getters: {
    isAuthenticated: (state) => !!state.token,
    username: (state) => (state.user && state.user.username) || '',
    userId: (state) => (state.user && state.user.id) || null,
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
          this.user = { id: payload.sub, username };
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        return true;
      } catch (e) {
        this._reset(e);
        this.error = (e && e.response && e.response.data && e.response.data.message) || e.message || 'Login failed';
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
          this.user = { id: payload.sub, username, email };
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        return true;
      } catch (e) {
        this._reset(e);
        this.error = (e && e.response && e.response.data && e.response.data.message) || e.message || 'Registration failed';
        return false;
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
          this.user = { ...this.user, id: payload.sub, username, email };
        }
        return true;
      } catch (e) {
        this.error = (e && e.response && e.response.data && e.response.data.message) || e.message || 'Update failed';
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
      if (axios.defaults.headers.common['Authorization']) {
        delete axios.defaults.headers.common['Authorization'];
      }
    }
  },
})
