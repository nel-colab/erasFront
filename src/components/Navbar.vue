<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/login'

const router = useRouter()
const auth = useAuthStore()

onMounted(() => {
  // auth.init()
})

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
  <nav class="navbar navbar-expand-lg navbar-light custom-navbar fixed-top">
    <div class="container-fluid align-items-center d-flex">
      <!-- Logo -->
      <router-link class="navbar-brand me-auto" to="/home" aria-label="Ir a inicio">
        <img src="/src/assets/ISO.svg" alt="Logo" class="logo-img" />
      </router-link>

      <!-- Mobile title -->
      <div class="navbar-title-mobile d-block d-lg-none mx-auto text-center">
        <div class="eras-container">
          <span class="eras-text">Eras</span>
          <div class="sub-title">Juego TCG coleccionable</div>
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
            <span class="eras-text">Eras</span>
            <div class="sub-title">Juego TCG coleccionable</div>
          </div>
        </div>

        <!-- Main menu -->
        <ul class="navbar-nav">
          <li class="nav-item active">
            <router-link class="nav-link" to="/home">Inicio</router-link>
          </li>
          <li class="nav-item active">
            <router-link class="nav-link" to="/Editions">Cartas</router-link>
          </li>
          <li class="nav-item active">
            <router-link class="nav-link" to="/DeckBuilder">Decks Builder</router-link>
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
              <router-link
                to="/login"
                class="btn btn-outline-light fs-5 px-4 py-2"
                style="height: 50px; min-width: 120px;"
              >
                Log in
              </router-link>

              <router-link
                to="/register"
                class="btn btn-primary fs-5 px-4 py-2"
                style="height: 50px; min-width: 130px;"
              >
                Sign up
              </router-link>
            </template>

            <template v-else>
              <div class="dropdown">
                <button
                  class="btn btn-outline-light fs-5 px-4 py-2 dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  style="height: 50px;"
                >
                  {{ username }}
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li>
                    <router-link class="dropdown-item" to="/profile">Go to Profile</router-link>
                  </li>
                  <li><hr class="dropdown-divider"></li>
                  <li>
                    <button class="dropdown-item text-danger" @click="doLogout">Log out</button>
                  </li>
                </ul>
              </div>
            </template>
          </div>

          <!-- Social icons -->
          <div class="d-flex gap-2 me-2">
            <!-- ✅ WhatsApp group link -->
            <a
              href="https://chat.whatsapp.com/KzG5PUekoTkFH1vXaOyX8v"
              target="_blank"
              rel="noopener noreferrer"
              class="icon-circle"
              aria-label="Abrir grupo de WhatsApp"
            >
              <img src="/src/assets/redes/WhatsApp_icon.png" alt="WhatsApp" class="icon-img-full" />
            </a>

            <!-- <a
              href="https://www.instagram.com/muebleria.eras?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
              target="_blank"
              rel="noopener noreferrer"
              class="icon-circle"
              aria-label="Abrir Instagram"
            >
              <img src="/src/assets/redes/Instagram_icon.png" alt="Instagram" class="icon-img-full" />
            </a>

            <a
              href="https://www.tiktok.com/@muebleria.eras?lang=es"
              target="_blank"
              rel="noopener noreferrer"
              class="icon-circle"
              aria-label="Abrir TikTok"
            >
              <img src="/src/assets/redes/Tiktok_icon.png" alt="TikTok" class="icon-img-full" />
            </a> -->
          </div>
        </div>
        <!-- 🔧 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ -->
        <!-- Closed the right-side wrapper BEFORE the mobile block. -->

        <!-- Auth buttons (mobile inside collapse) -->
        <div class="d-lg-none w-100 mt-3">
          <!-- ✅ FAQ link for mobile -->
          <router-link to="/faq" class="btn btn-secondary w-100 fw-bold mb-2">FAQ</router-link>

          <template v-if="!isAuth">
            <router-link to="/login" class="btn btn-outline-light w-100 mb-2 fw-bold">Log in</router-link>
            <router-link to="/register" class="btn btn-primary w-100 fw-bold">Sign up</router-link>
          </template>

          <template v-else>
            <div v-if="isAdmin" class="d-grid gap-2 mb-3">
              <router-link to="/UpCards" class="btn btn-secondary w-100 fw-bold">UpCards</router-link>
              <router-link to="/CardsEdit" class="btn btn-secondary w-100 fw-bold">EdiCard</router-link>
            </div>
            <router-link to="/profile" class="btn btn-outline-light w-100 fw-bold mb-2">Go to Profile</router-link>
            <button @click="doLogout" class="btn btn-outline-danger w-100 fw-bold">Log out</button>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>



<style scoped>
@font-face {
  font-family: 'Arial';
  src: url('/assets/fonts/Arial.woff2') format('woff2'),
       url('/assets/fonts/Arial.woff') format('woff');
  font-weight: normal;
  font-style: normal;
}

/* 🔹 Navbar style */
.custom-navbar {
  background-color: #121314 !important;
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.6);
}

.navbar {
  padding-top: 0.3rem;
  padding-bottom: 0.3rem;
  z-index: 9999;
}

.navbar-nav { text-align: center; }
.navbar-nav .nav-item { margin-left: 1rem; }
.navbar-collapse { justify-content: center; }

.logo-img { height: 60px; object-fit: contain; }

.eras-container { position: relative; display: inline-block; text-align: center; }

.navbar-title {
  font-family: 'Arial', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: #333;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-transform: uppercase;
  letter-spacing: 3px;
  z-index: 2;
}
.navbar-title .eras-text { color: rgb(0, 0, 0); }

.sub-title {
  font-family: 'Arial', sans-serif;
  font-size: 1.1rem;
  font-weight: 500;
  color: #ffffff;
  margin-top: 1px;
  text-transform: none;
  letter-spacing: 1px;
  position: relative;
  top: -12px;
}

.navbar-title-mobile {
  font-family: 'Arial', sans-serif;
  font-size: 1.7rem;
  font-weight: 700;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 2px;
}
.navbar-title-mobile .eras-text { color: rgb(165, 139, 82); }

.icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-block;
}
.icon-img-full { width: 100%; height: 100%; object-fit: cover; }

@media (max-width: 768px) {
  .navbar-nav .nav-item { margin-left: 0.5rem; }
  .navbar-toggler { border-color: transparent; }
  .icon-circle { width: 36px; height: 36px; }
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
