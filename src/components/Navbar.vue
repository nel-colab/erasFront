<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/login'
import { useThemeStore } from '@/store/theme'

const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()

const isAuth = computed(() => auth.isAuthenticated)
const username = computed(() => auth.username || 'Jugador')

const isAdmin = computed(() => {
  const roles = (auth.user && auth.user.roles) || []
  const names = roles
    .map(r => (typeof r === 'string' ? r : (r && (r.name || r.role || r.code))))
    .filter(Boolean)
  return names.some(n => {
    const up = String(n).toUpperCase()
    return up === 'ROLE_ADMIN' || up === 'ADMIN'
  })
})

const doLogout = () => {
  auth.logout()
  router.push('/home')
}
</script>

<template>
  <nav class="navbar navbar-expand-lg custom-navbar fixed-top">
    <div class="container-fluid align-items-center d-flex">
      <!-- Logo -->
      <router-link class="navbar-brand me-auto" to="/home" aria-label="Ir a inicio">
        <img src="/src/assets/ISO.svg" alt="Logo" class="logo-img" />
      </router-link>

      <!-- Mobile title -->
      <div class="navbar-title-mobile d-block d-lg-none mx-auto text-center">
        <div class="eras-container">
          <span class="eras-text">ERAS</span>
          <div class="sub-title">Trading Card Game</div>
        </div>
      </div>

      <!-- Mobile toggler -->
      <button
        class="navbar-toggler ms-auto"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarSupportedContent"
        aria-controls="navbarSupportedContent"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <!-- Collapsible content -->
      <div class="collapse navbar-collapse justify-content-center" id="navbarSupportedContent">
        <!-- Desktop title -->
        <div class="navbar-title d-none d-lg-block mx-auto">
          <div class="eras-container">
            <span class="eras-text">ERAS</span>
            <div class="sub-title">Trading Card Game</div>
          </div>
        </div>

        <!-- Main menu -->
        <ul class="navbar-nav">
          <li class="nav-item active">
            <router-link class="nav-link" to="/home">Inicio</router-link>
          </li>
          <li class="nav-item active">
            <router-link class="nav-link" to="/cards">Cartas</router-link>
          </li>
          <li class="nav-item active">
            <router-link class="nav-link" to="/editions">Ediciones</router-link>
          </li>
          <li class="nav-item active">
            <router-link class="nav-link" to="/DeckBuilder">Constructor de mazos</router-link>
          </li>

          <!-- ✅ FAQ link -->
          <li v-if="isAdmin" class="nav-item active">
            <router-link class="nav-link" to="/FAQ">FAQ</router-link>
          </li>

          <!-- Admin-only items -->
          <li v-if="isAdmin" class="nav-item active">
            <router-link class="nav-link" to="/UpCards">UpCards</router-link>
          </li>
          <li v-if="isAdmin" class="nav-item active">
            <router-link class="nav-link" to="/CardsEdit">EdiCard</router-link>
          </li>

          <!-- Only show Profile for admin -->
          <li v-if="isAdmin" class="nav-item active">
            <router-link class="nav-link" to="/profile">Profile</router-link>
          </li>
        </ul>

        <!-- Right side: social + auth buttons -->
        <div class="d-flex align-items-center ms-auto">
          <!-- Auth (desktop) -->
          <div class="d-none d-lg-inline-flex gap-3 me-4 align-items-center">
            <template v-if="!isAuth">
              <router-link to="/login" class="btn-nav-outline">Log in</router-link>
              <router-link to="/register" class="btn-nav-primary">Sign up</router-link>
            </template>

            <template v-else>
              <div class="dropdown">
                <button
                  class="btn-nav-outline dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  {{ username }}
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li>
                    <router-link class="dropdown-item" to="/profile">Perfil</router-link>
                  </li>
                  <li>
                    <router-link class="dropdown-item" to="/my-decks">Mis mazos</router-link>
                  </li>
                  <li>
                    <router-link class="dropdown-item" to="/updates-manager">Gestionar cambios</router-link>
                  </li>
                  <li>
                    <router-link class="dropdown-item" to="/card-ref">Datos de referencia</router-link>
                  </li>
                  <li><hr class="dropdown-divider"></li>
                  <li>
                    <button class="dropdown-item text-danger" @click="doLogout">Cerrar sesión</button>
                  </li>
                </ul>
              </div>
            </template>
          </div>

          <!-- Theme toggle -->
          <button class="theme-toggle me-3" @click="theme.toggle()">
            {{ theme.dark ? 'Claro' : 'Oscuro' }}
          </button>

          <!-- Social icons -->
          <div class="d-flex gap-2 me-2">
            <a
              href="https://chat.whatsapp.com/KzG5PUekoTkFH1vXaOyX8v"
              target="_blank"
              rel="noopener noreferrer"
              class="social-icon"
              aria-label="Abrir grupo de WhatsApp"
            >
              <i class="bi bi-whatsapp"></i>
            </a>
          </div>
        </div>

        <!-- Auth buttons (mobile inside collapse) -->
        <div class="d-lg-none w-100 mt-3">
          <button class="theme-toggle w-100 mb-2" style="border-radius: 6px; padding: 0.4rem;" @click="theme.toggle()">
            {{ theme.dark ? 'Light mode' : 'Dark mode' }}
          </button>

          <!-- FAQ link for mobile -->
          <router-link to="/faq" class="btn btn-secondary w-100 fw-bold mb-2">FAQ</router-link>

          <template v-if="!isAuth">
            <router-link to="/login" class="btn-nav-outline w-100 mb-2 text-center">Log in</router-link>
            <router-link to="/register" class="btn-nav-primary w-100 text-center">Sign up</router-link>
          </template>

          <template v-else>
            <div v-if="isAdmin" class="d-grid gap-2 mb-3">
              <router-link to="/UpCards" class="btn btn-secondary w-100 fw-bold">UpCards</router-link>
              <router-link to="/CardsEdit" class="btn btn-secondary w-100 fw-bold">EdiCard</router-link>
            </div>
            <router-link to="/profile" class="btn btn-outline-light w-100 fw-bold mb-2">Go to Profile</router-link>
            <router-link to="/my-decks" class="btn btn-secondary w-100 fw-bold mb-2">Mis mazos</router-link>
            <router-link to="/updates-manager" class="btn btn-secondary w-100 fw-bold mb-2">Manage Updates</router-link>
            <router-link to="/card-ref" class="btn btn-secondary w-100 fw-bold mb-2">Card Reference Data</router-link>
            <button @click="doLogout" class="btn btn-outline-danger w-100 fw-bold">Log out</button>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>



<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Cinzel+Decorative:wght@400;700&display=swap');

/* 🔹 Navbar style */
.custom-navbar {
  background-color: #121314 !important;
}

.navbar {
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;
  z-index: 9999;
}

.navbar-nav { text-align: center; }
.navbar-nav .nav-item { margin-left: 1rem; }
.navbar-nav .nav-link { font-size: 1.05rem; }
.navbar-collapse { justify-content: center; }

.logo-img { height: 60px; object-fit: contain; }

.eras-container {
  position: relative;
  display: inline-block;
  text-align: center;
  line-height: 1;
}

.navbar-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  text-align: center;
  white-space: nowrap;
}

.navbar-title .eras-text {
  font-family: 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  background: linear-gradient(135deg, #e8d5a3 0%, #c9a84c 40%, #f0e0a0 65%, #b8862a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: block;
  filter: drop-shadow(0 1px 6px rgba(200,160,60,0.35));
}

.sub-title {
  font-family: 'Cinzel Decorative', serif;
  font-size: 0.62rem;
  font-weight: 400;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(220, 195, 130, 0.75);
  margin-top: 0.15rem;
}

/* Mobile */
.navbar-title-mobile {
  text-align: center;
}
.navbar-title-mobile .eras-text {
  font-family: 'Cinzel', serif;
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  background: linear-gradient(135deg, #e8d5a3 0%, #c9a84c 40%, #f0e0a0 65%, #b8862a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: block;
}
.navbar-title-mobile .sub-title {
  font-family: 'Cinzel Decorative', serif;
  font-size: 0.52rem;
  letter-spacing: 0.22em;
  color: rgba(220, 195, 130, 0.7);
  margin-top: 0.1rem;
}

.social-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.85);
  font-size: 1.4rem;
  transition: background 0.15s ease, color 0.15s ease;
  text-decoration: none;
}
.social-icon:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

@media (max-width: 768px) {
  .navbar-nav .nav-item { margin-left: 0.5rem; }
  .navbar-toggler { border-color: transparent; }
  .logo-img { height: 50px; }
}

/* 🔹 Dropdown dark theme */
.dropdown-menu { background-color: #1f1f1f !important; border: 1px solid #444; }
.dropdown-item { color: #ffffff !important; font-weight: bold; }
.dropdown-item:hover, .dropdown-item:focus {
  background-color: #3f51b5 !important; color: #ffffff !important;
}
.dropdown-divider { border-top: 1px solid #444 !important; }
</style>
