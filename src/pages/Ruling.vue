<script setup>

import { ref } from "vue"

const slots = [
  10,9,8,7,6,5,4,3,2,1,
  0,
  1,2,3,4,5,6,7,8,9,10
]

const seccionActual = ref("tipos")

function cambiarSeccion(seccion){
  seccionActual.value = seccion
}

</script>

<template>

<div class="container-fluid manual-page">

  <!-- TITULO -->

  <div class="row mb-3">
    <div class="col-12 text-center">
      <h2 class="titulo-manual">Aprender a jugar</h2>
    </div>
  </div>


<!-- BREADCRUMB -->

<div class="row justify-content-center mb-4">
  <div class="col-xl-10 col-lg-11 col-md-12 text-center">

    <div class="breadcrumb">

      <a
        href="#"
        :class="{active: seccionActual==='tipos'}"
        @click.prevent="cambiarSeccion('tipos')"
      >
        Definiciones
      </a>

      <a
        href="#"
        :class="{active: seccionActual==='definiciones'}"
        @click.prevent="cambiarSeccion('definiciones')"
      >
        Tipos de cartas
      </a>

      <a
        href="#"
        :class="{active: seccionActual==='tablero'}"
        @click.prevent="cambiarSeccion('tablero')"
      >
        Zonas de juego 
      </a>
 
    </div>
 
  </div>
</div>

<!-- DEFINICIONES -->

<div v-if="seccionActual==='tipos'" class="row justify-content-center mb-4">
  <div class="col-xl-10 col-lg-11 col-md-12">
    <div class="definiciones">
      <h5 class="definiciones-title">Definiciones</h5>

      <div class="row g-3">

        <!-- 1 -->
        <div class="col-md-6">
          <p>
            <b>Mazo:</b> Un mazo está compuesto por <b>50 cartas</b>.
            Todas deben pertenecer al mismo <b>color o clase</b> (el color blanco es generico para todos los mazos)
            de la criatura con keyword <b>Iniciador</b>.
            Cada carta puede incluirse con un máximo de <b>4 copias</b>.
          </p>
        </div>

        <!-- 2 -->
        <div class="col-md-6">
          <p>
            <b>Retaguardia:</b> A diferencia de la línea frontal, las criaturas en la 
            retaguardia están protegidas del oponente. Desde aquí no pueden declarar 
            ataques, bloquear criaturas enemigas ni afectarlas con sus efectos. 
            Esta zona también es donde se juegan las estructuras y utilidades.
          </p>
        </div>

        <!-- 3 -->
        <div class="col-md-6">
          <p>
            <b>Tributos:</b> Zona donde se colocan cartas usadas
            como coste o son eviadas por efectos del juego.
          </p>
        </div>

        <!-- 4 -->
        <div class="col-md-6">
          <p>
            <b>Descarte:</b> Zona donde se colocan utilidades usadas
            o cartas que son eviadas por efectos del juego.
            Si una criatura es destruido por enfrentamiento o un efecto rival
            va a esta zona sin pasar por los tributos.
          </p>
        </div>

        <!-- 5 -->
        <div class="col-md-6">
          <p>
            <b>Línea frontal:</b> Es la zona donde tus criaturas se enfrentan directamente 
            con las del oponente. Desde aquí pueden declarar ataques, bloquear criaturas 
            enemigas y usar efectos que las afecten. Sin embargo, al estar en primera línea 
            también quedan expuestas a los efectos de las criaturas rivales.
          </p>
          
        </div>

        <!-- IMAGEN (reemplaza el espacio vacío) -->
        <div class="col-md-6">
          
        </div>

        <!-- 6 -->
        <div class="col-md-6">
          <p>
            <b>Vidas:</b> Al comenzar la partida, cada jugador coloca 6 cartas 
            del tope de su mazo boca abajo en la sección de vidas, formando una pila.
            Estas cartas representan tus vidas. Si en algún momento te quedas sin vidas, pierdes la partida inmediatamente.
          </p>
          <p> La forma más común de perder vidas es a través de ataques.</p>
          <p> Cuando un jugador declara un ataque, el oponente sigue estos pasos:</p>
          <ul>
            <li> <b>1.</b> Si es una utilidad o estructura: puede jugarla inmediatamente sin pagar su coste o añadirla a su mano.</li>
            <li> <b>2.</b> Si es una criatura: compara su fuerza con la de la criatura atacante:</li>
            <ol><b>2.1</b> Si tiene más fuerza: puede añadirla a su mano o reforzar, colocándola boca arriba al fondo de sus vidas. 
              (Solo puede reforzar si la criatura fue revelada por un ataque).</ol>
            <ol><b>2.2</b> Si tiene menos fuerza: debe tributarla.</ol>
          </ul>
        </div>

        <!-- IMAGEN (reemplaza el espacio vacío) -->
        <div class="col-md-6 d-flex justify-content-center align-items-center">
          <div class="imagen-manual">
            <img src="../assets/dibujos/card-iniciales.png" alt="Imagen del juego" />
          </div>
        </div>

      </div>
    </div>
  </div>
</div>


<!-- TIPOS DE CARTAS -->

<div v-if="seccionActual==='definiciones'" class="row justify-content-center mb-4">
  <div class="col-xl-10 col-lg-11 col-md-12">
    <div class="tipos-cartas">
      <h5 class="tipos-title">Tipos de carta</h5>
      <div class="row g-3">

        <div class="col-md-6">

          <p>
            <b>Criaturas:</b> Cartas que participan en combate y pueden
            utilizar <b>invocaciones especiales</b>.
          </p>

          <p class="subtipo"><b>Invocaciones especiales:</b></p>

          <ul class="lista-invocaciones">

            <li>
              <b class="inv-ritual">Ritual:</b>  Se paga el coste de invocación especial en gemas
              y se tributa uno o más aliados de <b>nivel inferior</b> según
              lo requerido por la carta.
            </li>

            <li>
              <b class="inv-evolucion">Evolución:</b> Se paga el coste en gemas y la criatura
              evoluciona colocándola sobre la criatura objetivo,
              <b>heredando su efecto</b> en la parte inferior de la carta.
            </li>

            <li>
               <b class="inv-ascenso">Ascenso:</b>  Se paga el coste en gemas y se cumple el
              requerimiento de la carta tributando la criatura
              que va a ascender.
            </li>

            <li>
              <b class="inv-materializacion">Materialización:</b> Se paga el coste en gemas y las
              criaturas utilizadas se colocan bajo la criatura
              materializada como <b>materiales</b>.
            </li>

          </ul>

          <div class="reglas-invocacion">

            <p><b>Reglas importantes:</b></p>

            <ul>
              <li>
                Al realizar una <b>invocacion especial</b> o por efecto
                <b>antes</b> de cualquier accion o habilidad 
                <b> roba 1 carta</b>.
              </li>

              <li>
                Si una invocación requiere más de una criatura,
                la criatura <b>invocadora</b> siempre es la de
                <b>mayor nivel</b>.
              </li>

              <li>
                Al evolucionar una criatura, esta mantiene
                todos sus <b>estados y condiciones</b>.
              </li>

              <li>
                Al evolucionar una criatura, que se encuentre
                en la retaguardia esta <b>puede</b> subir a 
                la <b>línea frontal</b>.
              </li>
            </ul>

          </div>

        </div>

        <div class="col-md-3">

          <p>
            <b>Utilidad:</b> Cartas que generan efectos inmediatos, respuestas
            o modifican el estado del juego. Si esta carta es volteada
            desde tus vidas se puede o ser llevada a tu mano.
          </p>

        </div>

        <div class="col-md-3">

          <p>
            <b>Estructuras:</b> Cartas que permanecen en el campo
            generando efectos continuos. Solo puedes jugar 1 estrucutra 
            por turno pagando su coste en gemas. Si esta carta es volteada
            desde tus vidas se puede jugar en tu campo.
          </p>

        </div>

      </div>
    </div>
  </div>
</div>



<!-- TABLERO -->

  <div v-if="seccionActual==='tablero'" class="row align-items-start g-4">

    <!-- PLAYMAT -->
    <div class="col-xl-6 col-lg-6 col-md-12">
      <div class="playmat-container">
        <div class="playmat">
          <div class="enemy-row">

            <div
              v-for="(num,index) in slots"
              :key="index"
              class="enemy-slot"
              :class="{ invertido: index > 10 }"
            >
              {{ num }}
            </div>

          </div>

          <div class="vidas zone">
            <span class="zone-number">1</span>
            <span class="zone-title">VIDAS</span>
          </div>

          <div class="linea-frontal zone">
            <span class="zone-number">2</span>
            <span class="zone-title">LÍNEA FRONTAL</span>
          </div>

          <div class="retaguardia zone">
            <span class="zone-number">3</span>
            <span class="zone-title">RETAGUARDIA</span>
          </div>

          <div class="mazo zone">
            <span class="zone-number">4</span>
            <span class="zone-title">MAZO</span>
          </div>

          <div class="tributos zone">
            <span class="zone-number">5</span>
            <span class="zone-title">TRIBUTOS</span>
          </div>

          <div class="descarte zone">
            <span class="zone-number">6</span>
            <span class="zone-title">DESCARTE</span>
          </div>

        </div>
      </div>
    </div>


    <!-- EXPLICACION -->

    <div class="col-xl-6 col-lg-6 col-md-12">
      <div class="zona-explicacion">
        <h5 class="manual-title">Zonas del tablero</h5>

        <p><b>1 - Vidas:</b> Cartas que representan la resistencia del jugador.</p>
        <p><b>2 - Línea frontal:</b> Zona donde combaten las criaturas.</p>
        <p><b>3 - Retaguardia:</b> Zona para criaturas invocadas o estructuras.</p>
        <p><b>4 - Mazo:</b> Cartas disponibles para robar.</p>
        <p><b>5 - Tributos:</b> Cartas enviadas como coste.</p>
        <p><b>6 - Descarte:</b> Cartas usadas o destruidas.</p>

      </div>
    </div>
  </div>
</div>

</template>

<style scoped>
.manual-page{
  padding:20px 40px;
}

/* TITULO */

.titulo-manual{
  font-weight:700;
  letter-spacing:1px;
}


/* TIPOS DE CARTA */

.tipos-cartas{
  font-size:0.9rem;
  line-height:1.45;
  padding:15px 10px;
}

.tipos-title{
  text-align:center;
  font-weight:600;
  margin-bottom:10px;
}

.subtipo{
  margin-top:8px;
  margin-bottom:4px;
}

.lista-invocaciones{
  padding-left:18px;
  margin-bottom:0;
}

.lista-invocaciones li{
  margin-bottom:3px;
}


/* DEFINICIONES */

.definiciones{
  font-size:0.9rem;
  line-height:1.45;
  padding:15px 10px;
}

.definiciones-title{
  text-align:center;
  font-weight:600;
  margin-bottom:10px;
}


/* PLAYMAT */

.playmat-container{
  background:#111;
  border-radius:18px;
  padding:22px;
  border:2px solid rgba(255,255,255,0.4);
  box-shadow:
  0 0 12px rgba(255,255,255,0.25),
  0 0 40px rgba(255,255,255,0.08),
  0 6px 20px rgba(0,0,0,0.4);
}

.playmat{
  width:100%;
  max-width:600px;
  margin:auto;
  aspect-ratio:7/5;
  display:grid;
  grid-template-columns:1fr 3fr 1fr 1fr;
  grid-template-rows:auto 1fr 1fr;
  gap:14px;
  color:white;
}


/* FILA SUPERIOR */

.enemy-row{
  grid-column:1 / span 4;
  display:grid;
  grid-template-columns:repeat(21,1fr);
  gap:4px;
}

.enemy-slot{
  width:100%;
  aspect-ratio:5/7;
  border:2px solid #dcdcdc;
  border-radius:12px;
  display:flex;
  justify-content:center;
  align-items:center;
  font-size:12px;
  font-weight:600;
}

.invertido{
  transform:rotate(180deg);
}


/* ZONAS */

.zone{
  border:2px solid #dcdcdc;
  border-radius:12px;
  display:flex;
  justify-content:center;
  align-items:center;
  position:relative;
}

.zone-number{
  position:absolute;
  top:6px;
  left:6px;
  width:20px;
  height:20px;
  border-radius:50%;
  background:white;
  color:black;
  font-weight:bold;
  display:flex;
  justify-content:center;
  align-items:center;
  font-size:11px;
}

.zone-title{
  font-size:13px;
  font-weight:600;
  letter-spacing:1px;
  text-transform:uppercase;
  opacity:0.8;
}


/* POSICIONES */

.vidas{
  grid-column:1;
  grid-row:2;
}

.linea-frontal{
  grid-column:2;
  grid-row:2;
  border-bottom:3px solid white;
}

.retaguardia{
  grid-column:2;
  grid-row:3;
}

.mazo{
  grid-column:3;
  grid-row:2;
}

.tributos{
  grid-column:4;
  grid-row:2;
}

.descarte{
  grid-column:4;
  grid-row:3;
}


/* MANUAL */

.zona-explicacion{
  font-size:0.9rem;
  line-height:1.45;
}

.manual-title{
  font-weight:600;
  margin-bottom:14px;
}

.zona-explicacion p{
  margin-bottom:10px;
}


/* REGLAS DE INVOCACION */

.reglas-invocacion{
  margin-top:10px;
  padding-top:8px;
  border-top:1px solid #eee;
  font-size:0.85rem;
}

.reglas-invocacion ul{
  padding-left:18px;
  margin-bottom:0;
}

.reglas-invocacion li{
  margin-bottom:4px;
}


/* LISTA DE INVOCACIONES */

.lista-invocaciones li{
  margin-bottom:6px;
}

/* COLORES DE INVOCACIONES */

.inv-ritual{
  color:#692e80;
}

.inv-evolucion{
  color:#23672c;
}

.inv-ascenso{
  color:#9a1824;
}

.inv-materializacion{
  color:#37378f;
}










/* BREADCRUMB */

.breadcrumb{
  display:inline-flex;
  overflow:hidden;
  border-radius:6px;
  box-shadow:0 0 10px rgba(0,0,0,0.25);

}

.breadcrumb a{
  text-decoration:none;
  padding:8px 18px;
  font-size:13px;
  background:#ddd;
  color:#222;
  border-right:1px solid #bbb;
  transition:.2s;
  cursor:pointer;
}

.breadcrumb a:last-child{
  border-right:none;
}

.breadcrumb a.active{
  background:#2a5274;
  font-weight:600;
}


.imagen-manual{
  width:70%;
  height: 100%;
  display:flex;
  justify-content:flex-end; /* alinea la imagen a la derecha */
  align-items:center;
  border-radius:12px;
  padding:10px;
}

.imagen-manual img{
  max-width:100%;
  max-height:600px;
  object-fit:contain;
  border-radius:10px;
}


</style>