// Movimiento de Mario: contols con flechas (mantener) y salto (Space)
document.addEventListener('DOMContentLoaded', () => {
    const mario = document.getElementById('mario');
    const pantalla = document.getElementById('pantalla');
    if (!mario) return; // si no existe el elemento, salimos
    const sprite = mario.querySelector('.sprite');

    // fallback position
    if (!mario.style.position) mario.style.position = 'absolute';

    // Posición inicial desde CSS o por defecto
    let x = parseInt(getComputedStyle(mario).left, 10);
    if (Number.isNaN(x)) x = 300;
    let y = parseInt(getComputedStyle(mario).top, 10);
    if (Number.isNaN(y)) y = 515;

    // Física / control
    let vx = 0;
    let vy = 0;
    const moveSpeed = 240; // px / s
    // Reducimos la capacidad de salto para bajar la altura de salto
    const jumpSpeed = 600; // px / s (reducido desde 730)
    const gravity = 1400; // px / s^2 (mantener ligero descenso)
    const keys = { left: false, right: false };

        // Suelo (tomamos la posición inicial top como suelo de referencia)
        const baseGroundY = y; // referencia del suelo del nivel
        let groundY = baseGroundY; // valor dinámico: cambia si Mario está sobre una rampa/objeto

        // Elementos con los que sí colisionaremos: cajas y ladrillos
        const allChildren = pantalla ? Array.from(pantalla.children) : [];
        const collidables = allChildren.filter(el => {
            if (el === mario) return false;
            if (el.id === 'suelo') return false;
            if (!el.id) return false;
            // incluir cajas y ladrillos
            if (el.id.startsWith('caja') || el.id.startsWith('ladrillo')) return true;
            return false;
        });

        // lista de champiñones activos
        const mushrooms = [];
        // monedas activas y contador
        const coins = [];
        let coinCount = 0;
        const hudEl = document.getElementById('hud');
        let monedasEl = document.getElementById('monedas');
        if (!monedasEl && hudEl) {
            monedasEl = document.createElement('div');
            monedasEl.id = 'monedas';
            monedasEl.textContent = 'Monedas: 0';
            hudEl.appendChild(monedasEl);
        }
        function updateCoinsUI() { if (monedasEl) monedasEl.textContent = 'Monedas: ' + coinCount; }

        // Inicializar bicho (enemigo) para patrulla horizontal
        const bicho = document.getElementById('bicho');
        let bx = 0, by = 0, bdir = 1, bspeed = 80, bmin = 0, bmax = 0;
        // estado y spawn del bicho para respawn
        let bSpawnX = 0, bSpawnY = 0, bDead = false;
        if (bicho) {
            bx = parseInt(getComputedStyle(bicho).left, 10) || 741;
            by = parseInt(getComputedStyle(bicho).top, 10) || 516;
            bSpawnX = bx; bSpawnY = by;
            const halfRange = 120; // rango de patrulla a cada lado
            bmin = Math.max(0, bx - halfRange);
            bmax = Math.min(pantalla ? pantalla.clientWidth - bicho.offsetWidth : window.innerWidth - bicho.offsetWidth, bx + halfRange);
        }

    let lastTime = performance.now();
    // Vidas e invulnerabilidad
    const vidasEl = document.getElementById('vidas');
    const initialLives = 3;
    let lives = initialLives;
    let invulnerable = false;
    let gameOver = false;
    const spawnX = x;
    const spawnY = y;

    function updateLivesUI(){ if (vidasEl) vidasEl.textContent = 'Vidas: ' + lives; }
    updateLivesUI();

    function update(dt) {
        if (gameOver) return;
    // dt en segundos
    // guardamos y previo para detectar 'stomp' (Mario cayendo sobre el bicho)
    const prevY = y;
        vx = 0;
        if (keys.left) vx = -moveSpeed;
        if (keys.right) vx = moveSpeed;

        x += vx * dt;
        vy += gravity * dt;
        y += vy * dt;

        // Evitar que Mario salga por arriba de la pantalla
        // mantenemos un pequeño margen (10px)
        if (y < 10) {
            y = 10;
            vy = 0;
        }

                // animación: añadir/quitar clase walking y volteo
                if (keys.left || keys.right) {
                    mario.classList.add('walking');
                    if (sprite) sprite.classList.add('walking');
                } else {
                    mario.classList.remove('walking');
                    if (sprite) sprite.classList.remove('walking');
                }
                // Voltear sprite y girar la cabeza en la dirección de movimiento
                if (keys.left) {
                    if (sprite) sprite.classList.add('facing-left');
                    mario.classList.add('look-left');
                    mario.classList.remove('look-right');
                } else if (keys.right) {
                    if (sprite) sprite.classList.remove('facing-left');
                    mario.classList.add('look-right');
                    mario.classList.remove('look-left');
                } else {
                    // mantener la última orientación — no cambiar la cabeza si no se mueve
                }


            // (procesar colisiones con cajas/ladrillos antes del bicho)
            const pantallaRect = pantalla ? pantalla.getBoundingClientRect() : { left: 0, top: 0 };
            let marioRect = {
                left: pantallaRect.left + x,
                top: pantallaRect.top + y,
                width: mario.offsetWidth,
                height: mario.offsetHeight
            };
            marioRect.right = marioRect.left + marioRect.width;
            marioRect.bottom = marioRect.top + marioRect.height;
            // Detectar colisiones Mario <-> monedas (colección)
            if (coins.length > 0) {
                for (let ci = coins.length - 1; ci >= 0; ci--) {
                    const c = coins[ci];
                    if (!c.el) { coins.splice(ci, 1); continue; }
                    const cr = c.el.getBoundingClientRect();
                    const overlapCX = Math.min(marioRect.right, cr.right) - Math.max(marioRect.left, cr.left);
                    const overlapCY = Math.min(marioRect.bottom, cr.bottom) - Math.max(marioRect.top, cr.top);
                    if (overlapCX > 0 && overlapCY > 0) {
                        // recoger moneda
                        try { if (c.el.parentElement) c.el.remove(); } catch (e) {}
                        coins.splice(ci, 1);
                        coinCount += 1;
                        updateCoinsUI();
                    }
                }
            }
            let standingOnSurface = false;
            for (const el of collidables) {
                const r = el.getBoundingClientRect();
                const overlapX = Math.min(marioRect.right, r.right) - Math.max(marioRect.left, r.left);
                const overlapY = Math.min(marioRect.bottom, r.bottom) - Math.max(marioRect.top, r.top);
                if (overlapX > 0 && overlapY > 0) {
                    if (overlapX < overlapY) {
                        // resolver horizontalmente
                        if ((marioRect.left + marioRect.right) / 2 < (r.left + r.right) / 2) {
                            x -= overlapX;
                        } else {
                            x += overlapX;
                        }
                        marioRect.left = pantallaRect.left + x;
                        marioRect.right = marioRect.left + marioRect.width;
                        mario.style.left = Math.round(x) + 'px';
                    } else {
                        // resolver verticalmente
                        if ((marioRect.top + marioRect.bottom) / 2 < (r.top + r.bottom) / 2) {
                            // Mario está arriba -> colocarlo encima
                            y -= overlapY;
                            vy = 0;
                            standingOnSurface = true;
                            marioRect.top = pantallaRect.top + y;
                            marioRect.bottom = marioRect.top + marioRect.height;
                        } else {
                            // Mario golpea por abajo
                            // Si es una caja o un ladrillo, se destruye y spawnea un champiñon
                            if (el.id) {
                                // coordenadas del bloque en el sistema de pantalla
                                const elLeft = r.left;
                                const elTop = r.top;
                                // remover el bloque del DOM
                                const parent = el.parentElement;
                                if (parent) parent.removeChild(el);
                                // quitar de collidables para no procesarlo más
                                const idx = collidables.indexOf(el);
                                if (idx >= 0) collidables.splice(idx, 1);

                                const pantallaRect2 = pantalla ? pantalla.getBoundingClientRect() : { left: 0, top: 0 };
                                const baseX = Math.round(elLeft - pantallaRect2.left);
                                const baseY = Math.round(elTop - pantallaRect2.top) - 6; // ligeramente encima

                                if (el.id.startsWith('caja')) {
                                    // spawn 1 moneda que flota hacia arriba y puede recogerse
                                    const coin = document.createElement('div');
                                    coin.className = 'coin';
                                    // posicion central sobre el bloque
                                    coin.style.left = (baseX) + 'px';
                                    coin.style.top = (baseY) + 'px';
                                    // disable CSS animation for predictable bounding rect and control via JS
                                    coin.style.animation = 'none';
                                    pantalla.appendChild(coin);
                                    // add to tracking array for collection detection and JS-based float
                                    const coinObj = { el: coin, x: baseX, y: baseY, vy: -120, timer: 0, floatDuration: 0.6 };
                                    coins.push(coinObj);
                                } else if (el.id.startsWith('ladrillo')) {
                                    // crear champiñón y añadir a la lista de móviles
                                    const mush = document.createElement('div');
                                    mush.className = 'mushroom';
                                    const mushX = baseX;
                                    const mushY = baseY - 14; // encima del bloque
                                    mush.style.left = mushX + 'px';
                                    mush.style.top = mushY + 'px';
                                    pantalla.appendChild(mush);
                                    mushrooms.push({ el: mush, x: mushX, y: mushY, vx: 40, vy: 0, width: mush.offsetWidth, height: mush.offsetHeight });
                                }
                            }
                            y += overlapY;
                            vy = 0;
                        }
                        mario.style.top = Math.round(y) + 'px';
                    }
                }
            }

            // Hemos eliminado la detección general de colisiones, pero mantenemos
            // la colisión específica con el enemigo `#bicho`.
            // Movemos al enemigo 'bicho' en patrulla horizontal simple
            if (bicho) {
                if (!bDead) {
                    bx += bdir * bspeed * dt;
                    if (bx <= bmin) { bx = bmin; bdir = 1; }
                    else if (bx >= bmax) { bx = bmax; bdir = -1; }
                    bicho.style.left = Math.round(bx) + 'px';
                    // voltear visualmente según dirección
                    bicho.style.transform = bdir < 0 ? 'scaleX(-1)' : 'scaleX(1)';
                    // animación de caminar en bicho
                    bicho.classList.add('walking');
                } else {
                    // escondido/muerto
                    bicho.classList.remove('walking');
                }

                // Detección simple de colisión AABB entre Mario y bicho (solo si no muerto)
                if (!bDead) {
                    const pantallaRect = pantalla ? pantalla.getBoundingClientRect() : { left: 0, top: 0 };
                    const marioRectLocal = {
                        left: pantallaRect.left + x,
                        top: pantallaRect.top + y,
                        right: pantallaRect.left + x + mario.offsetWidth,
                        bottom: pantallaRect.top + y + mario.offsetHeight
                    };
                    const bichoRect = {
                        left: pantallaRect.left + bx,
                        top: pantallaRect.top + by,
                        right: pantallaRect.left + bx + bicho.offsetWidth,
                        bottom: pantallaRect.top + by + bicho.offsetHeight
                    };

                    const overlapX = Math.min(marioRectLocal.right, bichoRect.right) - Math.max(marioRectLocal.left, bichoRect.left);
                    const overlapY = Math.min(marioRectLocal.bottom, bichoRect.bottom) - Math.max(marioRectLocal.top, bichoRect.top);
                    if (overlapX > 0 && overlapY > 0) {
                        // Detectar si es un 'stomp' (Mario viene desde arriba y está cayendo)
                        const marioPrevBottom = pantalla ? (pantalla.getBoundingClientRect().top + prevY + mario.offsetHeight) : (prevY + mario.offsetHeight);
                        const stompTolerance = 8; // tolerancia en píxeles
                        if (vy > 0 && (marioPrevBottom <= bichoRect.top + stompTolerance)) {
                            // Stomp: matar al bicho
                            bDead = true;
                            bicho.style.display = 'none';
                            // pequeño rebote de Mario
                            vy = -jumpSpeed * 0.5;
                            // respawn tras 5 segundos
                            setTimeout(() => {
                                bDead = false;
                                bx = bSpawnX;
                                by = bSpawnY;
                                bicho.style.left = Math.round(bx) + 'px';
                                bicho.style.top = Math.round(by) + 'px';
                                bicho.style.display = '';
                                bdir = 1;
                            }, 5000);
                        } else {
                            // Colisión lateral: aplicar reacción (knockback) y evitar atravesarlo
                            const marioCenterX = (marioRectLocal.left + marioRectLocal.right) / 2;
                            const bichoCenterX = (bichoRect.left + bichoRect.right) / 2;
                            if (marioCenterX < bichoCenterX) {
                                // Mario está a la izquierda -> sitúalo a la izquierda del bicho
                                x = bx - mario.offsetWidth - 2;
                                // pequeño rebote hacia atrás
                                vx = -moveSpeed * 0.5;
                            } else {
                                // Mario a la derecha -> sitúalo a la derecha
                                x = bx + bicho.offsetWidth + 2;
                                vx = moveSpeed * 0.5;
                            }
                            // efecto visual y pequeño salto
                            vy = -200;
                            mario.classList.add('hit');

                            // Golpe lateral: descontar vidas si no estamos invulnerables
                                if (!invulnerable) {
                                    lives -= 1;
                                    updateLivesUI();
                                    invulnerable = true;
                                    mario.classList.add('invulnerable');

                                    if (lives <= 0) {
                                        // game over
                                        gameOver = true;
                                        // mostrar overlay con botón Restart
                                        const overlay = document.createElement('div');
                                        overlay.id = 'gameOver';
                                        // crear contenido interno con botón
                                        const msg = document.createElement('div');
                                        msg.textContent = 'GAME OVER';
                                        msg.style.marginBottom = '12px';
                                        msg.style.textAlign = 'center';
                                        const btn = document.createElement('button');
                                        btn.textContent = 'Restart';
                                        btn.className = 'restart-button';
                                        btn.addEventListener('click', () => {
                                            // Recargar la página para reiniciar el estado limpio
                                            window.location.reload();
                                        });
                                        overlay.appendChild(msg);
                                        overlay.appendChild(btn);
                                        pantalla.appendChild(overlay);
                                    } else {
                                        // respawn Mario at spawn point
                                        x = spawnX;
                                        y = spawnY;
                                        vx = 0;
                                        vy = 0;
                                    }

                                    // quitar invulnerabilidad tras un tiempo
                                    setTimeout(() => {
                                        invulnerable = false;
                                        mario.classList.remove('invulnerable');
                                    }, 1500);
                                }

                            setTimeout(() => mario.classList.remove('hit'), 200);
                        }
                    }
                }
            }


            // Ajustar groundY según si Mario está sobre una superficie (caja/ladrillo)
            groundY = standingOnSurface ? y : baseGroundY;

            // Colisión final con el suelo (evita hundirse debajo)
            if (y > groundY) {
                y = groundY;
                vy = 0;
            }

            // límites horizontales dentro de la pantalla si existe
        const pw = pantalla ? pantalla.clientWidth : window.innerWidth;
        const minX = 0;
        const maxX = pw - mario.offsetWidth;
        x = Math.max(minX, Math.min(maxX, x));

            // Actualizar champiñones (física simple)
            if (mushrooms.length > 0) {
                const suelo = document.getElementById('suelo');
                const sueloTop = suelo ? suelo.offsetTop : (pantalla ? pantalla.clientHeight - 50 : window.innerHeight - 50);
                for (let i = mushrooms.length - 1; i >= 0; i--) {
                    const m = mushrooms[i];
                    m.vy += gravity * dt;
                    m.x += m.vx * dt;
                    m.y += m.vy * dt;
                    // colisión con suelo
                    if (m.y + (m.height || 20) >= sueloTop) {
                        m.y = sueloTop - (m.height || 20);
                        m.vy = 0;
                        // después de tocar suelo, desplazar horizontalmente más lento
                        m.vx = 24;
                    }
                    m.el.style.left = Math.round(m.x) + 'px';
                    m.el.style.top = Math.round(m.y) + 'px';
                    // opcional: eliminar si sale de pantalla por la izquierda/derecha
                    if (m.x < -100 || m.x > (pantalla ? pantalla.clientWidth + 100 : window.innerWidth + 100)) {
                        m.el.remove();
                        mushrooms.splice(i, 1);
                    }
                }
            }

            // Actualizar monedas (float y mantener hasta que sean recogidas)
            if (coins.length > 0) {
                for (let i = coins.length - 1; i >= 0; i--) {
                    const c = coins[i];
                    if (!c.el) { coins.splice(i, 1); continue; }
                    // aplicar física simple: flotar hacia arriba durante floatDuration
                    if (c.timer < c.floatDuration) {
                        c.y += c.vy * dt; // vy es negativo para subir
                        c.timer += dt;
                        if (c.timer >= c.floatDuration) {
                            c.vy = 0; // se detiene arriba
                        }
                    }
                    // mantener posición
                    c.el.style.left = Math.round(c.x) + 'px';
                    c.el.style.top = Math.round(c.y) + 'px';
                    // si sale de la pantalla por seguridad, eliminar
                    if (c.x < -100 || c.x > (pantalla ? pantalla.clientWidth + 100 : window.innerWidth + 100) || c.y < -200) {
                        try { if (c.el.parentElement) c.el.remove(); } catch (e) {}
                        coins.splice(i, 1);
                    }
                }
            }

        mario.style.left = Math.round(x) + 'px';
        mario.style.top = Math.round(y) + 'px';
    }

    function loop(now) {
        const dt = Math.min(0.05, (now - lastTime) / 1000);
        update(dt);
        lastTime = now;
        requestAnimationFrame(loop);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
        if (e.key === 'ArrowRight') { keys.right = true; e.preventDefault(); }
        // salto con Space
        if (e.code === 'Space' || e.key === ' ') {
            // Saltar si está en el suelo o apoyado en una caja/ladrillo.
            // Usamos una tolerancia ligeramente mayor para evitar problemas de precisión
            if (Math.abs(y - groundY) < 3) {
                vy = -jumpSpeed;
            }
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft') keys.left = false;
        if (e.key === 'ArrowRight') keys.right = false;
    });

    requestAnimationFrame(loop);
});
