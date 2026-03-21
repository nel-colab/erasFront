<script setup>

import { ref,computed  } from "vue"

const slots = [
  10,9,8,7,6,5,4,3,2,1,
  0,
  1,2,3,4,5,6,7,8,9,10
]

const seccionActual = ref("tipos")

function cambiarSeccion(seccion){
  seccionActual.value = seccion
}








//<!-- RECURSOS -->
const gastoTotal = ref(0)
const inputGasto = ref(0)

const gemasJugador = ref(3)
const gemasRival = ref(3)

const contadorJugador = ref(3)
const contadorRival = ref(3)

const gasto = ref(0)
const resultado = ref(null)
const mensaje = ref("")

// TOTAL MAXIMO POSIBLE
const maxGasto = computed(() => {
  return gemasJugador.value + gemasRival.value
})

// MAXIMO RESTANTE (MEJOR UX)
const maxRestante = computed(() => {
  return maxGasto.value - gastoTotal.value
})

// INPUT CONTROLADO (opcional si lo usas después)
function setGasto(valor){
  if(valor < 0) valor = 0
  gasto.value = valor
}

// BOTON GASTAR
function gastarGemas() {
  const gastoInput = Number(inputGasto.value)

  if (gastoInput <= 0) return

  // validar contra el restante real
  if (gastoInput > maxRestante.value) {
    alert('No puedes gastar más gemas que el total permitido')
    return
  }

  // 🔥 acumulas
  gastoTotal.value += gastoInput

  // 🔥 esto pinta los círculos
  gasto.value = gastoTotal.value

  // calcular resultado en tiempo real
  calcularResultado()

  // 🧼 limpiar input
  inputGasto.value = 0
}

// RESULTADO (gemas que te quedan)
function calcularResultado(){
  resultado.value = gemasJugador.value - gasto.value
}

// COLORES DE LOS CIRCULOS
const getClaseSlot = (num, index) => {

  if(num === 0) return 'cero'

  // -------- IZQUIERDA (tus gemas) --------
  if(index <= 10){

    const gemas = gemasJugador.value
    const gastoActual = gasto.value

    if(num <= gemas){

      const posicionDesdeArriba = gemas - num + 1

      if(posicionDesdeArriba <= gastoActual){
        return 'gasto-ok' // azul
      }

      return 'disponible' // verde
    }

    return ''
  }

  // -------- DERECHA (exceso) --------
  if(index > 10){

    const exceso = Math.max(0, gasto.value - gemasJugador.value)

    if(exceso > 0 && num <= exceso){
      return 'gasto-exceso' // rojo
    }

    return ''
  }

  return ''
}

// SIMULAR TURNO
function simularTurno(){

  const exceso = Math.max(0, gasto.value - gemasJugador.value)

  // MENSAJE
  if (exceso > 0) {
    mensaje.value = `Gastaste de más y le diste ${exceso} gemas al rival`
  } else {
    mensaje.value = "Turno normal sin penalización"
  }

  // ===== RIVAL =====
  contadorRival.value = limitarContador(contadorRival.value + 1)

  // suma: exceso + ganancia por turno
  gemasRival.value += exceso + contadorRival.value

  // ===== JUGADOR =====
  contadorJugador.value = limitarContador(contadorJugador.value + 1)

  // reinicia gemas del jugador según contador
  gemasJugador.value = contadorJugador.value

  // ===== LIMPIEZA VISUAL =====
  gasto.value = 0
  gastoTotal.value = 0
  inputGasto.value = 0
  resultado.value = null
}

// LIMITE CONTADOR
function limitarContador(valor){
  return Math.min(valor, 5)
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
        :class="{active: seccionActual==='recursos'}"
        @click.prevent="cambiarSeccion('recursos')"
      >
        Recursos
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


<!-- RECURSOS -->
<div v-if="seccionActual==='recursos'" class="row justify-content-center mb-4">
  <div class="col-xl-10 col-lg-11 col-md-12">

  <div class="explicacion-recursos">

    <h2>💎 Sistema de Gemas</h2>

    <p>
      En este juego, tanto tú como tu rival utilizan <strong>gemas</strong> como recurso principal para jugar cartas y realizar acciones.
      Cada jugador tiene su propio contador de gemas, el cual determina cuántas gemas obtiene al inicio de su turno.
    </p>

    <h3>🔄 ¿Cómo se ganan las gemas?</h3>

    <p>
      Al comenzar tu turno, recibes una cantidad de gemas igual a tu <strong>contador de gemas</strong>.
      Este contador aumenta en +1 cada turno, pero nunca puede superar el valor máximo de <strong>5</strong>.
    </p>

    <ul>
      <li>Si tu contador es 3 → comienzas tu turno con 3 gemas</li>
      <li>Luego sube a 4 en el siguiente turno</li>
      <li>El máximo siempre será 5</li>
    </ul>

    <h3>💰 ¿Cómo gastar gemas?</h3>

    <p>
      Puedes gastar gemas para jugar cartas. No estás limitado solo a tus gemas actuales:
      también puedes usar las gemas del rival como referencia para gastar más.
    </p>

    <p>
      El límite real de gasto es:
    </p>

    <pre><code>tus gemas + gemas del rival</code></pre>

    <ul>
      <li>Si tienes 3 gemas y tu rival 3 → puedes gastar hasta 6</li>
      <li>Puedes gastar en varias acciones (ej: 1 + 2 + 3)</li>
    </ul>

    <h3>⚠️ ¿Qué pasa si gastas más de lo que tienes?</h3>

    <p>
      Si gastas más gemas de las que posees, entrarás en valores negativos.
      Esto tiene consecuencias importantes:
    </p>

    <ul>
      <li>No podrás declarar ataques</li>
      <li>Le entregarás gemas extra a tu rival en su próximo turno</li>
    </ul>

    <h3>📈 Ejemplo completo</h3>

    <p>
      Supongamos la siguiente situación:
    </p>

    <ul>
      <li>Tú tienes 3 gemas</li>
      <li>Tu rival tiene 3 gemas</li>
    </ul>

    <p>
      Decides gastar 5 gemas:
    </p>

    <ul>
      <li>Terminas con -2 gemas</li>
      <li>Esas 2 gemas extra se le entregan a tu rival</li>
    </ul>

    <p>
      En el siguiente turno del rival:
    </p>

    <ul>
      <li>Recibe sus gemas normales según su contador</li>
      <li>Más las gemas extra que tú le diste</li>
    </ul>

    <h3>🎮 ¿Cómo usar el simulador?</h3>

    <ul>
      <li>Ingresa cuántas gemas quieres gastar</li>
      <li>Presiona <strong>"Gastar Gemas"</strong></li>
      <li>Observa cómo los círculos cambian de color:</li>
    </ul>

    <ul>
      <li>🟢 Verde: gemas disponibles</li>
      <li>🔵 Azul: gemas gastadas</li>
      <li>🔴 Rojo: gasto extra (tomado del rival)</li>
    </ul>

    <p>
      Luego presiona <strong>"Simular Turno"</strong> para ver cómo cambian los recursos entre jugadores.
    </p>

  </div>


    <div class="recursos">
      <h5 class="recursos-title">Recursos - Simulador</h5>

          <h6 class="text-center mb-4">Simulador de recursos a contar de tu turno 3 (primer turno del juego rival)</h6>
      <!-- ESTADO -->
      <div class="estado">

        <!-- JUGADOR -->
        <div class="player jugador">
          <h6>Tú</h6>

          <div class="gemas-box">
            <span class="label">Gemas</span>
            <span class="valor">{{ gemasJugador }}</span>
          </div>

          <div class="contador-box">
            <span class="label">Contador</span>
            <span class="valor">{{ contadorJugador }}</span>
          </div>
        </div>

        <!-- RIVAL -->
        <div class="player rival">
          <h6>Rival</h6>

          <div class="gemas-box rival">
            <span class="label">Gemas</span>
            <span class="valor">{{ gemasRival }}</span>
          </div>

          <div class="contador-box rival">
            <span class="label">Contador</span>
            <span class="valor">{{ contadorRival }}</span>
          </div>
        </div>

      </div>

      <!-- CONTROL -->
      <div class="control">

        <!-- BARRA VISUAL -->
        <div class="barra-gemas">
          <div
            v-for="(num,index) in slots"
            :key="index"
            class="gema-slot"
            :class="[
              { invertido: index > 10 },
              getClaseSlot(num, index)
            ]"
          >
            {{ num }}
          </div>
        </div>

        
        <!-- INPUT -->
        <div class="input-gasto">
          <input
            type="number"
            min="0"
            :max="maxGasto"
            v-model.number="inputGasto"
          />

          <button @click="gastarGemas" class="btn-gastar">
            Gastar gemas
          </button>
        </div>

        <p>Gasto seleccionado: <b>{{ gasto }}</b></p>

        <p v-if="resultado !== null">
          Te quedarías con:
          <b :class="{negativo: resultado < 0}">
            {{ resultado }}
          </b>
        </p>

        <p v-if="gasto > gemasJugador" class="alerta">
          ❌ No puedes atacar
        </p>

        <button @click="simularTurno" class="btn-simular">
          Simular turno
        </button>

        <p class="mensaje">{{ mensaje }}</p>

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

          <div class="contador-gemas zone">
            <span class="zone-number">0</span>
            <span class="zone-title">GEMAS</span>
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
        <p><b>7 - Gemas:</b> Zona para ubicar el contador las gemas que ganaste en tu ultimo o actual turno.</p>

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
.contador-gemas{
  grid-column:1;
  grid-row:2;
  height:100px; /* más bajo para que sea horizontal */
}

.vidas{
  grid-column:1;
  grid-row:2.5; /* entre la línea frontal y la retaguardia */
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
  width:100%;
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

.recursos{
  font-size:0.9rem;
  line-height:1.45;
  padding:15px 10px;
}

.recursos-title{
  text-align:center;
  font-weight:600;
  margin-bottom:10px;
}



















/* RECURSOS INTERACTIVO */

/* CONTENEDOR ESTADO (JUGADOR + RIVAL) */

.estado{
  display:flex;
  justify-content:space-between;
  gap:20px;
  margin-bottom:20px;
}

/* PLAYER BASE */

.player{
  flex:1;
  background:#1a1a1a;
  padding:14px;
  border-radius:12px;
  border:1px solid #444;
  text-align:center;
  box-shadow:0 0 10px rgba(0,0,0,0.4);
}

/* ===== JUGADOR ===== */

.player.jugador .gemas-box{
  background:#0f1f14;
  border:1px solid #2ecc71;
}

.player.jugador .gemas-box .valor{
  color:#2ecc71;
}

.player.jugador .contador-box{
  background:#1a1f2b;
  border:1px solid #4fa3ff;
}

.player.jugador .contador-box .valor{
  color:#4fa3ff;
}

/* ===== RIVAL ===== */

.player.rival .gemas-box{
  background:#2a1a1a;
  border:1px solid #e74c3c;
}

.player.rival .gemas-box .valor{
  color:#e74c3c;
}

.player.rival .contador-box{
  background:#2a241a;
  border:1px solid #f39c12;
}

.player.rival .contador-box .valor{
  color:#f39c12;
}

/* CAJAS (COMUNES) */

.gemas-box,
.contador-box{
  display:flex;
  justify-content:space-between;
  align-items:center;
  border-radius:8px;
  padding:8px 12px;
  margin-top:8px;
}

.label{
  font-size:12px;
  opacity:0.8;
}

.valor{
  font-size:16px;
  font-weight:bold;
}

/* INPUT */

.input-gasto{
  margin-top:15px;
  display:flex;
  justify-content:center;
  gap:10px;
}

.input-gasto input{
  width:80px;
  padding:5px;
  text-align:center;
  border-radius:6px;
  border:1px solid #444;
  background:#111;
  color:white;
}

/* BOTON GASTAR */

.btn-gastar{
  padding:6px 14px;
  border:none;
  border-radius:6px;
  background:#4fa3ff;
  color:white;
  cursor:pointer;
}

.btn-gastar:hover{
  background:#6fb7ff;
}

/* BARRA GEMAS */

.barra-gemas{
  display:grid;
  grid-template-columns:repeat(21, minmax(32px, 1fr));
  gap:6px;
  margin-top:20px;
}

.gema-slot{
  aspect-ratio:1/1;
  min-width:36px;
  min-height:36px;
  border:2px solid #ccc;
  border-radius:50%;
  display:flex;
  justify-content:center;
  align-items:center;
  font-size:14px;
  font-weight:bold;
  background:#111;
  color:#fff;
  transition:.2s;

  box-shadow:
    inset 0 0 6px rgba(255,255,255,0.2),
    0 2px 6px rgba(0,0,0,0.5);
}

/* INVERTIDO */

.gema-slot.invertido{
  transform:rotate(180deg);
}

/* ===== ESTADOS VISUALES ===== */

/* DISPONIBLE (VERDE) */

.gema-slot.disponible{
  background:#2ecc71;
  border-color:#2ecc71;
}

/* GASTO NORMAL (AZUL) */

.gema-slot.gasto-ok{
  background:#3498db;
  border-color:#3498db;
}

/* EXCESO (ROJO) */

.gema-slot.gasto-exceso{
  background:#e74c3c;
  border-color:#e74c3c;
}

/* CERO */

.gema-slot.cero{
  background:#555;
}






.explicacion-recursos{
  border:1px solid #333;
  border-radius:12px;
  padding:12px;
  margin-bottom:20px;
  line-height:1.4;
  font-size:0.9rem; /* 🔥 reduce todo */
}

.explicacion-recursos h2{
  color:#2ecc71;
  margin-bottom:6px;
  font-size:16px;
}

.explicacion-recursos h3{
  margin-top:14px;
  color:#4fa3ff;
  font-size:14px;
}

.explicacion-recursos ul{
  margin-left:16px;
}

.explicacion-recursos li{
  margin-bottom:3px;
}

.explicacion-recursos pre{
  background:#000;
  padding:6px;
  border-radius:6px;
  border:1px solid #333;
  color:#2ecc71;
  font-size:12px;
}

.definiciones,
.tipos-cartas,
.recursos,
.explicacion-recursos,
.zona-explicacion{
  font-size:0.9rem;
  line-height:1.45;
}
</style>