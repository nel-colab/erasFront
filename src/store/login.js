// stores/login.js
import { defineStore } from 'pinia'
import axios from 'axios';

export const useAuthStore = defineStore('login', {
  state: () => {
    return { 
      user: null,
      token: null,
      loading: false,
      error: null,
    }},
  // could also be defined as
  // state: () => ({ count: 0 })
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
          this.user = (data && data.user) || { username };
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
          this.user = (data && data.user) || { username, email };
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
        this.error = (e && e.response && e.response.data && e.response.data.message) || e.message || 'Registration failed';
        return false;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this._reset();
    },

    _reset(e) {
      this.user = null;
      this.token = null;
      this.loading = false;
      if (axios.defaults.headers.common['Authorization']) {
        delete axios.defaults.headers.common['Authorization'];
      }
    }
  },
})  