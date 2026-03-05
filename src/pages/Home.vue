<template>
  <!-- Carrusel -->
  <div class="row justify-content-center align-items-center carousel-row m-0 p-0">
    <div class="col-12">
      <div id="carouselExampleControls" class="carousel slide" data-bs-ride="carousel">
        <div class="carousel-inner">
          <div class="carousel-item active">
            <img class="d-block w-100" src="https://wallpapers.com/images/hd/kneeling-knight-with-dragon-2z7mkbq9ubbv6ec4.jpg" alt="First slide" />
          </div>
          <div class="carousel-item">
            <img class="d-block w-100" src="https://wallpapers.com/images/hd/demon-fighting-1920-x-1080-wallpaper-dzfymn6xaqgeiczn.jpg" alt="Second slide" />
          </div>
          <div class="carousel-item">
            <img class="d-block w-100" src="https://wallpapers.com/images/hd/1080p-dragon-3gr1y9zfypr9rpl4.jpg" alt="Third slide" />
          </div>
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#carouselExampleControls" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Anterior</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#carouselExampleControls" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Siguiente</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Contenedor para círculos con ancho limitado -->
  <div class="container mt-2"> <!-- Reducimos el margen superior -->
    <div class="row justify-content-center text-center circle-row gx-4 gy-4"> <!-- Manteniendo un espacio moderado entre círculos -->
      <div class="col-6 col-sm-4 col-md-2">
        <div class="circle mx-auto">
          <img src="/src/assets/dibujos/image1.jpg" alt="Imagen 1">
        </div>
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <div class="circle mx-auto">
          <img src="/src/assets/dibujos/image2.jpg" alt="Imagen 2">
        </div>
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <div class="circle mx-auto">
          <img src="/src/assets/dibujos/image3.jpg" alt="Imagen 3">
        </div>
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <div class="circle mx-auto">
          <img src="/src/assets/dibujos/image4.jpg" alt="Imagen 4">
        </div>
      </div>
      <div class="col-6 col-sm-4 col-md-2">
        <div class="circle mx-auto">
          <img src="/src/assets/dibujos/image5.jpg" alt="Imagen 5">
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Carrusel */
.carousel-item {
  height: 70vh;
  min-height: 300px;
}
.carousel-item img {
  height: 100%;
  object-fit: cover;
}

/* Espacio superior solo en escritorio */
.carousel-row {
  margin-top: 0;
}
@media (min-width: 768px) {
  .carousel-row {
    margin-top: 2rem; /* Menos espacio arriba */
  }
}

/* Círculos */
.circle {
  position: relative;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #ddd;
}
.circle img {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Más grandes en escritorio */
@media (min-width: 768px) {
  .circle {
    width: 180px;
    height: 180px;
  }
}

/* Espacio entre carrusel y círculos */
.circle-row {
  margin-top: 1rem;
}
@media (min-width: 768px) {
  .circle-row {
    margin-top: -0.2rem; /* Más cerca del carrusel */
  }
}

/* Evita scroll horizontal en todo el layout */
:host,
body {
  overflow-x: hidden;
}
</style>